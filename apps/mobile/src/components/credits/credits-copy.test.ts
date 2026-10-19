import { describe, expect, it } from 'vitest';

import { creditsLabel } from './credits-copy';

describe('creditsLabel', () => {
  it('pluralizes', () => {
    expect(creditsLabel(0)).toBe('0 photo credits');
    expect(creditsLabel(1)).toBe('1 photo credit');
    expect(creditsLabel(30)).toBe('30 photo credits');
  });
});
