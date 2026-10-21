import type { ChatMessage } from '@/chat/types';

/**
 * Messages the user sends in the onboarding chat before the paywall; the reply to the last
 * one ends onboarding (D-034, D-035).
 */
export const FREE_MESSAGES = 3;

/**
 * Where the onboarding chat stands:
 * - `open`: the user can send (`left` free messages remain).
 * - `waiting`: the free messages are used; the companion is still answering.
 * - `answered`: the last reply landed; time for the paywall.
 */
export type FirstChatPhase = 'open' | 'waiting' | 'answered';

/**
 * `sent`: messages the user sent in this onboarding chat, counted as they send (not from the
 * thread, which can hold older history when onboarding is replayed).
 */
export function firstChatPhase(
  messages: readonly ChatMessage[],
  isTyping: boolean,
  sent: number,
): { phase: FirstChatPhase; left: number } {
  const left = Math.max(0, FREE_MESSAGES - sent);
  if (left === 0) {
    const replied = !isTyping && messages.at(-1)?.role === 'assistant';
    return { phase: replied ? 'answered' : 'waiting', left };
  }
  return { phase: 'open', left };
}
