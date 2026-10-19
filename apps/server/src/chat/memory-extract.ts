import {
  MAX_MEMORY_CHARS,
  MemoryCategorySchema,
  type CharacterConfig,
  type Memory,
  type MemoryCategory,
} from '@after-hours/contracts';
import { z } from 'zod';

import { normalizeMemory } from '../db/memories';
import type { ChatTurn, StructuredModel } from '../providers/types';

/** New memories kept from one exchange. */
export const MAX_NEW_PER_EXCHANGE = 3;
/** Candidates below this self-reported confidence are dropped. */
export const MIN_CONFIDENCE = 0.7;
/** Recent turns shown to the extractor; only the latest user turn is a source. */
const CONTEXT_TURNS = 6;

const ExtractionSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z.string().describe('One short third-person fact about the user'),
        category: MemoryCategorySchema,
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10),
});

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
}

export interface ExtractionInput {
  /** Recent turns ending with the companion's reply to the user's latest message. */
  turns: readonly ChatTurn[];
  /** What this companion already remembers (to skip repeats). */
  existing: readonly Memory[];
  /** Anchors relative dates ("on Friday"). Default: now. */
  now?: Date;
  /** IANA zone of the user's device, for the date above. */
  timeZone?: string;
}

/** Extractor instructions; the companion's `memory.focus` says what is worth keeping. */
export function buildExtractionSystem(character: CharacterConfig): string {
  return [
    `You maintain the long-term memory of ${character.name}, a fictional AI companion, about the user they text with.`,
    'Read the latest exchange and return durable facts the USER stated about themselves that are worth recalling in a later conversation.',
    '',
    'Worth remembering, for this companion:',
    ...character.memory.focus.map((focus) => `- ${focus}`),
    '',
    'Rules:',
    `- Only facts from the user's latest message. Earlier turns are context; never extract what ${character.name} said.`,
    '- Each memory is one plain third-person sentence under 120 characters, e.g. "Has a dog named Pixel".',
    '- Turn relative dates into absolute ones using today\'s date, e.g. "Starts a new job on Mon, Oct 26", never "on Monday" or "next week".',
    '- Skip small talk, greetings, passing moods, questions, hypotheticals, jokes, and anything already in the known list (even reworded).',
    '- Never store passwords, codes, account or card numbers, street addresses, phone numbers, or email addresses.',
    '- Category: fact (about them), preference (likes and dislikes), event (something dated or upcoming), relationship (people in their life), boundary (a topic or behavior they asked to avoid).',
    '- confidence is how sure you are the user really stated it and it will still matter next week.',
    '- Most exchanges contain nothing worth remembering. Return an empty list then.',
  ].join('\n');
}

export function buildExtractionPrompt(input: ExtractionInput): string {
  const known = input.existing.length
    ? input.existing.map((memory) => `- ${memory.content}`).join('\n')
    : '(none)';
  const exchange = input.turns
    .slice(-CONTEXT_TURNS)
    .map((turn) => `${turn.role === 'user' ? 'USER' : 'COMPANION'}: ${turn.content}`)
    .join('\n\n');
  return `Today is ${formatToday(input.now, input.timeZone)}.\n\nAlready known:\n${known}\n\nConversation (latest last):\n${exchange}`;
}

const PhrasingSchema = z.object({
  content: z.string().describe('The message as one short third-person fact about the user'),
  category: MemoryCategorySchema,
  duplicateOf: z
    .number()
    .int()
    .nullable()
    .describe('Number of the known memory that already says this, or null'),
});

export interface PhrasedMemory extends MemoryCandidate {
  /** The existing memory that already says this, if any. */
  duplicate?: Memory;
}

/**
 * "Remember this": phrases one user message as a memory in the extractor's style, and
 * spots a known memory that already says the same thing (even worded differently).
 */
export async function phraseMemory(
  model: StructuredModel,
  character: CharacterConfig,
  input: { message: string; existing: readonly Memory[]; now?: Date; timeZone?: string },
): Promise<PhrasedMemory> {
  const known = input.existing.length
    ? input.existing.map((memory, i) => `${i + 1}. ${memory.content}`).join('\n')
    : '(none)';
  const { value } = await model.generate({
    system: buildExtractionSystem(character),
    prompt: [
      'The user tapped "Remember this" on their message. Rewrite it as one memory, even if it seems minor.',
      `Today is ${formatToday(input.now, input.timeZone)}.`,
      `Known memories:\n${known}`,
      `Message:\n${input.message}`,
      'If a known memory already says the same thing, set duplicateOf to its number.',
    ].join('\n\n'),
    schema: PhrasingSchema,
    maxTokens: 500,
  });
  const content = value.content.trim().slice(0, MAX_MEMORY_CHARS) || input.message.trim();
  const duplicate = value.duplicateOf === null ? undefined : input.existing[value.duplicateOf - 1];
  return { content, category: value.category, duplicate };
}

function formatToday(now = new Date(), timeZone?: string): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  });
}

/**
 * Asks the memory model for new facts from the latest exchange, then keeps confident,
 * well-formed, non-duplicate candidates (at most `MAX_NEW_PER_EXCHANGE`).
 */
export async function extractMemories(
  model: StructuredModel,
  character: CharacterConfig,
  input: ExtractionInput,
): Promise<MemoryCandidate[]> {
  if (!character.memory.enabled || input.turns.at(-2)?.role !== 'user') return [];
  const { value } = await model.generate({
    system: buildExtractionSystem(character),
    prompt: buildExtractionPrompt(input),
    schema: ExtractionSchema,
    maxTokens: 1000,
  });

  const seen = new Set(input.existing.map((memory) => normalizeMemory(memory.content)));
  const kept: MemoryCandidate[] = [];
  for (const candidate of value.memories) {
    const content = candidate.content.trim();
    const key = normalizeMemory(content);
    if (candidate.confidence < MIN_CONFIDENCE || !key || content.length > MAX_MEMORY_CHARS) {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ content, category: candidate.category });
    if (kept.length === MAX_NEW_PER_EXCHANGE) break;
  }
  return kept;
}
