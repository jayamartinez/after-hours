import type { CompanionAssetManifest, ManifestCompanionEntry } from '@after-hours/contracts';

import type { Warn } from './manifest';

/**
 * Companion photos from Vercel Blob by file name (D-047): upload `roy/hero.jpg`,
 * `roy/avatar.png`, `roy/gallery-1.jpg`, `roy/gallery-2.jpg` (and the same for `roya/`)
 * and they show, no manifest to edit. A newer upload of the same slot replaces the old one.
 */

export interface BlobFile {
  pathname: string;
  url: string;
  uploadedAt: Date;
}

const SLOT = /^([a-z0-9-]+)\/(hero|avatar|gallery-1|gallery-2)\.(jpe?g|png|webp|avif)$/i;

/** How often the server re-lists the store, so new uploads show without a redeploy. */
export const BLOB_REFRESH_MS = 60_000;

export function manifestFromBlobs(
  files: readonly BlobFile[],
  knownIds: readonly string[],
): CompanionAssetManifest {
  const newestFirst = [...files].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  const manifest: Record<string, ManifestCompanionEntry> = {};
  for (const file of newestFirst) {
    const match = SLOT.exec(file.pathname);
    if (!match) continue;
    const id = match[1]!.toLowerCase();
    const slot = match[2]!.toLowerCase();
    if (!knownIds.includes(id)) continue;
    const entry = (manifest[id] ??= {});
    const image = { src: file.url };
    if (slot === 'hero' || slot === 'avatar') {
      entry[slot] ??= image;
      continue;
    }
    const index = slot === 'gallery-1' ? 0 : 1;
    const gallery = (entry.gallery ??= [null, null]);
    gallery[index] ??= image;
  }
  return manifest;
}

/**
 * Keeps a manifest built from the store's files, refreshed in the background. `ready`
 * resolves after the first listing (or its failure, which leaves the default images).
 */
export function createBlobManifestLoader(
  listFiles: () => Promise<BlobFile[]>,
  knownIds: readonly string[],
  warn: Warn,
  refreshMs = BLOB_REFRESH_MS,
) {
  let manifest: CompanionAssetManifest | null = null;
  let fetchedAt = 0;
  let inFlight: Promise<void> | null = null;

  const refresh = () => {
    inFlight ??= listFiles()
      .then((files) => {
        manifest = manifestFromBlobs(files, knownIds);
      })
      .catch((error: unknown) => {
        warn(
          `[assets] Could not list Vercel Blob photos (${error instanceof Error ? error.message : String(error)}). Keeping the last photos.`,
        );
      })
      .finally(() => {
        fetchedAt = Date.now();
        inFlight = null;
      });
    return inFlight;
  };

  const ready = refresh();
  return {
    ready,
    load: (): CompanionAssetManifest | null => {
      if (Date.now() - fetchedAt > refreshMs) void refresh();
      return manifest;
    },
  };
}
