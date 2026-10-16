import { describe, expect, it } from 'vitest';

import {
  castEyebrow,
  castNumber,
  iMessageLabel,
  lineTheyMightSend,
  memoriesSubline,
  mightOpenWith,
  proactiveSubline,
  statusWithPlace,
} from './companion-copy';

const her = {
  name: 'Roya',
  statusLine: 'Live on Demo or Die',
  locationShort: 'Port Calder',
  pronouns: { subject: 'she', object: 'her' },
};

describe('companion copy frames', () => {
  it('fills sentence frames from config pronouns and fields', () => {
    expect(statusWithPlace(her)).toBe('Live on Demo or Die · Port Calder');
    expect(mightOpenWith(her)).toBe('She might open with');
    expect(lineTheyMightSend(her)).toBe('A line she might send');
    expect(memoriesSubline(her)).toBe('Only what you’ve told her. Edit or forget anything.');
    expect(proactiveSubline(her)).toBe('She can text you first, sometimes');
    expect(iMessageLabel(her)).toBe('Text her on iMessage');
  });

  it('formats cast numbers and the weekday eyebrow', () => {
    expect(castNumber(0)).toBe('No. 01');
    expect(castNumber(11)).toBe('No. 12');
    expect(castEyebrow(new Date(2026, 9, 15))).toBe('Tonight’s cast · Thursday');
  });
});
