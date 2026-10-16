import { readFileSync } from 'node:fs';

import { CharacterConfigSchema, PublicCharacterSchema } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import royJson from '../presets/roy.json';
import royaJson from '../presets/roya.json';

import { presets, toPublicCharacter } from './index';
import { characterJsonSchemaText, SCHEMA_PATH } from './json-schema';

/** Fields that must never reach the app (prompt-only or feature config). */
const PRIVATE_KEYS = [
  'instructions',
  'boundaries',
  'messages',
  'style',
  'memory',
  'proactive',
  'voiceIdEnv',
  'voiceId',
  'appearance',
  'casing',
  'flirtation',
];

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
    expect(
      CharacterConfigSchema.safeParse({ ...base, style: { ...base?.style, burst: [3, 1] } })
        .success,
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
    expect(JSON.stringify(pub)).not.toContain(preset.personality.instructions);
  });
});

describe('character.schema.json', () => {
  it('is up to date with the Zod schema (run `pnpm companions:schema`)', () => {
    expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(characterJsonSchemaText());
  });
});
