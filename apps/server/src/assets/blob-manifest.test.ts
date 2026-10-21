import { CompanionAssetManifestSchema } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import { createBlobManifestLoader, manifestFromBlobs, type BlobFile } from './blob-manifest';

const file = (pathname: string, minutesAgo = 0): BlobFile => ({
  pathname,
  url: `https://store.public.blob.vercel-storage.com/${pathname}`,
  uploadedAt: new Date(Date.now() - minutesAgo * 60_000),
});
const ids = ['roy', 'roya'];

describe('manifestFromBlobs', () => {
  it('maps file names to photo slots', () => {
    const manifest = manifestFromBlobs(
      [file('roy/hero.jpg'), file('roy/avatar.PNG'), file('roya/gallery-2.webp')],
      ids,
    );
    expect(manifest.roy?.hero?.src).toContain('roy/hero.jpg');
    expect(manifest.roy?.avatar?.src).toContain('roy/avatar.PNG');
    expect(manifest.roya?.gallery).toEqual([null, { src: expect.stringContaining('gallery-2') }]);
    expect(CompanionAssetManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('uses the newest upload of a slot', () => {
    const manifest = manifestFromBlobs([file('roy/hero.jpg', 10), file('roy/hero.png', 1)], ids);
    expect(manifest.roy?.hero?.src).toContain('roy/hero.png');
  });

  it('ignores unknown companions, slots, and file types', () => {
    const manifest = manifestFromBlobs(
      [file('bob/hero.jpg'), file('roy/banner.jpg'), file('roy/hero.gif'), file('hero.jpg')],
      ids,
    );
    expect(manifest).toEqual({});
  });
});

describe('createBlobManifestLoader', () => {
  it('serves the first listing once ready and keeps it when a refresh fails', async () => {
    let calls = 0;
    const warnings: string[] = [];
    const loader = createBlobManifestLoader(
      async () => {
        calls += 1;
        if (calls > 1) throw new Error('offline');
        return [file('roy/avatar.jpg')];
      },
      ids,
      (message) => warnings.push(message),
      0,
    );
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    await loader.ready;
    await tick();
    // Stale: this read starts a refresh, which fails.
    expect(loader.load()?.roy?.avatar).toBeDefined();
    await tick();
    expect(loader.load()?.roy?.avatar).toBeDefined();
    expect(warnings.some((w) => w.includes('offline'))).toBe(true);
  });
});
