import { describe, expect, it } from 'vitest';

import { memoryAge } from './memory-age';

const now = new Date('2026-10-18T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('memoryAge', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [3, '3 days ago'],
    [9, 'Last week'],
    [21, '3 weeks ago'],
    [90, '3 months ago'],
    [400, 'Over a year ago'],
  ])('%i days → %s', (days, label) => {
    expect(memoryAge(ago(days), now)).toBe(label);
  });

  it('treats a clock slightly ahead of the device as today', () => {
    expect(memoryAge(new Date(now.getTime() + 60_000).toISOString(), now)).toBe('Today');
  });
});
