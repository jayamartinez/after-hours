import { defaultSlot } from '@after-hours/companions';
import {
  isAllowedRemoteSrc,
  type CharacterConfig,
  type CompanionAssetManifest,
  type CompanionImages,
  type ImageSlot,
  type ImageSlotDefault,
  type ManifestImageEntry,
} from '@after-hours/contracts';

import type { Warn } from './manifest';
import { resolvePrivateAssetPath } from './private-path';

export const PRIVATE_ASSETS_ROUTE = '/assets/private';

export interface ResolveContext {
  /** Origin used to build private-asset URLs, without a trailing slash. */
  baseUrl: string;
  privateAssetsDir: string;
  warn: Warn;
}

function resolveSrc(src: string, ctx: ResolveContext): string | null {
  if (isAllowedRemoteSrc(src)) return src;
  if (resolvePrivateAssetPath(ctx.privateAssetsDir, src) === null) return null;
  const encoded = src.split('/').map(encodeURIComponent).join('/');
  return `${ctx.baseUrl}${PRIVATE_ASSETS_ROUTE}/${encoded}`;
}

/** Override → bundled default (`uri: null`). The override's focal/alt apply only to its own image. */
function resolveSlot(
  fallback: ImageSlotDefault,
  override: ManifestImageEntry | null | undefined,
  label: string,
  ctx: ResolveContext,
): ImageSlot {
  const fallbackSlot = defaultSlot(fallback);
  if (!override) return fallbackSlot;

  const uri = resolveSrc(override.src, ctx);
  if (uri === null) {
    ctx.warn(
      `[assets] ${label}: "${override.src}" is not a file in PRIVATE_ASSETS_DIR; using default art.`,
    );
    return fallbackSlot;
  }
  return {
    uri,
    asset: fallback.asset,
    focal: override.focal ?? fallback.focal,
    alt: override.alt ?? fallback.alt,
  };
}

export function resolveCompanionImages(
  character: CharacterConfig,
  manifest: CompanionAssetManifest | null,
  ctx: ResolveContext,
): CompanionImages {
  const entry = manifest?.[character.id];
  const { hero, avatar, gallery } = character.images;
  const id = character.id;
  return {
    hero: resolveSlot(hero, entry?.hero, `${id}.hero`, ctx),
    avatar: resolveSlot(avatar, entry?.avatar, `${id}.avatar`, ctx),
    gallery: [
      resolveSlot(gallery[0], entry?.gallery?.[0], `${id}.gallery.0`, ctx),
      resolveSlot(gallery[1], entry?.gallery?.[1], `${id}.gallery.1`, ctx),
    ],
  };
}
