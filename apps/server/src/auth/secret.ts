import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ServerConfig } from '../config';

/**
 * `SESSION_SECRET`, or for local PGlite development a random secret persisted next to the
 * database (git-ignored `local-data/`), so sessions survive server restarts with zero setup.
 * A hosted database always requires an explicit secret.
 */
export function resolveSessionSecret(config: ServerConfig): string {
  if (config.sessionSecret) return config.sessionSecret;
  if (config.database.kind !== 'pglite' || !config.database.dataDir) {
    throw new Error('SESSION_SECRET is required when DATABASE_URL is set (32+ characters).');
  }
  const file = path.join(path.dirname(config.database.dataDir), 'session-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(path.dirname(file), { recursive: true });
  const secret = randomBytes(32).toString('base64url');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
