import { z } from 'zod';

import { CompanionIdSchema, FocalPointSchema } from './companion';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `https://` anywhere, or plain `http://` only for a local development host. */
export function isAllowedRemoteSrc(src: string): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
}

/**
 * A relative path inside PRIVATE_ASSETS_DIR: forward slashes, no leading slash,
 * no `.`/`..` segments, no drive letters or URL schemes.
 */
export function isSafeRelativeSrc(src: string): boolean {
  if (src.length === 0 || src.length > 512) return false;
  if (src.startsWith('/') || src.includes('\\') || src.includes('\0') || src.includes(':')) {
    return false;
  }
  return src.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

const looksLikeUrl = (src: string) => /^[a-z][a-z0-9+.-]*:/i.test(src);

export const ManifestImageSrcSchema = z
  .string()
  .refine((src) => (looksLikeUrl(src) ? isAllowedRemoteSrc(src) : isSafeRelativeSrc(src)), {
    message:
      'src must be a relative path inside PRIVATE_ASSETS_DIR (no "..") or an https:// URL (http:// only for localhost)',
  });

export const ManifestImageEntrySchema = z.strictObject({
  src: ManifestImageSrcSchema,
  focal: FocalPointSchema.optional(),
  alt: z.string().min(1).optional(),
});

export const ManifestCompanionEntrySchema = z.strictObject({
  hero: ManifestImageEntrySchema.optional(),
  avatar: ManifestImageEntrySchema.optional(),
  /** Up to two entries; `null` keeps that index's default. */
  gallery: z.array(ManifestImageEntrySchema.nullable()).max(2).optional(),
});

/** Override manifest (`COMPANION_ASSET_MANIFEST`), keyed by companion id. */
export const CompanionAssetManifestSchema = z.record(
  CompanionIdSchema,
  ManifestCompanionEntrySchema,
);

export type ManifestImageEntry = z.infer<typeof ManifestImageEntrySchema>;
export type ManifestCompanionEntry = z.infer<typeof ManifestCompanionEntrySchema>;
export type CompanionAssetManifest = z.infer<typeof CompanionAssetManifestSchema>;
