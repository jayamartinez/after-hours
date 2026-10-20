import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * The picture a web page offers for link previews (`og:image` and friends), so a companion
 * can show the user an image it found through web search without a paid image-search API
 * (D-038). The page URL comes from the model, so every request is guarded against
 * server-side request forgery: HTTPS only, public addresses only (checked on every
 * redirect), small timeouts, and a capped read.
 */

const TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_TITLE = 200;
const USER_AGENT = 'Mozilla/5.0 (compatible; AfterHoursBot/1.0; +link preview)';

export interface PageImage {
  /** The image itself (HTTPS). */
  url: string;
  /** The page it came from, after redirects. */
  pageUrl: string;
  title: string;
}

export type PageImageError = 'blocked_url' | 'fetch_failed' | 'no_image' | 'not_an_image';

export class PageImageFailure extends Error {
  constructor(readonly reason: PageImageError) {
    super(reason);
    this.name = 'PageImageFailure';
  }
}

export interface PageImageDeps {
  fetch?: typeof fetch;
  /** All addresses a hostname resolves to. */
  lookup?: (hostname: string) => Promise<string[]>;
}

const defaultLookup = async (hostname: string) =>
  (await dnsLookup(hostname, { all: true })).map((entry) => entry.address);

const IPV4_BLOCKS: readonly [number, number][] = [
  // [network, prefix length] as a 32-bit integer and mask width.
  [0x00000000, 8], // "this" network
  [0x0a000000, 8], // private
  [0x64400000, 10], // carrier-grade NAT
  [0x7f000000, 8], // loopback
  [0xa9fe0000, 16], // link-local (cloud metadata lives here)
  [0xac100000, 12], // private
  [0xc0000000, 24], // IETF protocol assignments
  [0xc0000200, 24], // documentation
  [0xc0a80000, 16], // private
  [0xc6120000, 15], // benchmarking
  [0xc6336400, 24], // documentation
  [0xcb007100, 24], // documentation
  [0xe0000000, 4], // multicast
  [0xf0000000, 4], // reserved, broadcast
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

/** False for loopback, private, link-local, and other non-public addresses. */
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const value = ipv4ToInt(ip);
    return !IPV4_BLOCKS.some(([network, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === network;
    });
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped?.[1]) return isPublicAddress(mapped[1]);
    if (lower === '::' || lower === '::1') return false;
    // Unique local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8), documentation.
    return !/^(f[cd]|fe[89ab]|ff|2001:db8)/.test(lower);
  }
  return false;
}

/** Throws unless `raw` is an HTTPS URL on the default port whose host is public. */
export async function assertPublicHttpsUrl(
  raw: string,
  lookup: (hostname: string) => Promise<string[]> = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageImageFailure('blocked_url');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new PageImageFailure('blocked_url');
  }
  if (url.port && url.port !== '443') throw new PageImageFailure('blocked_url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') && isIP(host) === 0) throw new PageImageFailure('blocked_url');
  const addresses = isIP(host) ? [host] : await lookup(host).catch(() => [] as string[]);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new PageImageFailure('blocked_url');
  }
  return url;
}

/** GET (or HEAD) with redirects followed by hand, each hop re-checked. */
async function guardedFetch(
  start: string,
  method: 'GET' | 'HEAD',
  deps: Required<PageImageDeps>,
): Promise<{ response: Response; url: URL }> {
  let url = await assertPublicHttpsUrl(start, deps.lookup);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await deps.fetch(url, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: method === 'GET' ? 'text/html' : 'image/*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PageImageFailure('fetch_failed');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = await assertPublicHttpsUrl(new URL(location, url).toString(), deps.lookup);
      continue;
    }
    if (!response.ok) throw new PageImageFailure('fetch_failed');
    return { response, url };
  }
  throw new PageImageFailure('fetch_failed');
}

/** Reads at most `limit` bytes of a body as text. */
async function readCapped(response: Response, limit: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, limit));
}

const decodeEntities = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const name = match[1]?.toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (name) result[name] = decodeEntities(value.trim());
  }
  return result;
}

const IMAGE_KEYS = [
  'og:image:secure_url',
  'og:image',
  'og:image:url',
  'twitter:image',
  'twitter:image:src',
];

/** The preview image and title a page declares (exported for tests). */
export function extractPreview(html: string): { image?: string; title: string } {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }
  let image = IMAGE_KEYS.map((key) => meta.get(key)).find(Boolean);
  if (!image) {
    const link = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map(([tag]) => attributes(tag))
      .find((attrs) => attrs.rel?.toLowerCase() === 'image_src' && attrs.href);
    image = link?.href;
  }
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const title = decodeEntities(meta.get('og:title') ?? titleTag ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE);
  return { image, title };
}

/**
 * The picture `pageUrl` offers for previews, checked to be a reachable raster image.
 * Throws `PageImageFailure` with a reason the model can act on.
 */
export async function findPageImage(pageUrl: string, deps: PageImageDeps = {}): Promise<PageImage> {
  const resolved: Required<PageImageDeps> = {
    fetch: deps.fetch ?? fetch,
    lookup: deps.lookup ?? defaultLookup,
  };
  const page = await guardedFetch(pageUrl, 'GET', resolved);
  const type = page.response.headers.get('content-type') ?? '';
  if (!type.includes('html')) {
    await page.response.body?.cancel().catch(() => {});
    throw new PageImageFailure('no_image');
  }
  const { image, title } = extractPreview(await readCapped(page.response, MAX_PAGE_BYTES));
  if (!image) throw new PageImageFailure('no_image');

  const imageUrl = new URL(image, page.url).toString();
  const probe = await guardedFetch(imageUrl, 'HEAD', resolved);
  const imageType = probe.response.headers.get('content-type') ?? '';
  const size = Number(probe.response.headers.get('content-length') ?? 0);
  // SVG can carry script; the app only shows raster images.
  if (!imageType.startsWith('image/') || imageType.includes('svg') || size > MAX_IMAGE_BYTES) {
    throw new PageImageFailure('not_an_image');
  }
  return { url: probe.url.toString(), pageUrl: page.url.toString(), title };
}
