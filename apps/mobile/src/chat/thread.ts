import type { ChatMessage, MessageStatus } from './types';

/** Messages from the same sender closer together than this share a group. */
export const GROUP_GAP_MS = 5 * 60_000;
/** A gap this long (or a new day) starts a new time divider. */
export const DIVIDER_GAP_MS = 60 * 60_000;

export type ThreadRow =
  | { type: 'divider'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: ChatMessage;
      /** First row of a sender group: gets the larger gap above it. */
      groupStart: boolean;
      /** Last row of a sender group: text bubbles get the tail corner. */
      groupEnd: boolean;
      /** Receipt line under the user's most recent message. */
      receipt: string | null;
    };

/** "11:52 PM", independent of device locale support (Hermes Intl varies). */
export function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today 11:40 PM", "Yesterday 9:02 PM", or "Mon, Oct 12 · 9:02 PM". */
export function formatDivider(date: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const clock = formatClock(date);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Yesterday ${clock}`;
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} · ${clock}`;
}

export function receiptLabel(status: MessageStatus, readAt: Date): string {
  switch (status) {
    case 'sending':
      return 'Sending…';
    case 'sent':
    case 'delivered':
      return 'Delivered';
    case 'read':
      return `Read ${formatClock(readAt)}`;
    case 'failed':
      return 'Not delivered';
  }
}

/**
 * Lays out a thread (oldest first) into display rows, oldest first: time dividers, sender
 * groups, and the receipt under the user's latest message.
 */
export function buildThreadRows(messages: ChatMessage[], now: Date): ThreadRow[] {
  const rows: ThreadRow[] = [];
  let lastUserIndex = -1;
  messages.forEach((m, i) => {
    if (m.role === 'user') lastUserIndex = i;
  });

  messages.forEach((message, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const time = new Date(message.createdAt);
    const prevTime = prev ? new Date(prev.createdAt) : null;
    const nextTime = next ? new Date(next.createdAt) : null;

    const dividerHere =
      !prevTime ||
      time.getTime() - prevTime.getTime() >= DIVIDER_GAP_MS ||
      startOfDay(time) !== startOfDay(prevTime);
    const dividerAfter =
      !!nextTime &&
      (nextTime.getTime() - time.getTime() >= DIVIDER_GAP_MS ||
        startOfDay(time) !== startOfDay(nextTime));

    if (dividerHere) {
      rows.push({ type: 'divider', key: `divider-${message.id}`, label: formatDivider(time, now) });
    }

    const joinsPrev =
      !!prev &&
      !dividerHere &&
      prev.role === message.role &&
      time.getTime() - prevTime!.getTime() < GROUP_GAP_MS;
    const joinsNext =
      !!next &&
      !dividerAfter &&
      next.role === message.role &&
      nextTime!.getTime() - time.getTime() < GROUP_GAP_MS;

    rows.push({
      type: 'message',
      key: message.id,
      message,
      groupStart: !joinsPrev,
      groupEnd: !joinsNext,
      // The demo has no per-message read time yet; M3 supplies it from the conversation's
      // last_read pointer. Until then the receipt shows the send time.
      receipt: i === lastUserIndex ? receiptLabel(message.status, time) : null,
    });
  });

  return rows;
}
