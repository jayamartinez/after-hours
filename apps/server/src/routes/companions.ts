import { toPublicCharacter } from '@after-hours/companions';
import type {
  CharacterConfig,
  CompanionAssetManifest,
  CompanionsResponse,
  PublicCharacter,
} from '@after-hours/contracts';
import { Hono } from 'hono';

import type { Warn } from '../assets/manifest';
import { resolveCompanionImages } from '../assets/resolve-images';
import type { CharacterStore } from '../characters/store';

export interface PublicProjectorOptions {
  loadManifest: () => CompanionAssetManifest | null;
  publicServerUrl: string | undefined;
  privateAssetsDir: string;
  warn: Warn;
}

/** Character config → public API shape, with image slots resolved for this request's origin. */
export type PublicProjector = (character: CharacterConfig, requestUrl: string) => PublicCharacter;

export function createPublicProjector(options: PublicProjectorOptions): PublicProjector {
  return (character, requestUrl) => {
    const ctx = {
      baseUrl: options.publicServerUrl ?? new URL(requestUrl).origin,
      privateAssetsDir: options.privateAssetsDir,
      warn: options.warn,
    };
    const images = resolveCompanionImages(character, options.loadManifest(), ctx);
    return toPublicCharacter(character, images);
  };
}

export function companionRoutes(store: CharacterStore, toPublic: PublicProjector) {
  return new Hono().get('/companions', (c) => {
    const body: CompanionsResponse = {
      companions: store.list().map((character) => toPublic(character, c.req.url)),
    };
    return c.json(body);
  });
}
