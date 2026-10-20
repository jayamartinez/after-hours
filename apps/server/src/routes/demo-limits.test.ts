import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ApiErrorSchema, SessionResponseSchema } from '@after-hours/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { DemoLimits } from '../config';
import { openDatabase, type Database } from '../db/client';
import { networkSpent, recordReplyCost } from '../db/demo-limits';
import { networkKey, networkOf } from '../limits/network';
import { events, nextClientId, scriptedModel } from '../test-chat';
import { testConfig } from '../test-config';

const SECRET = 'test-session-secret-0123456789abcdef';

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-limits-'));
  database = openDatabase({ kind: 'pglite' });
  await database.migrate();
});

afterAll(async () => {
  await database.close();
  rmSync(workDir, { recursive: true, force: true });
});

let ipCounter = 0;
/** A fresh IP per test so the shared database's per-network rows do not collide. */
const freshIp = () => `198.51.100.${++ipCounter}`;

function makeApp(limits: Partial<DemoLimits> = {}) {
  const base = testConfig(workDir);
  return createApp({ ...base, limits: { ...base.limits, ...limits } }, () => {}, {
    chat: { db: database.db, model: scriptedModel().model, sessionSecret: SECRET },
  });
}

let app: ReturnType<typeof makeApp>;
beforeEach(() => {
  app = makeApp();
});

const from = (ip: string, token?: string) => ({
  'x-forwarded-for': ip,
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});

async function session(ip: string, target = app) {
  const res = await target.request('/session', { method: 'POST', headers: from(ip) });
  return res.status === 201 ? SessionResponseSchema.parse(await res.json()).token : res;
}

const send = (ip: string, token: string, target = app) =>
  target.request('/conversations/roy/messages', {
    method: 'POST',
    headers: from(ip, token),
    body: JSON.stringify({ text: 'hey', clientId: nextClientId() }),
  });

describe('networkOf', () => {
  it('groups IPv6 by /64 and unwraps IPv4-mapped addresses', () => {
    expect(networkOf('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(networkOf('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(networkOf('203.0.113.9')).toBe('203.0.113.9');
  });

  it('stores a keyed hash, never the address', () => {
    const key = networkKey('203.0.113.9', SECRET);
    expect(key).not.toContain('203');
    expect(networkKey('203.0.113.9', 'other-secret-0123456789abcdefghijk')).not.toBe(key);
  });
});

describe('demo limits (D-042)', () => {
  it('records each reply against the network', async () => {
    const ip = freshIp();
    const token = (await session(ip)) as string;
    await events(await send(ip, token));
    expect(await networkSpent(database.db, networkKey(ip, SECRET))).toBeGreaterThan(0);
  });

  it('stops a network at its lifetime cap, even after deleting data and starting over', async () => {
    const ip = freshIp();
    const token = (await session(ip)) as string;
    await recordReplyCost(database.db, {
      userId: JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub,
      network: networkKey(ip, SECRET),
      microUsd: 3_000_000,
    });

    const blocked = await send(ip, token);
    expect(blocked.status).toBe(402);
    expect(ApiErrorSchema.parse(await blocked.json()).code).toBe('demo_limit_reached');

    // Delete everything and come back with a new anonymous account: still blocked.
    await app.request('/account', { method: 'DELETE', headers: from(ip, token) });
    const fresh = (await session(ip)) as string;
    expect((await send(ip, fresh)).status).toBe(402);

    // Another network is unaffected.
    const other = freshIp();
    expect((await send(other, (await session(other)) as string)).status).toBe(200);
  });

  it('pauses chat for everyone once the global daily cap is spent', async () => {
    const capped = makeApp({ globalDailyUsd: 0.000001 });
    const ip = freshIp();
    const token = (await session(ip, capped)) as string;
    // Today's total across everyone now meets the (tiny) cap.
    await recordReplyCost(database.db, {
      userId: JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub,
      network: networkKey(ip, SECRET),
      microUsd: 1,
    });
    const other = freshIp();
    const res = await send(other, (await session(other, capped)) as string, capped);
    expect(res.status).toBe(503);
    expect(ApiErrorSchema.parse(await res.json()).code).toBe('unavailable');
  });

  it('caps new anonymous accounts per network per day', async () => {
    const limited = makeApp({ sessionsPerNetworkPerDay: 2 });
    const ip = freshIp();
    expect(typeof (await session(ip, limited))).toBe('string');
    expect(typeof (await session(ip, limited))).toBe('string');
    const third = (await session(ip, limited)) as Response;
    expect(third.status).toBe(429);
    expect(typeof (await session(freshIp(), limited))).toBe('string');
  });
});
