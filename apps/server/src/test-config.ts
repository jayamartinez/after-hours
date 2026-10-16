import path from 'node:path';

import type { ServerConfig } from './config';

/** Server config rooted in a temp directory, for route tests. */
export function testConfig(workDir: string, overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    publicServerUrl: undefined,
    privateAssetsDir: path.join(workDir, 'private-assets'),
    manifestPath: path.join(workDir, 'manifest.json'),
    companionsConfigPath: path.join(workDir, 'companions.local.json'),
    devEditor: false,
    corsOrigins: ['http://localhost:8081'],
    ...overrides,
  };
}
