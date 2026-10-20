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
