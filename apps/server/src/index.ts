import { existsSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { resolveSessionSecret } from './auth/secret';
import { loadConfig, REPO_ROOT } from './config';
import { openDatabase } from './db/client';
import { createChatModel, createMemoryModel } from './providers';

const envFile = path.join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig(process.env);
const database = openDatabase(config.database);
if (database.target === 'pglite') {
  // Zero-setup local development: the in-process database migrates itself.
  await database.migrate();
}
const app = createApp(config, console.warn, {
  chat: {
    db: database.db,
    model: createChatModel(config.chat, 'plus'),
    freeModel: createChatModel(config.chat, 'free'),
    memoryModel: createMemoryModel(config.chat),
    sessionSecret: resolveSessionSecret(config),
  },
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  console.log(
    `[server] database: ${
      config.database.kind === 'pglite'
        ? `PGlite at ${config.database.dataDir}`
        : 'Postgres (DATABASE_URL)'
    }`,
  );
  console.log(
    `[server] chat models: ${config.chat.model} (Plus), ${config.chat.freeModel} (free), effort ${config.chat.effort}`,
  );
  console.log(`[server] memory model: ${config.chat.memoryModel}`);
  console.log(`[server] asset manifest: ${config.manifestPath}`);
  console.log(`[server] private assets: ${config.privateAssetsDir}`);
  console.log(`[server] character overrides: ${config.companionsConfigPath}`);
  if (config.killSwitch) console.log('[server] KILL_SWITCH is on: chat sends return 503');
  if (config.devEditor)
    console.log('[server] dev editor enabled at /dev/companions (localhost only)');
});

const shutdown = () => {
  server.close();
  void database.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
