import { describe, expect, it } from 'vitest';

import {
  assertPublicHttpsUrl,
  extractPreview,
  findPageImage,
  isPublicAddress,
  PageImageFailure,
} from './page-image';

const publicLookup = async () => ['93.184.216.34'];

/** Fake fetch from a URL → response table. */
function fakeFetch(table: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetch = (async (input: URL | string) => {
    const url = input.toString();
    calls.push(url);
    const make = table[url];
    if (!make) throw new Error(`unexpected fetch ${url}`);
    return make();
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
const image = (type = 'image/jpeg', length = '1000') =>
  new Response(null, { status: 200, headers: { 'content-type': type, 'content-length': length } });

describe('isPublicAddress', () => {
  it('rejects loopback, private, link-local, metadata, and mapped private addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700::6810:85e5')).toBe(true);
  });
});

describe('assertPublicHttpsUrl', () => {
  const reject = (url: string, lookup = publicLookup) =>
    expect(assertPublicHttpsUrl(url, lookup)).rejects.toBeInstanceOf(PageImageFailure);

  it('allows public https pages only', async () => {
    await expect(
      assertPublicHttpsUrl('https://example.com/a', publicLookup),
    ).resolves.toBeInstanceOf(URL);
    await reject('http://example.com/a');
    await reject('https://user:pw@example.com/');
    await reject('https://example.com:8443/');
    await reject('https://localhost/');
    await reject('https://169.254.169.254/latest/meta-data');
    await reject('file:///etc/passwd');
    await reject('not a url');
  });

  it('rejects a public-looking name that resolves to a private address', async () => {
    await reject('https://internal.example.com/', async () => ['10.0.0.5']);
    await reject('https://mixed.example.com/', async () => ['93.184.216.34', '127.0.0.1']);
  });
});

describe('extractPreview', () => {
  it('prefers og:image, decodes entities, and falls back to the title tag', () => {
    expect(
      extractPreview(
        '<head><title>Fallback</title><meta content="https://cdn.x/a.jpg?w=1&amp;h=2" property="og:image"><meta property="og:title" content="Eren &amp; Mikasa"></head>',
      ),
    ).toEqual({ image: 'https://cdn.x/a.jpg?w=1&h=2', title: 'Eren & Mikasa' });
    expect(
      extractPreview("<meta name='twitter:image' content='/pic.png'><title> Hi  there </title>"),
    ).toEqual({
      image: '/pic.png',
      title: 'Hi there',
    });
    expect(extractPreview('<link rel="image_src" href="https://x/y.png">').image).toBe(
      'https://x/y.png',
    );
    expect(extractPreview('<p>nothing</p>')).toEqual({ image: undefined, title: '' });
  });
});

describe('findPageImage', () => {
  it('returns the preview image, resolving relative URLs against the page', async () => {
    const { fetch } = fakeFetch({
      'https://pins.example.com/pin/1': () =>
        html('<meta property="og:image" content="/img/eren.jpg"><title>Eren pfp</title>'),
      'https://pins.example.com/img/eren.jpg': () => image(),
    });
    await expect(
      findPageImage('https://pins.example.com/pin/1', { fetch, lookup: publicLookup }),
    ).resolves.toEqual({
      url: 'https://pins.example.com/img/eren.jpg',
      pageUrl: 'https://pins.example.com/pin/1',
      title: 'Eren pfp',
    });
  });

  it('follows a redirect only to another public https address', async () => {
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const ok = fakeFetch({
      'https://a.example.com/x': () => redirect('https://b.example.com/y'),
      'https://b.example.com/y': () =>
        html('<meta property="og:image" content="https://b.example.com/p.webp">'),
      'https://b.example.com/p.webp': () => image('image/webp'),
    });
    expect(
      (await findPageImage('https://a.example.com/x', { fetch: ok.fetch, lookup: publicLookup }))
        .pageUrl,
    ).toBe('https://b.example.com/y');

    const evil = fakeFetch({
      'https://a.example.com/x': () => redirect('http://169.254.169.254/latest/meta-data'),
    });
    await expect(
      findPageImage('https://a.example.com/x', { fetch: evil.fetch, lookup: publicLookup }),
    ).rejects.toMatchObject({ reason: 'blocked_url' });
    expect(evil.calls).toEqual(['https://a.example.com/x']);
  });

  it('refuses pages without a preview, SVGs, and oversized images', async () => {
    const page = (img: string) => () => html(`<meta property="og:image" content="${img}">`);
    const cases: [Record<string, () => Response>, string][] = [
      [{ 'https://e.example.com/': () => html('<p>hi</p>') }, 'no_image'],
      [
        {
          'https://e.example.com/': page('https://e.example.com/a.svg'),
          'https://e.example.com/a.svg': () => image('image/svg+xml'),
        },
        'not_an_image',
      ],
      [
        {
          'https://e.example.com/': page('https://e.example.com/big.jpg'),
          'https://e.example.com/big.jpg': () => image('image/jpeg', String(50 * 1024 * 1024)),
        },
        'not_an_image',
      ],
      [{ 'https://e.example.com/': () => new Response('nope', { status: 404 }) }, 'fetch_failed'],
    ];
    for (const [table, reason] of cases) {
      const { fetch } = fakeFetch(table);
      await expect(
        findPageImage('https://e.example.com/', { fetch, lookup: publicLookup }),
      ).rejects.toMatchObject({ reason });
    }
  });
});
