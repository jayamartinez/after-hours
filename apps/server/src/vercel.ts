import { getRequestListener } from '@hono/node-server';
import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';

import { createApp } from './app';
import { resolveSessionSecret } from './auth/secret';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { createChatModel, createMemoryModel } from './providers';

/**
 * Vercel Function entry (D-047): the whole API as one streaming Node function under
 * `/api`, next to the static web app on the same domain. `scripts/build-vercel.mjs`
 * bundles this file. Configuration comes from Project Settings (no .env file, no local
 * files): DATABASE_URL and SESSION_SECRET are required, photos come from
 * COMPANION_ASSETS_JSON, and migrations run from a developer machine (`pnpm db:migrate`).
 */
const config = loadConfig(process.env);
const database = openDatabase(config.database);

const app = createApp(config, console.warn, {
  chat: {
    db: database.db,
    model: createChatModel(config.chat, 'plus'),
    freeModel: createChatModel(config.chat, 'free'),
    memoryModel: createMemoryModel(config.chat),
    sessionSecret: resolveSessionSecret(config),
    // Memory extraction runs after the reply's response ends; keep the function alive for it.
    waitUntil: (task) => waitUntil(task),
  },
});

export default getRequestListener(new Hono().route('/api', app).fetch);
