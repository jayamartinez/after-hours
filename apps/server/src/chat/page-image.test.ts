import { describe, expect, it, vi } from 'vitest';

import {
  assertPublicHttpsUrl,
  createHttpsFetch,
  extractPreview,
  findPageImage,
  guardedLookup,
  isBlockedHost,
  isPublicAddress,
  PageImageFailure,
} from './page-image';

const publicLookup = async () => ['93.184.216.34'];

/** Fake fetch from a URL (or `METHOD url`) → response table. */
function fakeFetch(table: Record<string, () => Response>) {
  const calls: string[] = [];
  const requests: { method: string; url: string; headers: Record<string, string> }[] = [];
  const fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method ?? 'GET';
    calls.push(url);
    requests.push({ method, url, headers: (init?.headers ?? {}) as Record<string, string> });
    const make = table[`${method} ${url}`] ?? table[url];
    if (!make) throw new Error(`unexpected fetch ${method} ${url}`);
    return make();
  }) as typeof globalThis.fetch;
  return { fetch, calls, requests };
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
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::',
      '::7f00:1',
      '::5db8:d822',
      '64:ff9b::a9fe:a9fe',
      '64:ff9b:1::1',
      '2002:7f00:1::1',
      '2002:a9fe:a9fe::',
      'fec0::1',
      'ff02::1',
      '2001:db8::1',
      '2001::1',
      '3fff::1',
      '100::1',
      'fe80::1%en0',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of [
      '93.184.216.34',
      '2606:4700::6810:85e5',
      '2a00:1450:4001:80b::200e',
      '::ffff:5db8:d822',
      '64:ff9b::5db8:d822',
      '2002:5db8:d822::1',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });
});

describe('isBlockedHost', () => {
  it('matches a blocked domain and its subdomains, not lookalikes', () => {
    const blocked = ['pornhub.com'];
    expect(isBlockedHost('pornhub.com', blocked)).toBe(true);
    expect(isBlockedHost('WWW.Pornhub.com.', blocked)).toBe(true);
    expect(isBlockedHost('notpornhub.com', blocked)).toBe(false);
    expect(isBlockedHost('pornhub.com.example.org', blocked)).toBe(false);
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

  it('rejects IPv6 forms of private and metadata addresses, and allows public ones', async () => {
    const unused = async () => {
      throw new Error('IP literals are never resolved');
    };
    for (const url of [
      'https://[::ffff:127.0.0.1]/',
      'https://[::ffff:a9fe:a9fe]/latest/meta-data',
      'https://[::127.0.0.1]/',
      'https://[64:ff9b::a9fe:a9fe]/',
      'https://[fec0::1]/',
      'https://[::1]/',
      'https://[fe80::1]/',
      'https://[fd00::1]/',
      'https://[2002:7f00:1::]/',
      'https://[2001:db8::1]/',
      'https://[::]/',
    ]) {
      await expect(assertPublicHttpsUrl(url, unused), url).rejects.toMatchObject({
        reason: 'blocked_url',
      });
    }
    for (const url of [
      'https://93.184.216.34/',
      'https://[2606:4700::6810:85e5]/',
      'https://[64:ff9b::5db8:d822]/',
    ]) {
      await expect(assertPublicHttpsUrl(url, unused), url).resolves.toBeInstanceOf(URL);
    }
  });

  it('refuses blocked sites before resolving them', async () => {
    const unused = async () => {
      throw new Error('blocked sites are never resolved');
    };
    await expect(
      assertPublicHttpsUrl('https://cdn.bad.example/a.jpg', unused, ['bad.example']),
    ).rejects.toMatchObject({ reason: 'blocked_site' });
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

  it('accepts a direct link to an image', async () => {
    const { fetch } = fakeFetch({ 'https://cdn.example.com/levi.png': () => image('image/png') });
    await expect(
      findPageImage('https://cdn.example.com/levi.png', { fetch, lookup: publicLookup }),
    ).resolves.toEqual({
      url: 'https://cdn.example.com/levi.png',
      pageUrl: 'https://cdn.example.com/levi.png',
      title: '',
    });
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

  it('applies the blocklist to the page, every redirect, and the image', async () => {
    const blockedDomains = ['bad.example'];
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const viaRedirect = fakeFetch({
      'https://a.example.com/x': () => redirect('https://www.bad.example/y'),
    });
    await expect(
      findPageImage('https://a.example.com/x', {
        fetch: viaRedirect.fetch,
        lookup: publicLookup,
        blockedDomains,
      }),
    ).rejects.toMatchObject({ reason: 'blocked_site' });
    expect(viaRedirect.calls).toEqual(['https://a.example.com/x']);

    const viaImage = fakeFetch({
      'https://a.example.com/x': () =>
        html('<meta property="og:image" content="https://img.bad.example/p.jpg">'),
    });
    await expect(
      findPageImage('https://a.example.com/x', {
        fetch: viaImage.fetch,
        lookup: publicLookup,
        blockedDomains,
      }),
    ).rejects.toMatchObject({ reason: 'blocked_site' });
    expect(viaImage.calls).toEqual(['https://a.example.com/x']);
  });

  it('falls back to a one-byte GET when the image host rejects HEAD', async () => {
    const page = () => html('<meta property="og:image" content="https://cdn.example.com/a.jpg">');
    const ranged = (total: number) => () =>
      new Response('x', {
        status: 206,
        headers: { 'content-type': 'image/jpeg', 'content-range': `bytes 0-0/${total}` },
      });
    const ok = fakeFetch({
      'GET https://e.example.com/': page,
      'HEAD https://cdn.example.com/a.jpg': () => new Response(null, { status: 405 }),
      'GET https://cdn.example.com/a.jpg': ranged(2048),
    });
    await expect(
      findPageImage('https://e.example.com/', { fetch: ok.fetch, lookup: publicLookup }),
    ).resolves.toMatchObject({ url: 'https://cdn.example.com/a.jpg' });
    expect(ok.requests.at(-1)).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({ range: 'bytes=0-0' }),
    });

    const huge = fakeFetch({
      'GET https://e.example.com/': page,
      'HEAD https://cdn.example.com/a.jpg': () => new Response(null, { status: 403 }),
      'GET https://cdn.example.com/a.jpg': ranged(50 * 1024 * 1024),
    });
    await expect(
      findPageImage('https://e.example.com/', { fetch: huge.fetch, lookup: publicLookup }),
    ).rejects.toMatchObject({ reason: 'not_an_image' });
  });

  it('cancels the bodies of redirect and error responses', async () => {
    const cancelled: string[] = [];
    const tracked = (name: string, status: number, headers: Record<string, string> = {}) =>
      new Response(
        new ReadableStream({
          cancel: () => {
            cancelled.push(name);
          },
        }),
        { status, headers },
      );
    const { fetch } = fakeFetch({
      'https://a.example.com/x': () =>
        tracked('redirect', 302, { location: 'https://b.example.com/y' }),
      'https://b.example.com/y': () => tracked('error', 500),
    });
    await expect(
      findPageImage('https://a.example.com/x', { fetch, lookup: publicLookup }),
    ).rejects.toMatchObject({ reason: 'fetch_failed' });
    expect(cancelled).toEqual(['redirect', 'error']);
  });
});

describe('guarded connections', () => {
  const lookupOnce = (
    resolve: (hostname: string) => Promise<string[]>,
    all: boolean,
  ): Promise<unknown> =>
    new Promise((done, fail) => {
      guardedLookup(resolve)('example.com', { all }, (error, address) =>
        error ? fail(error) : done(address),
      );
    });

  it('hands the socket only public addresses, resolved at connect time', async () => {
    await expect(lookupOnce(publicLookup, false)).resolves.toBe('93.184.216.34');
    await expect(lookupOnce(publicLookup, true)).resolves.toEqual([
      { address: '93.184.216.34', family: 4 },
    ]);
    await expect(lookupOnce(async () => ['169.254.169.254'], true)).rejects.toMatchObject({
      reason: 'blocked_url',
    });
    await expect(
      lookupOnce(async () => ['93.184.216.34', '::ffff:7f00:1'], false),
    ).rejects.toMatchObject({ reason: 'blocked_url' });
    await expect(lookupOnce(async () => [], false)).rejects.toMatchObject({
      reason: 'blocked_url',
    });
  });

  it('gives up on a DNS answer that never comes', async () => {
    vi.useFakeTimers();
    try {
      const pending = lookupOnce(() => new Promise<string[]>(() => {}), false);
      const settled = expect(pending).rejects.toMatchObject({ reason: 'fetch_failed' });
      await vi.advanceTimersByTimeAsync(3_000);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses to connect when the name rebinds to a private address after the check', async () => {
    const answers = [['93.184.216.34'], ['127.0.0.1']];
    const rebinding = async () => answers.shift() ?? ['127.0.0.1'];
    await expect(
      findPageImage('https://rebind.example.com/', {
        lookup: rebinding,
        fetch: createHttpsFetch(rebinding),
      }),
    ).rejects.toMatchObject({ reason: 'blocked_url' });
    expect(answers).toEqual([]);
  });
});
