import { presets } from '@after-hours/companions';
import { describe, expect, it } from 'vitest';

import {
  buildStartersPrompt,
  cleanStarters,
  createStarterCache,
  STARTER_COUNT,
  startersFingerprint,
} from './starters';

const [roy] = presets;
if (!roy) throw new Error('expected Roy preset');

const memory = {
  id: '00000000-0000-4000-8000-000000000001',
  companionId: 'roy',
  content: 'Has a job interview on Thu, Oct 22',
  category: 'event' as const,
  createdAt: '2026-10-19T12:00:00.000Z',
  pinned: false,
};

describe('cleanStarters', () => {
  it('trims quotes, drops blanks, duplicates, and long lines, and caps the count', () => {
    const long = 'x'.repeat(61);
    expect(
      cleanStarters(['  "my day was weird"  ', '', 'My day was weird', long, 'a', 'b', 'c', 'd']),
    ).toEqual(['my day was weird', 'a', 'b', 'c']);
    expect(cleanStarters(['a', 'b', 'c', 'd', 'e'])).toHaveLength(STARTER_COUNT);
  });
});

describe('buildStartersPrompt', () => {
  it('uses memories and the profile, and says so when there are none', () => {
    const withData = buildStartersPrompt(roy, {
      profile: { lookingFor: ['think'], values: [], dynamic: { x: 0, y: 0 }, textingLength: 2 },
      memories: [memory],
    });
    expect(withData).toContain('- Has a job interview on Thu, Oct 22');
    expect(withData).toContain('a place to think out loud');

    const empty = buildStartersPrompt(roy, { profile: null, memories: [] });
    expect(empty).toContain('skipped the sign-up questions');
    expect(empty).toContain('does not know anything about the user yet');
  });
});

describe('starter cache', () => {
  it('reuses starters only while the fingerprint matches', () => {
    const cache = createStarterCache();
    const before = startersFingerprint({ profile: null, memories: [] });
    const after = startersFingerprint({ profile: null, memories: [memory] });
    expect(before).not.toBe(after);
    cache.set('u:roy', before, ['hi']);
    expect(cache.get('u:roy', before)).toEqual(['hi']);
    expect(cache.get('u:roy', after)).toBeUndefined();
    expect(cache.get('other:roy', before)).toBeUndefined();
  });

  it('evicts the oldest entry when full', () => {
    const cache = createStarterCache(2);
    cache.set('a', 'f', ['1']);
    cache.set('b', 'f', ['2']);
    cache.set('c', 'f', ['3']);
    expect(cache.get('a', 'f')).toBeUndefined();
    expect(cache.get('c', 'f')).toEqual(['3']);
  });
});
