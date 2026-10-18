import { presets, toPublicCharacter } from '@after-hours/companions';
import { describe, expect, it } from 'vitest';

import { matchCompanion, otherCompanion, type MatchableCompanion } from './match';
import { defaultPreferences, type OnboardingPreferences } from './preferences';

const companions = presets.map((preset) => toPublicCharacter(preset));
const prefs = (patch: Partial<OnboardingPreferences>): OnboardingPreferences => ({
  ...defaultPreferences(),
  ...patch,
});

describe('matchCompanion (bundled presets)', () => {
  it('matches a teasing, flirty, deep-talk user to Roya', () => {
    const answers = prefs({
      lookingFor: ['banter'],
      values: ['flirty', 'laugh', 'curious'],
      dynamic: { x: 0.8, y: 0.6 },
      texting: { length: 2, expressiveness: 3, pace: 2 },
    });
    expect(matchCompanion(answers, companions)).toBe('roya');
  });

  it('matches a blunt, push-me, instant-reply user to Roy', () => {
    const answers = prefs({
      lookingFor: ['think'],
      values: ['challenges', 'honest', 'remembers'],
      dynamic: { x: -0.4, y: -0.5 },
      texting: { length: 0, expressiveness: 1, pace: 4 },
    });
    expect(matchCompanion(answers, companions)).toBe('roy');
  });

  it('gives a match for the default (skipped) answers', () => {
    expect(['roy', 'roya']).toContain(matchCompanion(defaultPreferences(), companions));
  });

  it('is deterministic and independent of call history', () => {
    const answers = prefs({ values: ['calm'], dynamic: { x: 0.1, y: -0.2 } });
    const first = matchCompanion(answers, companions);
    for (let i = 0; i < 5; i++) expect(matchCompanion(answers, companions)).toBe(first);
  });
});

describe('matchCompanion (config-driven)', () => {
  const make = (id: string, matchTags: string[], depth = 3): MatchableCompanion => ({
    id,
    publicProfile: { chips: [], matchTags, meters: { banter: 3, depth, pace: 'quick' } },
  });

  it('follows match tags from config, not ids', () => {
    const a = make('a', ['calm', 'gentle']);
    const b = make('b', ['blunt', 'competitive']);
    expect(matchCompanion(prefs({ values: ['calm'] }), [a, b])).toBe('a');
    expect(matchCompanion(prefs({ values: ['challenges'] }), [a, b])).toBe('b');
  });

  it('breaks ties toward the first companion', () => {
    const a = make('a', ['x']);
    const b = make('b', ['x']);
    expect(matchCompanion(prefs({}), [a, b])).toBe('a');
    expect(matchCompanion(prefs({}), [b, a])).toBe('b');
  });

  it('returns null with no companions', () => {
    expect(matchCompanion(prefs({}), [])).toBeNull();
  });
});

describe('otherCompanion', () => {
  it('returns the first companion that is not the match', () => {
    expect(otherCompanion(companions, 'roya')?.id).toBe('roy');
    expect(otherCompanion(companions, 'roy')?.id).toBe('roya');
  });
});
