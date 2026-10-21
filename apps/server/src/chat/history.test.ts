import { describe, expect, it } from 'vitest';

import { HISTORY_MAX_MESSAGES, HISTORY_MIN_MESSAGES, historyWindow } from './history';

describe('historyWindow', () => {
  it('sends a short thread whole', () => {
    expect(historyWindow(0)).toBe(0);
    expect(historyWindow(HISTORY_MAX_MESSAGES - 1)).toBe(HISTORY_MAX_MESSAGES - 1);
  });

  it('keeps between 30 and 39 messages, dropping the oldest 10 at a time', () => {
    const starts = new Set<number>();
    for (let length = HISTORY_MAX_MESSAGES; length < 200; length++) {
      const size = historyWindow(length);
      expect(size).toBeGreaterThanOrEqual(HISTORY_MIN_MESSAGES);
      expect(size).toBeLessThan(HISTORY_MAX_MESSAGES);
      starts.add(length - size);
    }
    // The first message sent only moves in steps of 10, so the cached prefix survives
    // the turns in between.
    for (const start of starts) expect(start % 10).toBe(0);
    expect(historyWindow(45) - historyWindow(44)).toBe(1);
    expect(45 - historyWindow(45)).toBe(44 - historyWindow(44));
  });
});
