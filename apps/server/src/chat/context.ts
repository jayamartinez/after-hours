import type { CharacterConfig, Memory } from '@after-hours/contracts';

import { relationshipStage, renderStage } from './relationship';

const DAY = 86_400_000;

/** Rough, human recency for a memory ("yesterday", "3 weeks ago"). */
export function relativeAge(createdAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return 'over a year ago';
}

/**
 * The memories this companion may use: only its own (Roy never sees what the user told
 * Roya and vice versa), pinned first, then newest, capped at `memory.maxRetrieved`.
 */
export function selectMemories(character: CharacterConfig, memories: readonly Memory[]): Memory[] {
  if (!character.memory.enabled) return [];
  return memories
    .filter((memory) => memory.companionId === character.id)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, character.memory.maxRetrieved);
}

export interface TurnContext {
  memories?: readonly Memory[];
  now?: Date;
  /** IANA time zone of the user, e.g. "America/New_York". Default UTC. */
  timeZone?: string;
  /** User messages in the thread, the one being answered included. Unset: no pacing. */
  userMessages?: number;
  /** When the thread's previous message (either side) was sent. Unset: a new thread. */
  lastMessageAt?: Date;
}

/** A gap this long since the last message is worth reacting to (D-043). */
export const RETURN_GAP_HOURS = 3;

function gapPhrase(ms: number): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `about ${hours} hours`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'about a day';
  if (days < 14) return `${days} days`;
  return `${Math.round(days / 7)} weeks`;
}

/**
 * Coming back after a while: the companion notices, the way a friend would (D-043).
 * Null when the last message was recent or there is none.
 */
export function renderReturn(lastMessageAt: Date | undefined, now: Date): string | null {
  if (!lastMessageAt) return null;
  const gap = now.getTime() - lastMessageAt.getTime();
  if (gap < RETURN_GAP_HOURS * 3_600_000) return null;
  return [
    '# They are back',
    `Your last texts were ${gapPhrase(gap)} ago. Notice it the way a friend would before anything else, in a short line: playful ("there you are", "what took you so long", "where'd you disappear to") or curious about what they got up to. Never needy or guilt-tripping, and skip it if they already explained.`,
  ].join('\n');
}

/**
 * Volatile per-turn context (current time, relationship stage, remembered facts). Kept out of the cached character prompt so that prompt stays
 * byte-stable across turns.
 */
export function buildTurnContext(character: CharacterConfig, context: TurnContext = {}): string {
  const now = context.now ?? new Date();
  const when = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: context.timeZone ?? 'UTC',
  }).format(now);
  const sections = [
    `# Right now
For the user it is ${when}. Background only: do not bring up the day or time unless they do or it changes your answer.`,
  ];

  const back = renderReturn(context.lastMessageAt, now);
  if (back) sections.push(back);

  const memories = selectMemories(character, context.memories ?? []);
  if (context.userMessages !== undefined) {
    // All of this companion's memories count, not just the ones retrieved this turn.
    const known = character.memory.enabled
      ? (context.memories ?? []).filter((m) => m.companionId === character.id).length
      : 0;
    const stage = relationshipStage({ userMessages: context.userMessages, memories: known });
    sections.push(renderStage(stage));
  }
  if (memories.length > 0) {
    const lines = memories.map((m) => `- ${m.content} (told you ${relativeAge(m.createdAt, now)})`);
    sections.push(
      `# What they have told you before\nOnly these facts are known from earlier conversations. Nothing else happened that you know of.\n${lines.join('\n')}`,
    );
  }
  return sections.join('\n\n');
}
