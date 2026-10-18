import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { presets } from '@after-hours/companions';
import type { CompanionAssetManifest } from '@after-hours/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createManifestLoader, parseManifest } from './manifest';
import { resolvePrivateAssetPath } from './private-path';
import { resolveCompanionImages } from './resolve-images';

const [roy, roya] = presets;
if (!roy || !roya) throw new Error('expected Roy and Roya definitions');
const knownIds = presets.map((c) => c.id);

let workDir: string;
let assetsDir: string;
let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-assets-'));
  assetsDir = path.join(workDir, 'private-assets');
  mkdirSync(path.join(assetsDir, 'roy'), { recursive: true });
  writeFileSync(path.join(assetsDir, 'roy', 'hero.jpg'), 'jpg');
  writeFileSync(path.join(workDir, 'secret.jpg'), 'outside');
  warn = vi.fn<(message: string) => void>();
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const ctx = () => ({ baseUrl: 'http://localhost:8787', privateAssetsDir: assetsDir, warn });
const resolve = (manifest: CompanionAssetManifest | null, definition = roy) =>
  resolveCompanionImages(definition, manifest, ctx());

describe('resolveCompanionImages', () => {
  it('uses bundled defaults (uri null) with default focal and alt when there is no manifest', () => {
    const images = resolve(null);
    expect(images.hero).toEqual({
      uri: null,
      asset: 'roy/hero',
      focal: [0.5, 0.3],
      alt: 'Roy at his desk',
    });
    expect(images.gallery.map((slot) => slot.uri)).toEqual([null, null]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('serves a relative src that exists inside PRIVATE_ASSETS_DIR', () => {
    const images = resolve({ roy: { hero: { src: 'roy/hero.jpg' } } });
    expect(images.hero.uri).toBe('http://localhost:8787/assets/private/roy/hero.jpg');
  });

  it('falls back to the default when a relative src is missing', () => {
    const images = resolve({ roy: { avatar: { src: 'roy/avatar.jpg', focal: [0.1, 0.1] } } });
    expect(images.avatar).toEqual({
      uri: null,
      asset: 'roy/avatar',
      focal: [0.5, 0.26],
      alt: 'Roy, close-up',
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('uses an https src as-is', () => {
    const images = resolve(
      { roya: { gallery: [{ src: 'https://cdn.example.com/roya-0.jpg' }] } },
      roya,
    );
    expect(images.gallery[0].uri).toBe('https://cdn.example.com/roya-0.jpg');
    expect(images.gallery[1].uri).toBeNull();
  });

  it('applies override focal and alt, and keeps defaults when omitted', () => {
    const images = resolve({
      roy: {
        hero: { src: 'roy/hero.jpg', focal: [0.2, 0.8], alt: 'Custom hero' },
        gallery: [{ src: 'https://cdn.example.com/roy-0.jpg' }],
      },
    });
    expect(images.hero.focal).toEqual([0.2, 0.8]);
    expect(images.hero.alt).toBe('Custom hero');
    expect(images.gallery[0].focal).toEqual([0.55, 0.45]);
    expect(images.gallery[0].alt).toBe('Roy at a desk of glowing laptops');
  });

  it('never resolves a traversal src even if it bypassed schema validation', () => {
    const unvalidated = { roy: { hero: { src: '../secret.jpg' } } } as CompanionAssetManifest;
    expect(resolve(unvalidated).hero.uri).toBeNull();
  });
});

describe('parseManifest', () => {
  it('ignores invalid JSON with a warning', () => {
    expect(parseManifest('{ not json', 'm.json', knownIds, warn)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'));
  });

  it('ignores a manifest that fails the schema with a warning', () => {
    const text = JSON.stringify({ roy: { hero: { src: 'roy/hero.jpg', focal: [2, 0] } } });
    expect(parseManifest(text, 'm.json', knownIds, warn)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('manifest schema'));
  });

  it('rejects a traversal src at the schema level', () => {
    const text = JSON.stringify({ roy: { hero: { src: '../../package.json' } } });
    expect(parseManifest(text, 'm.json', knownIds, warn)).toBeNull();
  });

  it('ignores unknown companion ids with a warning and keeps known ones', () => {
    const text = JSON.stringify({
      zed: { hero: { src: 'zed/hero.jpg' } },
      roy: { hero: { src: 'roy/hero.jpg' } },
    });
    const manifest = parseManifest(text, 'm.json', knownIds, warn);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('zed'));
    expect(resolve(manifest).hero.uri).toContain('/assets/private/roy/hero.jpg');
    expect(resolve(manifest, roya).hero.uri).toBeNull();
  });
});

describe('createManifestLoader', () => {
  it('returns null without warning when the file does not exist', () => {
    const load = createManifestLoader(path.join(workDir, 'missing.json'), knownIds, warn);
    expect(load()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('caches by mtime/size and reloads after the file changes', () => {
    const file = path.join(workDir, 'manifest.json');
    writeFileSync(file, '{ broken');
    const load = createManifestLoader(file, knownIds, warn);
    expect(load()).toBeNull();
    expect(load()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();

    writeFileSync(file, JSON.stringify({ roy: { hero: { src: 'roy/hero.jpg' } } }));
    expect(load()?.roy?.hero?.src).toBe('roy/hero.jpg');
  });
});

describe('resolvePrivateAssetPath', () => {
  it.each([
    '../secret.jpg',
    'roy/../../secret.jpg',
    '/etc/passwd',
    'roy/hero.txt',
    'roy\\hero.jpg',
  ])('rejects %s', (rel) => {
    expect(resolvePrivateAssetPath(assetsDir, rel)).toBeNull();
  });

  it('returns the real path of an existing image', () => {
    expect(resolvePrivateAssetPath(assetsDir, 'roy/hero.jpg')).toMatch(/hero\.jpg$/);
  });
});
