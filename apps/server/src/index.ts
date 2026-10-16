import { existsSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';

import { createApp } from './app';
import { loadConfig, REPO_ROOT } from './config';

const envFile = path.join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig(process.env);
const app = createApp(config);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  console.log(`[server] asset manifest: ${config.manifestPath}`);
  console.log(`[server] private assets: ${config.privateAssetsDir}`);
  console.log(`[server] character overrides: ${config.companionsConfigPath}`);
  if (config.devEditor)
    console.log('[server] dev editor enabled at /dev/companions (localhost only)');
});
