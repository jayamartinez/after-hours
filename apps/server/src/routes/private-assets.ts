import { readFile } from 'node:fs/promises';

import { isSafeRelativeSrc } from '@after-hours/contracts';
import { Hono } from 'hono';

import { imageContentType, resolvePrivateAssetPath } from '../assets/private-path';
import { PRIVATE_ASSETS_ROUTE } from '../assets/resolve-images';

/**
 * Serves image overrides from PRIVATE_ASSETS_DIR. Anyone who can reach the server can
 * fetch these files, so only enable private assets on private deployments.
 */
export function privateAssetRoutes(privateAssetsDir: string) {
  return new Hono().get(`${PRIVATE_ASSETS_ROUTE}/*`, async (c) => {
    // Use the raw pathname so encoded separators (%2F) are decoded once, here, and then checked.
    const raw = new URL(c.req.url).pathname.slice(PRIVATE_ASSETS_ROUTE.length + 1);
    let relPath: string;
    try {
      relPath = decodeURIComponent(raw);
    } catch {
      return c.text('Bad request', 400);
    }
    if (!isSafeRelativeSrc(relPath)) return c.text('Bad request', 400);

    const filePath = resolvePrivateAssetPath(privateAssetsDir, relPath);
    const contentType = filePath ? imageContentType(filePath) : undefined;
    if (!filePath || !contentType) return c.text('Not found', 404);

    const body = new Uint8Array(await readFile(filePath));
    return c.body(body, 200, {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
  });
}
