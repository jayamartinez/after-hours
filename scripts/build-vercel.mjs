// Builds the whole demo for Vercel as Build Output API v3 (D-047): the Expo web export as
// static files and the API as one streaming Node function at /api. Vercel runs this as the
// project's build command and deploys `.vercel/output` as is.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel', 'output');
const fn = path.join(out, 'functions', 'api.func');

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// 1. Web app, calling the API on the same origin.
execSync('pnpm --filter @after-hours/mobile export:web', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_API_URL: '/api' },
});
cpSync(path.join(root, 'apps', 'mobile', 'dist'), path.join(out, 'static'), { recursive: true });

// 2. API bundle. PGlite (local development only) is replaced by a stub: on Vercel the
// server always uses DATABASE_URL, and PGlite's WebAssembly files are not bundled.
const pgliteStub = {
  name: 'pglite-stub',
  setup(b) {
    b.onResolve({ filter: /^@electric-sql\/pglite$/ }, () => ({
      path: 'pglite',
      namespace: 'stub',
    }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents:
        "export class PGlite { constructor() { throw new Error('PGlite is not available on Vercel. Set DATABASE_URL.'); } }\nexport const types = {};",
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: [path.join(root, 'apps', 'server', 'src', 'vercel.ts')],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  plugins: [pgliteStub],
  // Some dependencies still call require(); give the ESM bundle one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      supportsResponseStreaming: true,
      shouldAddSourcemapSupport: true,
      maxDuration: 300,
    },
    null,
    2,
  ),
);

// 3. Routing: real files first, then the API, then the single-page app.
writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`[vercel] wrote ${path.relative(root, out)}`);
