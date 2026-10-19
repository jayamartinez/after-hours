import type { ChatMessage } from '@/chat/types';

/** Messages the user can send in the onboarding chat before the (demo) paywall. */
export const FREE_MESSAGES = 2;

/**
 * Where the onboarding chat stands:
 * - `opening`: the companion is still typing its opening lines.
 * - `open`: the user can send (`left` free messages remain).
 * - `waiting`: the free messages are used; the companion is still answering.
 * - `answered`: the last reply landed; time for the paywall.
 */
export type FirstChatPhase = 'opening' | 'open' | 'waiting' | 'answered';

export const userMessageCount = (messages: readonly ChatMessage[]) =>
  messages.filter((m) => m.role === 'user').length;

/**
 * `priorSent`: user messages already in the thread when onboarding opened it (history is
 * kept on the server, so a replayed onboarding resumes an existing conversation). Those do
 * not use up free messages, and the opener is long done.
 */
export function firstChatPhase(
  messages: readonly ChatMessage[],
  isTyping: boolean,
  openingLines: number,
  priorSent = 0,
): { phase: FirstChatPhase; left: number } {
  const sent = userMessageCount(messages) - priorSent;
  const left = Math.max(0, FREE_MESSAGES - sent);
  if (left === 0) {
    const replied = !isTyping && messages.at(-1)?.role === 'assistant';
    return { phase: replied ? 'answered' : 'waiting', left };
  }
  const opened = priorSent > 0 || (!isTyping && messages.length - sent >= openingLines);
  return { phase: sent === 0 && !opened ? 'opening' : 'open', left };
}
