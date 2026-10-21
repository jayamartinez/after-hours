import type { ChatMessage } from '@/chat/types';

/** Messages the user can send in the onboarding chat before the (demo) paywall. */
export const FREE_MESSAGES = 2;

/**
 * Where the onboarding chat stands:
 * - `open`: the user can send (`left` free messages remain).
 * - `waiting`: the free messages are used; the companion is still answering.
 * - `answered`: the last reply landed; time for the paywall.
 */
export type FirstChatPhase = 'open' | 'waiting' | 'answered';

export const userMessageCount = (messages: readonly ChatMessage[]) =>
  messages.filter((m) => m.role === 'user').length;

/**
 * `priorSent`: user messages already in the thread when onboarding opened it (history is
 * kept on the server, so a replayed onboarding resumes an existing conversation). Those do
 * not use up free messages.
 */
export function firstChatPhase(
  messages: readonly ChatMessage[],
  isTyping: boolean,
  priorSent = 0,
): { phase: FirstChatPhase; left: number } {
  const sent = userMessageCount(messages) - priorSent;
  const left = Math.max(0, FREE_MESSAGES - sent);
  if (left === 0) {
    const replied = !isTyping && messages.at(-1)?.role === 'assistant';
    return { phase: replied ? 'answered' : 'waiting', left };
  }
  return { phase: 'open', left };
}
