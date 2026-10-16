/**
 * DEMO DATA for the chat UI until the server chat API lands (Milestone 3).
 *
 * Every line comes from the companion's public config: `copy.firstMessage` opens the
 * thread, `examples.starters` stand in for the user's side, and `examples.signatureLines`
 * are the canned companion lines. Nothing here is AI-generated, and the UI labels it
 * "DEMO DATA".
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

/** A short demo thread showing every bubble type: text, reaction, voice note, image, receipts. */
export function buildDemoThread(companion: PublicCharacter, now: number): ChatMessage[] {
  const { firstMessage } = companion.copy;
  const { starters, signatureLines } = companion.examples;
  const lines: SeedLine[] = [];

  firstMessage.forEach((content, i) =>
    lines.push({
      role: 'assistant',
      kind: 'text',
      content,
      minutesAgo: 14,
      reactions: i === 0 ? ['heart'] : [],
    }),
  );

  const opener = pick(starters, -1);
  if (opener) lines.push({ role: 'user', kind: 'text', content: opener, minutesAgo: 12 });

  lines.push({
    role: 'assistant',
    kind: 'voice',
    content: '',
    voice: { durationSec: 18 },
    minutesAgo: 10,
  });
  lines.push({
    role: 'assistant',
    kind: 'image',
    content: '',
    image: { source: 'companion-gallery', index: 0 },
    minutesAgo: 10,
  });
  const caption = pick(signatureLines, 0);
  if (caption) lines.push({ role: 'assistant', kind: 'text', content: caption, minutesAgo: 10 });

  const followUp = pick(starters, 1);
  if (followUp) lines.push({ role: 'user', kind: 'text', content: followUp, minutesAgo: 2 });

  const latest = pick(signatureLines, 1);
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

/**
 * The canned reply for the `turn`-th user message: cycles through the signature lines
 * (after the two the seed thread already used).
 */
export function demoReply(companion: PublicCharacter, turn: number): string {
  return (
    pick(companion.examples.signatureLines, turn + 2) ??
    pick(companion.copy.firstMessage, turn) ??
    companion.statusLine
  );
}
