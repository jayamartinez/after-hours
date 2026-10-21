import { presets } from '@after-hours/companions';
import { getRequestListener } from '@hono/node-server';
import { list } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';

import { createApp } from './app';
import { createBlobManifestLoader } from './assets/blob-manifest';
import { resolveSessionSecret } from './auth/secret';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { createChatModel, createMemoryModel } from './providers';

/**
 * Vercel Function entry (D-047): the whole API as one streaming Node function under
 * `/api`, next to the static web app on the same domain. `scripts/build-vercel.mjs`
 * bundles this file. Configuration comes from Project Settings (no .env file, no local
 * files): DATABASE_URL and SESSION_SECRET are required, and migrations run from a developer
 * machine (`pnpm db:migrate`). Photos are the files in the project's Vercel Blob store named
 * by slot (`roy/hero.jpg`, see `assets/blob-manifest.ts`), unless COMPANION_ASSETS_JSON is set.
 */
const config = loadConfig(process.env);
const database = openDatabase(config.database);

// BLOB_READ_WRITE_TOKEN is added by Vercel when a Blob store is connected to the project.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const blobPhotos =
  blobToken && !config.manifestJson
    ? createBlobManifestLoader(
        async () => (await list({ token: blobToken, limit: 1000 })).blobs,
        presets.map((preset) => preset.id),
        console.warn,
      )
    : null;
// The first request after a cold start already has the photos.
await blobPhotos?.ready;

const app = createApp(config, console.warn, {
  loadManifest: blobPhotos?.load,
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
