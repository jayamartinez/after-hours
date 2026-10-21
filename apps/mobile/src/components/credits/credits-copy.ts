import type { MessageAllowance } from '@after-hours/contracts';

/** "1 photo credit", "12 photo credits". */
export const creditsLabel = (count: number) => `${count} photo credit${count === 1 ? '' : 's'}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "7 free messages left today", "No free messages left · 20 extra", "Unlimited messages". */
export function messagesLeftLabel(allowance: MessageAllowance): string {
  if (allowance.unlimited) return 'Unlimited messages';
  const free =
    allowance.freeLeftToday > 0
      ? `${plural(allowance.freeLeftToday, 'free message')} left today`
      : 'No free messages left today';
  return allowance.bonus > 0 ? `${free} · ${allowance.bonus} extra` : free;
}

/** "Free messages come back in 5h." Rounded up so it never reads "in 0m". */
export function resetsInLabel(resetsAt: string, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((new Date(resetsAt).getTime() - now.getTime()) / 60_000));
  const span = minutes >= 60 ? `${Math.ceil(minutes / 60)}h` : `${minutes}m`;
  return `Free messages come back in ${span}.`;
}
