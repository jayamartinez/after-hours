import type { MessageAllowance } from '@after-hours/contracts';

/** "1 photo credit", "12 photo credits". */
export const creditsLabel = (count: number) => `${count} photo credit${count === 1 ? '' : 's'}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Free: "7 free messages left today", "No free messages left today · 20 extra".
 * Plus: "250 messages left today", "No messages left today".
 */
export function messagesLeftLabel(allowance: MessageAllowance): string {
  const word = allowance.plan === 'plus' ? 'message' : 'free message';
  const included =
    allowance.includedLeftToday > 0
      ? `${plural(allowance.includedLeftToday, word)} left today`
      : `No ${word}s left today`;
  return allowance.bonus > 0 ? `${included} · ${allowance.bonus} extra` : included;
}

/** "Messages come back in 5h." Rounded up so it never reads "in 0m". */
export function resetsInLabel(resetsAt: string, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((new Date(resetsAt).getTime() - now.getTime()) / 60_000));
  const span = minutes >= 60 ? `${Math.ceil(minutes / 60)}h` : `${minutes}m`;
  return `Messages come back in ${span}.`;
}
