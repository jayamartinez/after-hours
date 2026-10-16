import { describe, expect, it } from 'vitest';

import { defaultPreferences, isHourInWindow } from './preferences';
import {
  formatHour,
  matchingChips,
  previewBubbles,
  quadrantFor,
  rhythmChip,
  textingCaption,
} from './readouts';

describe('readouts', () => {
  it('formats hours on a 12-hour clock', () => {
    expect([0, 1, 12, 13, 22].map(formatHour)).toEqual(['12 AM', '1 AM', '12 PM', '1 PM', '10 PM']);
  });

  it('treats windows that cross midnight correctly', () => {
    const window = { start: 22, end: 1 };
    expect([21, 22, 23, 0, 1, 2].map((h) => isHourInWindow(h, window))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('describes the default texting style like the design', () => {
    const { texting } = defaultPreferences();
    expect(textingCaption(texting)).toBe('Short · a little playful · replies in a minute or two');
    expect(previewBubbles(texting).map((b) => b.text)).toEqual([
      'long day or just a loud one?',
      'loud. the printer and I are no longer speaking',
      'good. it knows what it did.',
    ]);
    expect(previewBubbles({ ...texting, length: 4 })[0]?.text.length).toBeGreaterThan(30);
  });

  it('maps pad positions to quadrants', () => {
    expect(quadrantFor({ x: 0.5, y: 0.5 })).toBe('sparks');
    expect(quadrantFor({ x: -0.5, y: 0.5 })).toBe('kindred');
    expect(quadrantFor({ x: -0.5, y: -0.5 })).toBe('cozy');
    expect(quadrantFor({ x: 0.5, y: -0.5 })).toBe('playful');
  });

  it('builds matching chips from answers', () => {
    expect(rhythmChip({ start: 22, end: 1 })).toBe('night owl');
    const prefs = { ...defaultPreferences(), values: ['remembers' as const] };
    expect(matchingChips(prefs)).toEqual([
      'night owl',
      'teasing',
      'short texts',
      'remembers the little things',
      'voice notes too',
    ]);
  });
});
