import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

/**
 * The network a request comes from (D-042): the key that per-network limits are stored
 * under. Addresses are never stored, only a keyed hash. IPv6 addresses are grouped by /64,
 * the block one connection usually gets, so rotating within it does not escape the limits.
 */

/** The client address: the socket peer, or the first `X-Forwarded-For` entry behind a proxy. */
export function clientAddress(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // `app.request` in tests has no socket.
    return 'unknown';
  }
}

/** The /64 prefix for IPv6, the address itself for IPv4 (IPv4-mapped IPv6 unwrapped). */
export function networkOf(address: string): string {
  const lower = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return mapped[1];
  if (isIP(lower) !== 6) return lower;
  // Expand "::" so the first four groups are the /64 prefix.
  const [head = '', tail = ''] = lower.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = lower.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/** A keyed hash of the network, so stored keys cannot be turned back into addresses. */
export function networkKey(address: string, secret: string): string {
  return createHmac('sha256', `network:${secret}`)
    .update(networkOf(address))
    .digest('base64url')
    .slice(0, 32);
}
