import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

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
});

export interface ServerConfig {
  port: number;
  publicServerUrl: string | undefined;
  privateAssetsDir: string;
  manifestPath: string;
  companionsConfigPath: string;
  devEditor: boolean;
  corsOrigins: string[];
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
  };
}
