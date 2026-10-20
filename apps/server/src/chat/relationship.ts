/**
 * How well a companion knows this user (D-032). Early replies are shorter and curious
 * about the user's life; they warm up as the thread and the memories grow.
 */
export type RelationshipStage = 'new' | 'warming' | 'familiar';

export interface RelationshipSignals {
  /** User messages in this thread, the one being answered included. */
  userMessages: number;
  /** What this companion remembers about the user. */
  memories: number;
}

/** Within a stage's limits (messages at most, memories below) the user is still in it. */
export const STAGE_LIMITS = {
  new: { userMessages: 6, memories: 4 },
  warming: { userMessages: 30, memories: 10 },
} as const;

/**
 * Memories count too, so a cleared thread does not reset a companion who already knows a
 * lot about the user.
 */
export function relationshipStage({
  userMessages,
  memories,
}: RelationshipSignals): RelationshipStage {
  const below = (limit: RelationshipSignals) =>
    userMessages <= limit.userMessages && memories < limit.memories;
  if (below(STAGE_LIMITS.new)) return 'new';
  if (below(STAGE_LIMITS.warming)) return 'warming';
  return 'familiar';
}

const STAGE_GUIDANCE: Record<RelationshipStage, readonly string[]> = {
  new: [
    'You just met. Beyond what is listed here you know nothing about them yet, and you want to.',
    'Get to know them: their day, what they do, what they are into, what they have coming up. Most replies end with one specific question about their life that follows from what they just said. Never a generic interview question, never more than one question, never a list. This overrides how rarely you usually ask questions.',
    'Do not ask about anything already in what they have told you; build on it instead.',
    'Keep it short: one or two texts, each brief. Save longer messages for later.',
    'Say little about yourself unless they ask; when they do, answer briefly and turn it back to them with something specific.',
    'Hold back what you would only do with someone you know: no inside jokes, no pet names, teasing and flirting well below your usual level.',
  ],
  warming: [
    'You have talked a little and are still getting to know them.',
    'Now and then, ask about something they mentioned before or something you do not know yet, when it fits. Questions are no longer the default.',
    'Replies can be as long as your usual style. Share more of yourself, and tease at your usual level once they have shown they like it.',
  ],
  familiar: [
    'You know each other by now. Talk the way you usually do; the earlier getting-to-know-you pacing no longer applies.',
  ],
};

export function renderStage(stage: RelationshipStage): string {
  return `# Where you two are\n${STAGE_GUIDANCE[stage].map((line) => `- ${line}`).join('\n')}`;
}
