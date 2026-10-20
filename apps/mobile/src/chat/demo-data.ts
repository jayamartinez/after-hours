/**
 * DEMO DATA for the chat UI when the server chat API is unreachable.
 *
 * Every line comes from the companion's `publicProfile`: `starters` stand in for the user's
 * side and `copy.sampleOpener` is the canned companion line (persona text never reaches the
 * app). Nothing here is AI-generated, and the UI labels it "DEMO DATA".
 */
import type { PublicCharacter } from '@after-hours/contracts';

import type { ChatMessage } from './types';

const MINUTE = 60_000;

type SeedLine = Omit<ChatMessage, 'id' | 'createdAt' | 'status' | 'reactions'> &
  Partial<Pick<ChatMessage, 'reactions'>> & { minutesAgo: number };

function pick(list: readonly string[], index: number): string | undefined {
  if (list.length === 0) return undefined;
  return list[((index % list.length) + list.length) % list.length];
}

/** Canned companion lines for the demo thread and replies. */
export function demoLines(companion: PublicCharacter): string[] {
  return [companion.publicProfile.copy.sampleOpener];
}

/** A short demo thread showing every bubble type: text, reaction, voice note, image, receipts. */
export function buildDemoThread(companion: PublicCharacter, now: number): ChatMessage[] {
  const { starters } = companion.publicProfile;
  const canned = demoLines(companion);
  const lines: SeedLine[] = [];

  const opener = pick(starters, -1);
  if (opener) lines.push({ role: 'user', kind: 'text', content: opener, minutesAgo: 16 });

  lines.push({
    role: 'assistant',
    kind: 'voice',
    content: '',
    voice: { durationSec: 18 },
    minutesAgo: 14,
    reactions: ['heart'],
  });
  lines.push({
    role: 'assistant',
    kind: 'image',
    content: '',
    image: { source: 'placeholder', description: 'demo photo' },
    minutesAgo: 10,
  });
  const caption = pick(canned, 0);
  if (caption) lines.push({ role: 'assistant', kind: 'text', content: caption, minutesAgo: 10 });

  const followUp = pick(starters, 1);
  if (followUp) lines.push({ role: 'user', kind: 'text', content: followUp, minutesAgo: 2 });

  const latest = pick(canned, 1);
  if (latest) lines.push({ role: 'assistant', kind: 'text', content: latest, minutesAgo: 1 });

  return lines.map(({ minutesAgo, reactions, ...line }, i) => ({
    ...line,
    id: `demo-${companion.id}-seed-${i}`,
    // Keep seed order stable even when several lines share a minute.
    createdAt: new Date(now - minutesAgo * MINUTE + i * 1000).toISOString(),
    status: line.role === 'user' ? 'read' : 'sent',
    reactions: reactions ?? [],
  }));
}

/** The canned reply for the `turn`-th user message: cycles through the demo lines. */
export function demoReply(companion: PublicCharacter, turn: number): string {
  return pick(demoLines(companion), turn) ?? companion.publicProfile.copy.sampleOpener;
}
