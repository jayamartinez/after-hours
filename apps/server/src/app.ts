import { presets } from '@after-hours/companions';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createManifestLoader, type Warn } from './assets/manifest';
import { createCharacterStore } from './characters/store';
import type { ServerConfig } from './config';
import type { Db } from './db/client';
import type { ChatModel, StructuredModel } from './providers/types';
import { accountRoutes } from './routes/account';
import { companionRoutes, createPublicProjector } from './routes/companions';
import { conversationRoutes } from './routes/conversations';
import { devCompanionRoutes, type DevCompanionRoutesOptions } from './routes/dev-companions';
import { healthRoutes } from './routes/health';
import { memoryRoutes } from './routes/memories';
import { privateAssetRoutes } from './routes/private-assets';
import { sessionRoutes } from './routes/session';

/** Persistence and the chat model. Without them only the read-only routes exist. */
export interface ChatServices {
  db: Db;
  model: ChatModel;
  sessionSecret: string;
  /** Memory extraction after each reply; unset disables automatic memories. */
  memoryModel?: StructuredModel;
  /** Background work that outlives a response (see `conversationRoutes`). */
  waitUntil?: (task: Promise<void>) => void;
}

export interface AppOverrides {
  /** Tests inject the client address for the dev editor's localhost gate. */
  remoteAddress?: DevCompanionRoutesOptions['remoteAddress'];
  chat?: ChatServices;
  /** Chat failure logging (default console.warn). */
  log?: (message: string) => void;
}

const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** Configured origins, plus any localhost port in development. */
function corsOrigin(config: ServerConfig) {
  return (origin: string) =>
    config.corsOrigins.includes(origin) ||
    (config.allowLocalhostOrigins && LOCALHOST_ORIGIN.test(origin))
      ? origin
      : null;
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

  const app = new Hono()
    .use('*', cors({ origin: corsOrigin(config) }))
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

  if (overrides.chat) {
    const { db, model, sessionSecret, memoryModel, waitUntil } = overrides.chat;
    app
      .route('/', sessionRoutes(db, sessionSecret))
      .route(
        '/',
        conversationRoutes({
          db,
          store,
          model,
          sessionSecret,
          killSwitch: config.killSwitch,
          rateLimitPerMin: config.rateLimitPerMin,
          memoryModel,
          waitUntil,
          log: overrides.log,
        }),
      )
      .route(
        '/',
        memoryRoutes({
          db,
          store,
          sessionSecret,
          memoryModel,
          killSwitch: config.killSwitch,
          rateLimitPerMin: config.rateLimitPerMin,
          log: overrides.log,
        }),
      )
      .route('/', accountRoutes(db, sessionSecret));
  }
  return app;
}
