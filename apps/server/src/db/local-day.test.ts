import { describe, expect, it } from 'vitest';

import { localDay, localDayStart, nextLocalMidnight } from './local-day';

describe('local days', () => {
  it('uses the zone’s calendar day, not UTC’s', () => {
    // 7:50 PM in New York is already the next day in UTC.
    const evening = new Date('2026-10-20T23:50:00Z');
    expect(localDay(evening, 'America/New_York')).toBe('2026-10-20');
    expect(localDay(evening)).toBe('2026-10-20');
    expect(localDay(new Date('2026-10-21T00:10:00Z'), 'America/New_York')).toBe('2026-10-20');
    expect(localDay(new Date('2026-10-21T00:10:00Z'))).toBe('2026-10-21');
  });

  it('resets at the next local midnight', () => {
    const evening = new Date('2026-10-20T23:50:00Z');
    expect(nextLocalMidnight(evening, 'America/New_York').toISOString()).toBe(
      '2026-10-21T04:00:00.000Z',
    );
    expect(localDayStart(evening, 'America/New_York').toISOString()).toBe(
      '2026-10-20T04:00:00.000Z',
    );
    expect(nextLocalMidnight(evening).toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it('handles zones ahead of UTC and month ends', () => {
    const now = new Date('2026-10-31T15:30:00Z'); // 00:30 Nov 1 in Tokyo
    expect(localDay(now, 'Asia/Tokyo')).toBe('2026-11-01');
    expect(nextLocalMidnight(now, 'Asia/Tokyo').toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('handles daylight saving changes', () => {
    // New York falls back on 2026-11-01: that day is 25 hours long.
    const morning = new Date('2026-11-01T14:00:00Z');
    expect(localDayStart(morning, 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
    expect(nextLocalMidnight(morning, 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });
});
