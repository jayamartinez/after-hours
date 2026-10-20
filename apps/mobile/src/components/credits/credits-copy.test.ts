import { describe, expect, it } from 'vitest';

import { creditsLabel, messagesLeftLabel, resetsInLabel } from './credits-copy';

describe('creditsLabel', () => {
  it('pluralizes', () => {
    expect(creditsLabel(0)).toBe('0 photo credits');
    expect(creditsLabel(1)).toBe('1 photo credit');
    expect(creditsLabel(30)).toBe('30 photo credits');
  });
});

describe('messagesLeftLabel', () => {
  const base = {
    unlimited: false,
    freeLeftToday: 7,
    bonus: 0,
    adsLeftToday: 3,
    resetsAt: '2026-10-21T00:00:00.000Z',
  };
  it('reports free and extra messages', () => {
    expect(messagesLeftLabel(base)).toBe('7 free messages left today');
    expect(messagesLeftLabel({ ...base, freeLeftToday: 1 })).toBe('1 free message left today');
    expect(messagesLeftLabel({ ...base, freeLeftToday: 0, bonus: 20 })).toBe(
      'No free messages left today · 20 extra',
    );
    expect(messagesLeftLabel({ ...base, unlimited: true })).toBe('Unlimited messages');
  });
});

describe('resetsInLabel', () => {
  it('rounds up to hours or minutes', () => {
    const resetsAt = '2026-10-21T00:00:00.000Z';
    expect(resetsInLabel(resetsAt, new Date('2026-10-20T19:30:00Z'))).toBe(
      'Free messages come back in 5h.',
    );
    expect(resetsInLabel(resetsAt, new Date('2026-10-20T23:59:30Z'))).toBe(
      'Free messages come back in 1m.',
    );
  });
});
