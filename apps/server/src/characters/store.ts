import {
  CharacterOverridesSchema,
  type CharacterConfig,
  type CharacterOverrides,
} from '@after-hours/contracts';
import { z } from 'zod';

import type { Warn } from '../assets/manifest';
import { createCachedFileLoader, parseJson } from '../files/cached-file';

import { resolveCharacter } from './resolve';

/** Parses the overrides file. Invalid JSON or shape: warn and ignore the whole file. */
export function parseOverrides(
  text: string,
  source: string,
  knownIds: readonly string[],
  warn: Warn,
): CharacterOverrides | null {
  const json = parseJson(text);
  if (!json.ok) {
    warn(`[characters] Ignoring ${source}: invalid JSON (${json.reason}). Using presets.`);
    return null;
  }
  const result = CharacterOverridesSchema.safeParse(json.value);
  if (!result.success) {
    warn(
      `[characters] Ignoring ${source}: expected { "<id>": { ...fields } }. Using presets.\n${z.prettifyError(result.error)}`,
    );
    return null;
  }
  const unknown = Object.keys(result.data).filter((id) => !knownIds.includes(id));
  if (unknown.length > 0) {
    warn(`[characters] ${source}: ignoring unknown companion id(s): ${unknown.join(', ')}.`);
  }
  return result.data;
}

export interface CharacterStore {
  readonly presets: readonly CharacterConfig[];
  readonly overridesPath: string;
  /** Presets with valid overrides applied, in display order. */
  list(): CharacterConfig[];
  get(id: string): CharacterConfig | undefined;
  /** The override map currently on disk (null when missing or invalid). */
  overrides(): CharacterOverrides | null;
}

/**
 * Presets + local overrides (`COMPANIONS_CONFIG`). The file is re-read when its mtime or
 * size changes. Each merged config is validated; an invalid one logs its exact issues and
 * falls back to the preset. Warnings print once per file change.
 */
export function createCharacterStore(
  presets: readonly CharacterConfig[],
  overridesPath: string,
  warn: Warn,
): CharacterStore {
  const knownIds = presets.map((preset) => preset.id);
  const loadOverrides = createCachedFileLoader(
    overridesPath,
    (text) => parseOverrides(text, overridesPath, knownIds, warn),
    (reason) => {
      warn(`[characters] Could not read ${overridesPath} (${reason}). Using presets.`);
      return null;
    },
  );

  let cache: { overrides: CharacterOverrides | null; characters: CharacterConfig[] } | null = null;

  const list = (): CharacterConfig[] => {
    const overrides = loadOverrides();
    if (cache && cache.overrides === overrides) return cache.characters;
    const characters = presets.map((preset) => {
      const result = resolveCharacter(preset, overrides?.[preset.id]);
      if (!result.valid) {
        const details = result.issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
        warn(
          `[characters] ${overridesPath}: override for "${preset.id}" is invalid; using the preset.\n${details}`,
        );
      }
      return result.character;
    });
    cache = { overrides, characters };
    return characters;
  };

  return {
    presets,
    overridesPath,
    list,
    get: (id) => list().find((character) => character.id === id),
    overrides: loadOverrides,
  };
}
