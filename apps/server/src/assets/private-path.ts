import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import { isSafeRelativeSrc } from '@after-hours/contracts';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/** Content type for an allowed image extension, or `undefined` if the extension is not served. */
export function imageContentType(filePath: string): string | undefined {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()];
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolves `relPath` to an existing image file inside `rootDir`, or returns `null`.
 * Rejects `..`/absolute paths, non-image extensions, and symlinks that escape the root.
 */
export function resolvePrivateAssetPath(rootDir: string, relPath: string): string | null {
  if (!isSafeRelativeSrc(relPath) || imageContentType(relPath) === undefined) return null;

  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, relPath);
  if (!isInside(root, candidate)) return null;

  try {
    const realRoot = realpathSync(root);
    const realFile = realpathSync(candidate);
    if (!isInside(realRoot, realFile) || !statSync(realFile).isFile()) return null;
    return realFile;
  } catch {
    return null;
  }
}
