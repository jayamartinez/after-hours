import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadConfig, REPO_ROOT } from '../config';

import { openDatabase } from './client';

/**
 * `pnpm db:migrate`: applies `apps/server/drizzle/*.sql` to DATABASE_URL (hosted Postgres)
 * or, when it is unset, to the local PGlite store. Stop the dev server first when using
 * PGlite: only one process can open its data directory.
 */
const envFile = path.join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig(process.env);
const database = openDatabase(config.database);
const where =
  config.database.kind === 'pglite' ? `PGlite at ${config.database.dataDir}` : 'DATABASE_URL';
try {
  await database.migrate();
  console.log(`[db] migrations applied to ${where}`);
} finally {
  await database.close();
}
