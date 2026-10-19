import { readFileSync } from 'node:fs';

import {
  CharacterConfigSchema,
  PublicCharacterSchema,
  type CharacterConfig,
} from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import royJson from '../presets/roy.json';
import royaJson from '../presets/roya.json';

import { presets, toPublicCharacter } from './index';
import { characterJsonSchemaText, SCHEMA_PATH } from './json-schema';

/** Fields that must never reach the app (persona or feature config). */
const PRIVATE_KEYS = [
  'persona',
  'backstory',
  'interests',
  'personality',
  'instructions',
  'boundaries',
  'messages',
  'signatureLines',
  'style',
  'memory',
  'proactive',
  'voice',
  'voiceIdEnv',
  'voiceId',
  'appearance',
  'casing',
  'flirtation',
  'modes',
  'profanity',
];

/** Every piece of persona prose: none of it may appear anywhere in the public character. */
function personaTexts(preset: CharacterConfig): string[] {
  const { backstory, interests, personality, examples } = preset.persona;
  return [
    backstory,
    ...interests,
    personality.instructions,
    ...Object.values(personality.modes),
    ...personality.boundaries,
    ...examples.signatureLines,
    ...examples.messages.flatMap((m) => [...(m.user ? [m.user] : []), ...m.companion]),
  ];
}

describe('presets', () => {
  it('ships exactly Roy and Roya, in display order', () => {
    expect(presets.map((c) => c.id)).toEqual(['roy', 'roya']);
  });

  it.each([
    ['roy', royJson],
    ['roya', royaJson],
  ])('%s.json passes the CharacterConfig schema', (_id, json) => {
    const result = CharacterConfigSchema.safeParse(json);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it.each(presets)('$id uses the short disclosure', (preset) => {
    expect(preset.disclosure).toEqual({
      badge: 'AI PARODY',
      note: 'AI-generated parody. Not affiliated with or endorsed by Roy Lee.',
    });
  });

  it('rejects a typo, an under-21 age, and a reversed burst', () => {
    const base = presets[0];
    expect(CharacterConfigSchema.safeParse({ ...base, nmae: 'x' }).success).toBe(false);
    expect(CharacterConfigSchema.safeParse({ ...base, age: 19 }).success).toBe(false);
    const persona = base?.persona;
    expect(
      CharacterConfigSchema.safeParse({
        ...base,
        persona: { ...persona, style: { ...persona?.style, burst: [3, 1] } },
      }).success,
    ).toBe(false);
  });
});

describe('toPublicCharacter', () => {
  it.each(presets)('$id: contract-valid and excludes private fields', (preset) => {
    const pub = toPublicCharacter(preset);
    expect(PublicCharacterSchema.parse(pub)).toEqual(pub);
    expect(pub.images.hero).toMatchObject({ uri: null, asset: `${preset.id}/hero` });
    const keys = new Set<string>();
    JSON.stringify(pub, (key, value: unknown) => {
      keys.add(key);
      return value;
    });
    for (const key of PRIVATE_KEYS) expect(keys.has(key), key).toBe(false);
  });

  it.each(presets)('$id: no persona text appears anywhere in the public character', (preset) => {
    const strings: string[] = [];
    JSON.stringify(toPublicCharacter(preset), (_key, value: unknown) => {
      if (typeof value === 'string') strings.push(value);
      return value;
    });
    for (const text of personaTexts(preset)) {
      expect(strings, text).not.toContain(text);
      // Short bubbles ("no") occur inside ordinary copy; longer prose must not appear at all.
      if (text.length >= 20) {
        for (const value of strings) expect(value, text).not.toContain(text);
      }
    }
  });

  it.each(presets)('$id: projects only identity and publicProfile', (preset) => {
    expect(Object.keys(toPublicCharacter(preset)).sort()).toEqual([
      'age',
      'disclosure',
      'id',
      'images',
      'name',
      'proactiveByDefault',
      'pronouns',
      'publicProfile',
      'tint',
    ]);
  });
});

describe('character.schema.json', () => {
  it('is up to date with the Zod schema (run `pnpm companions:schema`)', () => {
    expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(characterJsonSchemaText());
  });
});
