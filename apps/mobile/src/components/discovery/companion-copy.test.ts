import { describe, expect, it } from 'vitest';

import { castEyebrow, castNumber, memoriesSubline, mightOpenWith } from './companion-copy';

const her = {
  name: 'Roya',
  pronouns: { subject: 'she', object: 'her' },
};

describe('companion copy frames', () => {
  it('fills sentence frames from config pronouns and fields', () => {
    expect(mightOpenWith(her)).toBe('She might open with');
    expect(memoriesSubline(her)).toBe('Only what you’ve told her. Edit or forget anything.');
  });

  it('formats cast numbers and the weekday eyebrow', () => {
    expect(castNumber(0)).toBe('No. 01');
    expect(castNumber(11)).toBe('No. 12');
    expect(castEyebrow(new Date(2026, 9, 15))).toBe('Tonight’s cast · Thursday');
  });
});
