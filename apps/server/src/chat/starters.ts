import { createHash } from 'node:crypto';

import type { CharacterConfig, Memory, UserProfile } from '@after-hours/contracts';
import { z } from 'zod';

import type { StructuredModel } from '../providers/types';

import { withoutEmDashes } from './bubbles';
import { describeProfile } from './profile';

/** Chips offered in an empty thread. */
export const STARTER_COUNT = 4;
const MAX_STARTER_CHARS = 60;
/** Memories shown to the writer; the newest and pinned ones matter most. */
const MAX_MEMORIES = 12;

const StartersSchema = z.object({
  starters: z.array(z.string().describe('One line the user could send, in their voice')).max(8),
});

export interface StarterInput {
  profile: UserProfile | null;
  /** This companion's memories of the user, pinned first, then newest. */
  memories: readonly Memory[];
}

export function buildStartersSystem(character: CharacterConfig): string {
  const { name, persona, publicProfile } = character;
  return [
    `You write tap-to-send opening lines for one user of a texting app. They are about to start a conversation with ${name}, a fictional AI companion.`,
    `About ${name}: ${publicProfile.about}`,
    `${name} is into: ${persona.interests.join(', ')}.`,
    '',
    'Rules:',
    `- Every line is a message the USER sends to ${name}, written as the user: "i", "my", "me" mean the user; "you" means ${name}.`,
    `- Exactly ${STARTER_COUNT} lines, each under ${MAX_STARTER_CHARS} characters: casual texting, mostly lowercase, no emoji, no quotes, no names.`,
    "- Each line opens a different direction. At least two are about the user's own life (their day, plans, something coming up, something they are into); one can ask for a take from the companion.",
    `- Memories are facts about the USER, never about ${name}. When memories are listed, at least two lines have the user bring up their own news from them (memory "Has a job interview Thursday" → "interview's thursday, distract me"), never asking ${name} about it.`,
    '- Never invent facts about the user: no events, people, places, or plans beyond the memories listed. Without memories, write open lines about moods or wants ("my day was weird", "i need something to look forward to", "tell me something good").',
    '- Match what they picked at sign-up for tone, but never mention the app, sign-up, or their answers.',
    '- PG-13. No flirting unless they asked for flirty.',
  ].join('\n');
}

export function buildStartersPrompt(character: CharacterConfig, input: StarterInput): string {
  const memories = input.memories.slice(0, MAX_MEMORIES);
  return [
    input.profile ? describeProfile(input.profile) : 'They skipped the sign-up questions.',
    memories.length
      ? `What ${character.name} remembers about the user:\n${memories.map((m) => `- ${m.content}`).join('\n')}`
      : `${character.name} does not know anything about the user yet.`,
    `Lines other users see by default (do not reuse them):\n${character.publicProfile.starters.map((s) => `- ${s}`).join('\n')}`,
  ].join('\n\n');
}

/** Trims, drops blanks, duplicates, and over-long lines; keeps at most `STARTER_COUNT`. */
export function cleanStarters(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of lines) {
    const line = withoutEmDashes(raw.trim().replace(/^["'“]|["'”]$/g, '')).trim();
    const key = line.toLowerCase();
    if (!line || line.length > MAX_STARTER_CHARS || seen.has(key)) continue;
    seen.add(key);
    kept.push(line);
    if (kept.length === STARTER_COUNT) break;
  }
  return kept;
}

/** Starters written for this user from their profile and this companion's memories. */
export async function generateStarters(
  model: StructuredModel,
  character: CharacterConfig,
  input: StarterInput,
): Promise<string[]> {
  const { value } = await model.generate({
    system: buildStartersSystem(character),
    prompt: buildStartersPrompt(character, input),
    schema: StartersSchema,
    maxTokens: 400,
  });
  return cleanStarters(value.starters);
}

/** Changes whenever what the starters are written from changes. */
export function startersFingerprint(input: StarterInput): string {
  const source = JSON.stringify([
    input.profile,
    input.memories.slice(0, MAX_MEMORIES).map((m) => [m.id, m.content]),
  ]);
  return createHash('sha256').update(source).digest('base64url');
}

/**
 * Generated starters per user × companion, reused until the profile or memories change.
 * In-process and bounded (oldest entry evicted), like the rate limiter.
 */
export function createStarterCache(maxEntries = 5_000) {
  const entries = new Map<string, { fingerprint: string; starters: string[] }>();
  return {
    get(key: string, fingerprint: string): string[] | undefined {
      const entry = entries.get(key);
      return entry?.fingerprint === fingerprint ? entry.starters : undefined;
    },
    set(key: string, fingerprint: string, starters: string[]): void {
      entries.delete(key);
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, { fingerprint, starters });
    },
  };
}
