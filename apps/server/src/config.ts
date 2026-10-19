import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { DatabaseTarget } from './db/client';

/** Repository root; relative path settings resolve against it. */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  /** Public origin used in private-asset URLs. Unset: the request's own origin. */
  PUBLIC_SERVER_URL: z.url({ protocol: /^https?$/ }).optional(),
  PRIVATE_ASSETS_DIR: z.string().default('private-assets'),
  COMPANION_ASSET_MANIFEST: z.string().default('config/companion-assets.local.json'),
  /** Character overrides (deep partial per companion id), merged onto the presets. */
  COMPANIONS_CONFIG: z.string().default('config/companions.local.json'),
  /** Local character editor endpoints (`/dev/companions`); localhost requests only. */
  DEV_EDITOR: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Comma-separated browser origins allowed by CORS (the Expo web dev server by default). */
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  /** Chat provider. Only `anthropic` is implemented; the key itself is read by the SDK. */
  CHAT_PRIMARY_PROVIDER: z.enum(['anthropic']).default('anthropic'),
  CHAT_PRIMARY_MODEL: z.string().default('claude-opus-5-5'),
  /** Reasoning effort for chat replies. Casual texting does not need deep thinking. */
  CHAT_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  /** Cheap secondary model (memory extraction, eval judge). */
  MEMORY_MODEL: z.string().default('claude-haiku-5-5'),
  /** Hosted Postgres (Supabase session pooler URI). Unset: local PGlite in `PGLITE_DIR`. */
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL')
    .optional(),
  PGLITE_DIR: z.string().default('local-data/pglite'),
  /** HMAC secret for session tokens. Required with DATABASE_URL; generated locally otherwise. */
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  /** `true`: chat sends return 503 (global spend kill switch). */
  KILL_SWITCH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Chat messages per user per minute. */
  RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(1000).default(20),
  NODE_ENV: z.string().default('development'),
});

export interface ChatConfig {
  provider: 'anthropic';
  model: string;
  effort: 'low' | 'medium' | 'high';
  memoryModel: string;
}

export interface ServerConfig {
  port: number;
  publicServerUrl: string | undefined;
  privateAssetsDir: string;
  manifestPath: string;
  companionsConfigPath: string;
  devEditor: boolean;
  corsOrigins: string[];
  chat: ChatConfig;
  database: DatabaseTarget;
  /** Unset: `index.ts` resolves a local secret (PGlite only). */
  sessionSecret: string | undefined;
  killSwitch: boolean;
  rateLimitPerMin: number;
  /** Development: CORS also allows any http://localhost or 127.0.0.1 port. */
  allowLocalhostOrigins: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  // Treat empty values (e.g. `PUBLIC_SERVER_URL=` in .env) as unset.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const parsed = EnvSchema.safeParse(present);
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
  }
  const vars = parsed.data;
  return {
    port: vars.PORT,
    publicServerUrl: vars.PUBLIC_SERVER_URL?.replace(/\/+$/, ''),
    privateAssetsDir: path.resolve(REPO_ROOT, vars.PRIVATE_ASSETS_DIR),
    manifestPath: path.resolve(REPO_ROOT, vars.COMPANION_ASSET_MANIFEST),
    companionsConfigPath: path.resolve(REPO_ROOT, vars.COMPANIONS_CONFIG),
    devEditor: vars.DEV_EDITOR,
    corsOrigins: vars.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    chat: {
      provider: vars.CHAT_PRIMARY_PROVIDER,
      model: vars.CHAT_PRIMARY_MODEL,
      effort: vars.CHAT_EFFORT,
      memoryModel: vars.MEMORY_MODEL,
    },
    database: vars.DATABASE_URL
      ? { kind: 'postgres', url: vars.DATABASE_URL }
      : { kind: 'pglite', dataDir: path.resolve(REPO_ROOT, vars.PGLITE_DIR) },
    sessionSecret: vars.SESSION_SECRET,
    killSwitch: vars.KILL_SWITCH,
    rateLimitPerMin: vars.RATE_LIMIT_PER_MIN,
    allowLocalhostOrigins: vars.NODE_ENV !== 'production',
  };
}
