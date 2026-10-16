/**
 * Bundled default art for the mobile app, keyed by the `asset` key a character's image
 * slot names (e.g. "roy/hero"). Static `require()` calls let Metro bundle each file on
 * iOS and web. Only the app imports this entry (`@after-hours/companions/default-images`);
 * the server never does.
 */

/** Metro asset reference (a module id on native, an asset object or URL on web). */
export type BundledImage = number | string | { uri: string };

export const defaultImages: Readonly<Record<string, BundledImage>> = {
  'roy/hero': require('../assets/roy/hero.jpg'),
  'roy/avatar': require('../assets/roy/avatar.jpg'),
  'roy/gallery-0': require('../assets/roy/gallery-0.jpg'),
  'roy/gallery-1': require('../assets/roy/gallery-1.jpg'),
  'roya/hero': require('../assets/roya/hero.jpg'),
  'roya/avatar': require('../assets/roya/avatar.jpg'),
  'roya/gallery-0': require('../assets/roya/gallery-0.jpg'),
  'roya/gallery-1': require('../assets/roya/gallery-1.jpg'),
};
