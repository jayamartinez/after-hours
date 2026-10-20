import { CompanionAssetManifestSchema, type CompanionAssetManifest } from '@after-hours/contracts';
import { z } from 'zod';

import { createCachedFileLoader, parseJson } from '../files/cached-file';

export type Warn = (message: string) => void;

/** Parses manifest text. Invalid JSON or schema logs a warning and yields `null` (defaults apply). */
export function parseManifest(
  text: string,
  source: string,
  knownIds: readonly string[],
  warn: Warn,
): CompanionAssetManifest | null {
  const json = parseJson(text);
  if (!json.ok) {
    warn(
      `[assets] Ignoring ${source}: invalid JSON (${json.reason}). No companion images will show.`,
    );
    return null;
  }

  const result = CompanionAssetManifestSchema.safeParse(json.value);
  if (!result.success) {
    warn(
      `[assets] Ignoring ${source}: it does not match the manifest schema. No companion images will show.\n${z.prettifyError(result.error)}`,
    );
    return null;
  }

  const unknown = Object.keys(result.data).filter((id) => !knownIds.includes(id));
  if (unknown.length > 0) {
    warn(`[assets] ${source}: ignoring unknown companion id(s): ${unknown.join(', ')}.`);
  }
  return result.data;
}

/** Manifest loader, re-read when the file's mtime or size changes. */
export function createManifestLoader(
  filePath: string,
  knownIds: readonly string[],
  warn: Warn,
): () => CompanionAssetManifest | null {
  return createCachedFileLoader(
    filePath,
    (text) => parseManifest(text, filePath, knownIds, warn),
    (reason) => {
      warn(`[assets] Could not read ${filePath} (${reason}). No companion images will show.`);
      return null;
    },
  );
}
