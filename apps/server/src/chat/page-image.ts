import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';

/**
 * The picture a web page offers for link previews (`og:image` and friends), so a companion
 * can show the user an image it found through web search without a paid image-search API
 * (D-038). The page URL comes from the model, so every request is guarded against
 * server-side request forgery: HTTPS only, public addresses only (checked on every
 * redirect, and again on the address the connection actually uses), blocked sites refused,
 * small timeouts, and a capped read.
 */

const TIMEOUT_MS = 6_000;
/** The whole lookup (page, image, redirects) gives up after this. */
const TOTAL_TIMEOUT_MS = 15_000;
const DNS_TIMEOUT_MS = 3_000;
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

export type PageImageError =
  'blocked_url' | 'blocked_site' | 'fetch_failed' | 'no_image' | 'not_an_image';

export class PageImageFailure extends Error {
  constructor(readonly reason: PageImageError) {
    super(reason);
    this.name = 'PageImageFailure';
  }
}

/** All addresses a hostname resolves to. */
export type Resolve = (hostname: string) => Promise<string[]>;

/** One HTTPS request to a URL that already passed `assertPublicHttpsUrl`. */
export type PageFetch = (
  url: URL,
  init: { method: 'GET' | 'HEAD'; headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

export interface PageImageDeps {
  /** Default: `node:https`, connecting only to a validated public address. */
  fetch?: PageFetch;
  lookup?: Resolve;
  /** Sites (and their subdomains) never opened. */
  blockedDomains?: readonly string[];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const defaultLookup: Resolve = async (hostname) =>
  (await withTimeout(dnsLookup(hostname, { all: true }), DNS_TIMEOUT_MS)).map(
    (entry) => entry.address,
  );

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
  [0xc0586300, 24], // 6to4 relay anycast
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

/** A valid IPv6 address (per `isIP`) as 16 bytes; null for zoned addresses. */
function ipv6Bytes(ip: string): number[] | null {
  if (ip.includes('%')) return null;
  // A dotted IPv4 tail (`::ffff:1.2.3.4`) becomes two hex groups.
  const text = ip.toLowerCase().replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) => {
    const hex = (hi: string, lo: string) => ((Number(hi) << 8) | Number(lo)).toString(16);
    return `${hex(a, b)}:${hex(c, d)}`;
  });
  const [head = '', tail] = text.split('::');
  const groups = (part: string) => (part ? part.split(':') : []);
  const front = groups(head);
  const back = tail === undefined ? [] : groups(tail);
  const zeros = tail === undefined ? 0 : 8 - front.length - back.length;
  const words = [...front, ...Array<string>(Math.max(zeros, 0)).fill('0'), ...back];
  if (words.length !== 8) return null;
  return words.flatMap((word) => {
    const value = parseInt(word, 16);
    return [value >> 8, value & 0xff];
  });
}

function isPublicIPv6(ip: string): boolean {
  const bytes = ipv6Bytes(ip);
  if (!bytes) return false;
  const word = (index: number) => ((bytes[index * 2] ?? 0) << 8) | (bytes[index * 2 + 1] ?? 0);
  const ipv4At = (offset: number) => bytes.slice(offset, offset + 4).join('.');
  const zeroUntil = (index: number) => bytes.slice(0, index).every((byte) => byte === 0);
  // IPv4-mapped ::ffff:0:0/96 and NAT64 64:ff9b::/96 reach the embedded IPv4 address.
  if (zeroUntil(10) && word(5) === 0xffff) return isPublicAddress(ipv4At(12));
  if (word(0) === 0x64 && word(1) === 0xff9b && bytes.slice(4, 12).every((b) => b === 0)) {
    return isPublicAddress(ipv4At(12));
  }
  // 6to4 2002::/16 carries an IPv4 address in bits 16-47.
  if (word(0) === 0x2002) return isPublicAddress(ipv4At(2));
  // Everything else must be global unicast (2000::/3). That excludes ::/96 (IPv4-compatible,
  // loopback, unspecified), unique local, link-local, site-local (fec0::/10), and multicast.
  if (((bytes[0] ?? 0) & 0xe0) !== 0x20) return false;
  if (word(0) === 0x2001 && ((bytes[2] ?? 0) & 0xfe) === 0) return false; // 2001::/23, Teredo
  if (word(0) === 0x2001 && word(1) === 0x0db8) return false; // documentation
  if (word(0) === 0x3fff && ((bytes[2] ?? 0) & 0xf0) === 0) return false; // documentation
  return true;
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
  if (isIP(ip) === 6) return isPublicIPv6(ip);
  return false;
}

/** True when `hostname` is one of `domains` or a subdomain of one. */
export function isBlockedHost(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Throws unless `raw` is an HTTPS URL on the default port whose host is public. */
export async function assertPublicHttpsUrl(
  raw: string,
  lookup: Resolve = defaultLookup,
  blockedDomains: readonly string[] = [],
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
  if (isBlockedHost(host, blockedDomains)) throw new PageImageFailure('blocked_site');
  const addresses = isIP(host) ? [host] : await lookup(host).catch(() => [] as string[]);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new PageImageFailure('blocked_url');
  }
  return url;
}

/**
 * A `lookup` for `https.request` that resolves the name again and hands the socket only
 * addresses that are all public, so a name that changes its answer after
 * `assertPublicHttpsUrl` (DNS rebinding) still cannot reach a private address.
 */
export function guardedLookup(resolve: Resolve): LookupFunction {
  return (hostname, options, callback) => {
    withTimeout(resolve(hostname), DNS_TIMEOUT_MS).then(
      (addresses) => {
        if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
          callback(new PageImageFailure('blocked_url'), '');
          return;
        }
        const entries = addresses.map((address) => ({ address, family: isIP(address) }));
        if (options.all) callback(null, entries);
        else callback(null, entries[0]?.address ?? '', entries[0]?.family);
      },
      () => callback(new PageImageFailure('fetch_failed'), ''),
    );
  };
}

/** Statuses whose responses never carry a body. */
const NULL_BODY = new Set([204, 205, 304]);

/** `PageFetch` over `node:https`: TLS still verifies the hostname; the address is checked. */
export function createHttpsFetch(resolve: Resolve = defaultLookup): PageFetch {
  const lookup = guardedLookup(resolve);
  return (url, init) =>
    new Promise<Response>((resolveResponse, reject) => {
      const request = httpsRequest(
        url,
        {
          method: init.method,
          headers: init.headers,
          signal: init.signal,
          lookup,
          // A fresh agent: no pooled socket from another request is reused.
          agent: false,
        },
        (incoming) => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value === undefined) continue;
            for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
          }
          const status = incoming.statusCode ?? 0;
          const hasBody = init.method !== 'HEAD' && !NULL_BODY.has(status);
          if (!hasBody) incoming.resume();
          try {
            resolveResponse(
              new Response(hasBody ? (Readable.toWeb(incoming) as ReadableStream) : null, {
                status,
                headers,
              }),
            );
          } catch (error) {
            incoming.destroy();
            reject(error);
          }
        },
      );
      request.on('error', reject);
      request.end();
    });
}

const discard = (response: Response) => response.body?.cancel().catch(() => {});

interface Resolved {
  fetch: PageFetch;
  lookup: Resolve;
  blockedDomains: readonly string[];
  deadline: AbortSignal;
}

/** GET (or HEAD) with redirects followed by hand, each hop re-checked. */
async function guardedFetch(
  start: string,
  method: 'GET' | 'HEAD',
  deps: Resolved,
  extraHeaders: Record<string, string> = {},
): Promise<{ response: Response; url: URL }> {
  let url = await assertPublicHttpsUrl(start, deps.lookup, deps.blockedDomains);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await deps.fetch(url, {
        method,
        headers: {
          'user-agent': USER_AGENT,
          accept: method === 'GET' && !extraHeaders.range ? 'text/html' : 'image/*',
          ...extraHeaders,
        },
        signal: AbortSignal.any([deps.deadline, AbortSignal.timeout(TIMEOUT_MS)]),
      });
    } catch (error) {
      throw error instanceof PageImageFailure ? error : new PageImageFailure('fetch_failed');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await discard(response);
      url = await assertPublicHttpsUrl(
        new URL(location, url).toString(),
        deps.lookup,
        deps.blockedDomains,
      );
      continue;
    }
    if (!response.ok) {
      await discard(response);
      throw new PageImageFailure('fetch_failed');
    }
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
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    throw new PageImageFailure('fetch_failed');
  } finally {
    await reader.cancel().catch(() => {});
  }
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

/** Full image size: the total in `content-range` (a ranged GET), else `content-length`. */
function imageSize(headers: Headers): number {
  const total = /\/(\d+)\s*$/.exec(headers.get('content-range') ?? '')?.[1];
  return Number(total ?? headers.get('content-length') ?? 0);
}

/** The image's headers: HEAD, or a one-byte GET when the server rejects HEAD. */
async function probeImage(imageUrl: string, deps: Resolved) {
  try {
    return await guardedFetch(imageUrl, 'HEAD', deps);
  } catch (error) {
    if (!(error instanceof PageImageFailure) || error.reason !== 'fetch_failed') throw error;
    const probe = await guardedFetch(imageUrl, 'GET', deps, { range: 'bytes=0-0' });
    await discard(probe.response);
    return probe;
  }
}

/**
 * The picture `pageUrl` offers for previews, checked to be a reachable raster image.
 * Throws `PageImageFailure` with a reason the model can act on.
 */
export async function findPageImage(pageUrl: string, deps: PageImageDeps = {}): Promise<PageImage> {
  const lookup = deps.lookup ?? defaultLookup;
  const resolved: Resolved = {
    fetch: deps.fetch ?? createHttpsFetch(lookup),
    lookup,
    blockedDomains: deps.blockedDomains ?? [],
    deadline: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
  };
  const page = await guardedFetch(pageUrl, 'GET', resolved);
  const type = page.response.headers.get('content-type') ?? '';
  // A direct link to a raster image is the picture itself.
  if (type.startsWith('image/') && !type.includes('svg')) {
    const size = Number(page.response.headers.get('content-length') ?? 0);
    await discard(page.response);
    if (size > MAX_IMAGE_BYTES) throw new PageImageFailure('not_an_image');
    const url = page.url.toString();
    return { url, pageUrl: url, title: '' };
  }
  if (!type.includes('html')) {
    await discard(page.response);
    throw new PageImageFailure('no_image');
  }
  const { image, title } = extractPreview(await readCapped(page.response, MAX_PAGE_BYTES));
  if (!image) throw new PageImageFailure('no_image');

  const imageUrl = new URL(image, page.url).toString();
  const probe = await probeImage(imageUrl, resolved);
  const imageType = probe.response.headers.get('content-type') ?? '';
  const size = imageSize(probe.response.headers);
  // SVG can carry script; the app only shows raster images.
  if (!imageType.startsWith('image/') || imageType.includes('svg') || size > MAX_IMAGE_BYTES) {
    throw new PageImageFailure('not_an_image');
  }
  return { url: probe.url.toString(), pageUrl: page.url.toString(), title };
}
