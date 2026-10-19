const DAY = 86_400_000;

/** When a memory was saved, in rough words ("Today", "3 days ago", "Last month"). */
export function memoryAge(createdAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return 'Over a year ago';
}
