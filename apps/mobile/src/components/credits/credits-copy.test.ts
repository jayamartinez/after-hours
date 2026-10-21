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
    plan: 'free' as const,
    dailyIncluded: 10,
    includedLeftToday: 7,
    bonus: 0,
    adsLeftToday: 3,
    resetsAt: '2026-10-21T00:00:00.000Z',
  };
  it('reports free and extra messages', () => {
    expect(messagesLeftLabel(base)).toBe('7 free messages left today');
    expect(messagesLeftLabel({ ...base, includedLeftToday: 1 })).toBe('1 free message left today');
    expect(messagesLeftLabel({ ...base, includedLeftToday: 0, bonus: 20 })).toBe(
      'No free messages left today · 20 extra',
    );
  });
  it('reports Plus messages without "free"', () => {
    const plus = { ...base, plan: 'plus' as const, dailyIncluded: 300 };
    expect(messagesLeftLabel({ ...plus, includedLeftToday: 250 })).toBe('250 messages left today');
    expect(messagesLeftLabel({ ...plus, includedLeftToday: 0 })).toBe('No messages left today');
    expect(messagesLeftLabel({ ...plus, includedLeftToday: 0, bonus: 5 })).toBe(
      'No messages left today · 5 extra',
    );
  });
});

describe('resetsInLabel', () => {
  it('rounds up to hours or minutes', () => {
    const resetsAt = '2026-10-21T00:00:00.000Z';
    expect(resetsInLabel(resetsAt, new Date('2026-10-20T19:30:00Z'))).toBe(
      'Messages come back in 5h.',
    );
    expect(resetsInLabel(resetsAt, new Date('2026-10-20T23:59:30Z'))).toBe(
      'Messages come back in 1m.',
    );
  });
});
