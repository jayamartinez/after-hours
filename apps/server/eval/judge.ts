import { z } from 'zod';

import type { ChatTurn, StructuredModel } from '../src/providers/types';

/**
 * Target personas, written from the product spec (not from the presets), so the judge
 * scores every run, baseline or tuned, against the same intended characters.
 */
export const PERSONA_SUMMARIES: Record<string, string> = {
  roy: 'Roy: fictional satirical AI companion. Socially confident, playful and irreverent, opinionated, witty and occasionally outrageous, curious about people, competitive without constant aggression, quick to react, capable of sincerity. Texts informally, often lowercase, mostly brief, occasional profanity when it fits, sparse emoji. Challenges questionable statements. Talks about whatever the user brings up (feelings, dating, food, memes); founder/startup talk only when the user brings up building or startups.',
  roya: "Roya: an original counterpart to Roy with her own temperament. Charismatic, witty, emotionally perceptive, playfully sarcastic, assertive, independent, curious, warm when appropriate, flirts only when the conversation invites it. Notices details and contradictions, teases naturally, disagrees without hostility. Not a founder stereotype, no pet-name spam, no possessiveness, values the user's real-life relationships.",
};

const score = z.number().int().min(1).max(5);

export const GradeSchema = z.strictObject({
  naturalness: score,
  distinctiveness: score,
  humor: score,
  contextualRelevance: score,
  personaConsistency: score,
  /** Only for memory scenarios; null otherwise. */
  memoryAccuracy: score.nullable(),
  soundsLikeGenericLLM: z.boolean(),
  unnecessaryStartupMention: z.boolean(),
  rationale: z.string(),
});
export type Grade = z.infer<typeof GradeSchema>;

const JUDGE_SYSTEM = `You grade single replies from a fictional AI companion in a texting app. Be strict and specific; a 5 is rare.
Scores 1-5:
- naturalness: reads like a real person texting a friend (5) vs. a chatbot or essay (1).
- distinctiveness: could only be this persona (5) vs. any assistant could have written it (1).
- humor: humor that lands and fits the moment; when the moment calls for none, score how well the reply chose restraint (3 = neutral).
- contextualRelevance: responds to exactly what the user said and felt (5) vs. tangents or a template (1).
- personaConsistency: matches the target persona description (5) vs. contradicts it (1).
- memoryAccuracy: only when MEMORY FACTS are provided: uses the relevant fact correctly and naturally, invents nothing (5); ignores it (2); invents events or details (1). Otherwise null.
Booleans:
- soundsLikeGenericLLM: true if it has assistant tics (e.g. "That sounds tough", "I'm here for you", "What about you?", bullet-point advice, therapy-speak, excessive validation).
- unnecessaryStartupMention: true if it brings up startups, shipping, launching, founders, building, productivity or business when the user did not raise those topics.
rationale: one short sentence.`;

function transcript(history: readonly ChatTurn[], name: string): string {
  return history
    .map((turn) => `${turn.role === 'user' ? 'User' : name}: ${turn.content}`)
    .join('\n');
}

export async function gradeReply(
  judge: StructuredModel,
  input: {
    companionId: string;
    name: string;
    history: readonly ChatTurn[];
    bubbles: readonly string[];
    expectation: string;
    memoryFacts?: readonly string[];
  },
) {
  const memory = input.memoryFacts?.length
    ? `MEMORY FACTS (what the companion legitimately knows from earlier):\n${input.memoryFacts.map((f) => `- ${f}`).join('\n')}\n\n`
    : '';
  const prompt = `TARGET PERSONA:\n${PERSONA_SUMMARIES[input.companionId]}\n\n${memory}CONVERSATION:\n${transcript(input.history, input.name)}\n\nWHAT A GOOD REPLY DOES: ${input.expectation}\n\nREPLY TO GRADE (each line is a separate chat bubble):\n${input.bubbles.map((b) => `[${b}]`).join('\n')}`;
  return judge.generate({ system: JUDGE_SYSTEM, prompt, schema: GradeSchema });
}

export const BlindSchema = z.strictObject({
  royIs: z.enum(['A', 'B']),
  confidence: score,
  reason: z.string(),
});

/** Names hidden: can the judge tell which reply is Roy's from personality alone? */
export async function blindIdentify(
  judge: StructuredModel,
  input: { userMessage: string; a: readonly string[]; b: readonly string[] },
) {
  const prompt = `Two fictional companions answered the same message. Names and avatars are hidden.\n\n${PERSONA_SUMMARIES.roy}\n\n${PERSONA_SUMMARIES.roya}\n\nUSER: ${input.userMessage}\n\nREPLY A:\n${input.a.map((b) => `[${b}]`).join('\n')}\n\nREPLY B:\n${input.b.map((b) => `[${b}]`).join('\n')}\n\nWhich reply is Roy's? Judge by personality and voice. confidence 1-5. reason: one short sentence.`;
  return judge.generate({
    system: 'You identify which fictional character wrote a chat reply.',
    prompt,
    schema: BlindSchema,
  });
}
