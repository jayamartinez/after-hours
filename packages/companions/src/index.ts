import { CharacterConfigSchema, type CharacterConfig } from '@after-hours/contracts';

import royPreset from '../presets/roy.json';
import royaPreset from '../presets/roya.json';

export { defaultCharacterImages, defaultSlot, toPublicCharacter } from './public';

/**
 * Bundled presets, validated at load. JSON imports work in Node (tsx/vitest) and in
 * Metro (iOS and web). The whole preset file ships in the app bundle, so presets must
 * never contain secrets (voice ids come from env via `voice.voiceIdEnv`).
 */
export const presets: readonly CharacterConfig[] = [royPreset, royaPreset].map((preset) =>
  CharacterConfigSchema.parse(preset),
);

export const presetIds: readonly string[] = presets.map((preset) => preset.id);
