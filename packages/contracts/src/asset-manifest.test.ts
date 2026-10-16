import { describe, expect, it } from 'vitest';

import { CompanionAssetManifestSchema } from './asset-manifest';

const parse = (value: unknown) => CompanionAssetManifestSchema.safeParse(value);

describe('CompanionAssetManifestSchema', () => {
  it('accepts relative and https sources with optional focal and alt', () => {
    const result = parse({
      roy: {
        hero: { src: 'roy/hero.jpg', focal: [0.5, 0.3], alt: 'Roy at his desk' },
        gallery: [null, { src: 'https://cdn.example.com/roy-1.jpg' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['../secret.jpg'],
    ['roy/../../etc/passwd'],
    ['/abs/hero.jpg'],
    ['C:/hero.jpg'],
    ['roy\\hero.jpg'],
    ['http://cdn.example.com/x.jpg'],
    ['file:///etc/passwd'],
    ['javascript:alert(1)'],
  ])('rejects unsafe src %s', (src) => {
    expect(parse({ roy: { hero: { src } } }).success).toBe(false);
  });

  it('allows plain http only for localhost', () => {
    expect(parse({ roy: { hero: { src: 'http://localhost:9000/a.jpg' } } }).success).toBe(true);
  });

  it('rejects out-of-range focal points and unknown slot keys', () => {
    expect(parse({ roy: { hero: { src: 'a.jpg', focal: [1.2, 0] } } }).success).toBe(false);
    expect(parse({ roy: { banner: { src: 'a.jpg' } } }).success).toBe(false);
  });

  it('rejects more than two gallery entries', () => {
    const entry = { src: 'a.jpg' };
    expect(parse({ roy: { gallery: [entry, entry, entry] } }).success).toBe(false);
  });
});
