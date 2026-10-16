import { presets } from '@after-hours/companions';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createManifestLoader, type Warn } from './assets/manifest';
import { createCharacterStore } from './characters/store';
import type { ServerConfig } from './config';
import { companionRoutes, createPublicProjector } from './routes/companions';
import { devCompanionRoutes, type DevCompanionRoutesOptions } from './routes/dev-companions';
import { healthRoutes } from './routes/health';
import { privateAssetRoutes } from './routes/private-assets';

export interface AppOverrides {
  /** Tests inject the client address for the dev editor's localhost gate. */
  remoteAddress?: DevCompanionRoutesOptions['remoteAddress'];
}

export function createApp(
  config: ServerConfig,
  warn: Warn = console.warn,
  overrides: AppOverrides = {},
) {
  const store = createCharacterStore(presets, config.companionsConfigPath, warn);
  const toPublic = createPublicProjector({
    loadManifest: createManifestLoader(
      config.manifestPath,
      store.presets.map((p) => p.id),
      warn,
    ),
    publicServerUrl: config.publicServerUrl,
    privateAssetsDir: config.privateAssetsDir,
    warn,
  });

  return new Hono()
    .use('*', cors({ origin: config.corsOrigins }))
    .route('/', healthRoutes)
    .route('/', companionRoutes(store, toPublic))
    .route(
      '/',
      devCompanionRoutes({
        enabled: config.devEditor,
        store,
        toPublic,
        remoteAddress: overrides.remoteAddress,
      }),
    )
    .route('/', privateAssetRoutes(config.privateAssetsDir));
}
