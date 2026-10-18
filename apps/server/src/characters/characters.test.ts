import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { presets } from '@after-hours/companions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REPO_ROOT } from '../config';

import { deepMerge } from './deep-merge';
import { resolveCharacter } from './resolve';
import { createCharacterStore, parseOverrides } from './store';

const [roy, roya] = presets;
if (!roy || !roya) throw new Error('expected Roy and Roya presets');

describe('deepMerge', () => {
  it('merges nested objects, replaces arrays and scalars, skips undefined', () => {
    const base = { a: 1, nested: { x: 1, y: [1, 2, 3], deep: { k: 'v' } }, list: ['a', 'b'] };
    const merged = deepMerge(base, {
      a: undefined,
      nested: { y: [9], deep: { extra: true } },
      list: ['z'],
    });
    expect(merged).toEqual({
      a: 1,
      nested: { x: 1, y: [9], deep: { k: 'v', extra: true } },
      list: ['z'],
    });
    expect(base.nested.y).toEqual([1, 2, 3]);
  });

  it('replaces an object with a scalar (validation catches it later)', () => {
    expect(deepMerge({ a: { b: 1 } }, { a: 'x' })).toEqual({ a: 'x' });
  });
});

describe('resolveCharacter', () => {
  it('applies a valid deep-partial override', () => {
    const result = resolveCharacter(roy, {
      name: 'Roy (test)',
      persona: { style: { casing: 'sentence' } },
      publicProfile: { starters: ['only one'] },
    });
    expect(result.valid).toBe(true);
    expect(result.character.name).toBe('Roy (test)');
    expect(result.character.persona.style.casing).toBe('sentence');
    expect(result.character.persona.style.burst).toEqual(roy.persona.style.burst);
    expect(result.character.publicProfile.starters).toEqual(['only one']);
    expect(result.character.publicProfile.copy).toEqual(roy.publicProfile.copy);
  });

  it.each([
    ['an under-21 age', { age: 18 }, 'age'],
    ['a removed key', { tagline: 'x' }, '(root)'],
    ['a bad enum', { persona: { style: { casing: 'SHOUTY' } } }, 'persona.style.casing'],
    ['a wrong chip count', { publicProfile: { chips: ['one'] } }, 'publicProfile.chips'],
    ['an id change', { id: 'roya' }, 'id'],
  ])('falls back to the preset for %s', (_label, override, issuePath) => {
    const result = resolveCharacter(roy, override);
    expect(result.valid).toBe(false);
    expect(result.character).toBe(roy);
    expect(result.issues.map((i) => i.path)).toContain(issuePath);
  });
});

describe('createCharacterStore', () => {
  let workDir: string;
  let file: string;
  const warn = vi.fn<(message: string) => void>();

  beforeEach(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'ah-chars-'));
    file = path.join(workDir, 'companions.local.json');
    warn.mockClear();
  });
  afterEach(() => rmSync(workDir, { recursive: true, force: true }));

  it('returns presets when the override file is missing, without warning', () => {
    const store = createCharacterStore(presets, file, warn);
    expect(store.list()).toEqual(presets);
    expect(warn).not.toHaveBeenCalled();
  });

  it('applies valid overrides and keeps the other companion on its preset', () => {
    writeFileSync(file, JSON.stringify({ roy: { publicProfile: { chips: ['a', 'b', 'c'] } } }));
    const store = createCharacterStore(presets, file, warn);
    expect(store.get('roy')?.publicProfile.chips).toEqual(['a', 'b', 'c']);
    expect(store.get('roya')).toBe(roya);
  });

  it('logs exact issues for an invalid override, uses the preset, and warns once per change', () => {
    writeFileSync(file, JSON.stringify({ roy: { age: 12 }, roya: { name: 'Roya 2' } }));
    const store = createCharacterStore(presets, file, warn);
    expect(store.get('roy')).toBe(roy);
    expect(store.get('roya')?.name).toBe('Roya 2');
    store.list();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/"roy" is invalid[\s\S]*- age:/);
  });

  it('ignores invalid JSON with a warning and reloads after the file changes', () => {
    writeFileSync(file, '{ nope');
    const store = createCharacterStore(presets, file, warn);
    expect(store.list()).toEqual(presets);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'));

    writeFileSync(file, JSON.stringify({ roy: { name: 'Reloaded Roy' } }));
    expect(store.get('roy')?.name).toBe('Reloaded Roy');
  });

  it('warns about unknown companion ids', () => {
    writeFileSync(file, JSON.stringify({ zed: { name: 'Zed' } }));
    createCharacterStore(presets, file, warn).list();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('zed'));
  });
});

describe('config/companions.example.json', () => {
  it('parses and every override merges into a valid character', () => {
    const file = path.join(REPO_ROOT, 'config', 'companions.example.json');
    const warn = vi.fn<(message: string) => void>();
    const overrides = parseOverrides(readFileSync(file, 'utf8'), file, ['roy', 'roya'], warn);
    expect(warn).not.toHaveBeenCalled();
    for (const preset of presets) {
      expect(resolveCharacter(preset, overrides?.[preset.id]).issues).toEqual([]);
    }
  });
});
