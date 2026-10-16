import { describe, expect, it } from 'vitest';

import { activeIndexAt, cardWidthFor, snapOffsets } from './carousel-math';

describe('spotlight carousel geometry', () => {
  it('matches the approved 393pt layout: 333pt card with a peek', () => {
    expect(cardWidthFor(393)).toBe(333);
  });

  it('snaps each card to its slot, clamping the last to the content end', () => {
    // Content: 20 + 333 + 12 + 333 + 20 = 718; max offset 718 - 393 = 325.
    expect(snapOffsets(2, 333, 393)).toEqual([0, 325]);
    expect(snapOffsets(3, 333, 393)).toEqual([0, 345, 670]);
    expect(snapOffsets(0, 333, 393)).toEqual([]);
    expect(snapOffsets(1, 333, 393)).toEqual([0]);
  });

  it('picks the nearest card for a scroll offset', () => {
    const offsets = [0, 325];
    expect(activeIndexAt(0, offsets)).toBe(0);
    expect(activeIndexAt(150, offsets)).toBe(0);
    expect(activeIndexAt(200, offsets)).toBe(1);
    expect(activeIndexAt(400, offsets)).toBe(1);
  });
});
