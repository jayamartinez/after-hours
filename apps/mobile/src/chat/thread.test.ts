import { describe, expect, it } from 'vitest';

import { buildThreadRows, formatClock, formatDivider } from './thread';
import type { ChatMessage } from './types';

const at = (time: string) => new Date(`2026-10-16T${time}`);
let n = 0;
const msg = (role: ChatMessage['role'], time: string, extra: Partial<ChatMessage> = {}) =>
  ({
    id: `m${++n}`,
    role,
    kind: 'text',
    content: 'x',
    status: role === 'user' ? 'read' : 'sent',
    createdAt: at(time).toISOString(),
    reactions: [],
    ...extra,
  }) satisfies ChatMessage;

describe('formatting', () => {
  it('formats 12-hour clock times', () => {
    expect(formatClock(at('23:52:00'))).toBe('11:52 PM');
    expect(formatClock(at('00:05:00'))).toBe('12:05 AM');
    expect(formatClock(at('12:00:00'))).toBe('12:00 PM');
  });

  it('labels dividers relative to today', () => {
    const now = at('23:59:00');
    expect(formatDivider(at('23:40:00'), now)).toBe('Today 11:40 PM');
    expect(formatDivider(new Date('2026-10-15T21:02:00'), now)).toBe('Yesterday 9:02 PM');
    expect(formatDivider(new Date('2026-10-12T21:02:00'), now)).toBe('Mon, Oct 12 · 9:02 PM');
  });
});

describe('buildThreadRows', () => {
  it('groups same-sender messages and puts a divider first', () => {
    const rows = buildThreadRows(
      [msg('assistant', '23:40:00'), msg('assistant', '23:41:00'), msg('user', '23:42:00')],
      at('23:59:00'),
    );
    expect(rows.map((r) => r.type)).toEqual(['divider', 'message', 'message', 'message']);
    const [, a, b, c] = rows;
    expect(a).toMatchObject({ groupStart: true, groupEnd: false });
    expect(b).toMatchObject({ groupStart: false, groupEnd: true });
    expect(c).toMatchObject({ groupStart: true, groupEnd: true, receipt: 'Read 11:42 PM' });
  });

  it('splits groups after a long gap and adds a divider', () => {
    const rows = buildThreadRows(
      [msg('assistant', '20:00:00'), msg('assistant', '21:30:00')],
      at('23:59:00'),
    );
    expect(rows.map((r) => r.type)).toEqual(['divider', 'message', 'divider', 'message']);
    expect(rows[1]).toMatchObject({ groupEnd: true });
  });

  it('shows a receipt only under the latest user message', () => {
    const rows = buildThreadRows(
      [
        msg('user', '23:40:00'),
        msg('assistant', '23:41:00'),
        msg('user', '23:42:00', { status: 'sending' }),
      ],
      at('23:59:00'),
    );
    const receipts = rows.flatMap((r) => (r.type === 'message' ? [r.receipt] : []));
    expect(receipts).toEqual([null, null, 'Sending…']);
  });
});
