import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { presets } from '@after-hours/companions';
import { StartersResponseSchema, type UserProfile } from '@after-hours/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { ServerConfig } from '../config';
import { openDatabase, type Database } from '../db/client';
import { users } from '../db/schema';
import { createUser, getProfile } from '../db/users';
import type { StructuredModel, StructuredRequest } from '../providers/types';
import { call, events, newSession, postMessage, scriptedModel, USAGE } from '../test-chat';
import { testConfig } from '../test-config';

const [roy] = presets;
if (!roy) throw new Error('expected Roy preset');

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-starters-'));
  database = openDatabase({ kind: 'pglite' });
  await database.migrate();
});

afterAll(async () => {
  await database.close();
  rmSync(workDir, { recursive: true, force: true });
});

/** Memory model double: starter requests get scripted lines; extraction finds nothing. */
function memoryModel() {
  const starters: (string[] | Error)[] = [];
  const starterRequests: StructuredRequest<unknown>[] = [];
  const model: StructuredModel = {
    provider: 'test',
    model: 'test-memory-model',
    async generate<T>(request: StructuredRequest<T>) {
      if (!request.system.includes('tap-to-send')) {
        return { value: request.schema.parse({ memories: [] }), usage: USAGE };
      }
      starterRequests.push(request as StructuredRequest<unknown>);
      const next = starters.shift() ?? ['one', 'two', 'three', 'four'];
      if (next instanceof Error) throw next;
      return { value: request.schema.parse({ starters: next }), usage: USAGE };
    },
  };
  return { model, starters, starterRequests };
}

let chat: ReturnType<typeof scriptedModel>;
let memory: ReturnType<typeof memoryModel>;
let background: Promise<void>[];
let app: ReturnType<typeof createApp>;
const logs: string[] = [];

function makeApp(overrides: Partial<ServerConfig> = {}, withMemoryModel = true) {
  return createApp(testConfig(workDir, overrides), () => {}, {
    chat: {
      db: database.db,
      model: chat.model,
      memoryModel: withMemoryModel ? memory.model : undefined,
      sessionSecret: 'test-session-secret-0123456789abcdef',
      waitUntil: (task) => void background.push(task),
    },
    log: (message) => logs.push(message),
  });
}

beforeEach(() => {
  chat = scriptedModel();
  memory = memoryModel();
  background = [];
  logs.length = 0;
  app = makeApp();
});

const profile: UserProfile = {
  lookingFor: ['unwind'],
  values: ['curious'],
  dynamic: { x: -0.8, y: 0.8 },
  textingLength: 3,
};

async function starters(token: string, target = app) {
  const res = await call(target, token, 'GET', `/conversations/roy/starters`);
  expect(res.status).toBe(200);
  return StartersResponseSchema.parse(await res.json()).starters;
}

describe('PUT /profile', () => {
  it('stores valid answers and rejects invalid ones', async () => {
    const token = await newSession(app);
    expect((await call(app, token, 'PUT', '/profile', profile)).status).toBe(204);
    expect(
      (await call(app, token, 'PUT', '/profile', { ...profile, values: ['rich'] })).status,
    ).toBe(400);
    expect((await call(app, token, 'PUT', '/profile', 'nope')).status).toBe(400);
  });

  it('reads a stored profile that no longer parses as none', async () => {
    const userId = await createUser(database.db);
    const stale = { ...profile, values: ['rich'] } as unknown as UserProfile;
    await database.db.update(users).set({ profile: stale }).where(eq(users.id, userId));
    expect(await getProfile(database.db, userId)).toBeNull();
  });

  it('requires a session', async () => {
    const res = await app.request('/profile', { method: 'PUT', body: JSON.stringify(profile) });
    expect(res.status).toBe(401);
  });
});

describe('GET /conversations/:id/starters', () => {
  it('writes starters from this user’s profile and memories, and caches them', async () => {
    const token = await newSession(app);
    await call(app, token, 'PUT', '/profile', profile);
    memory.starters.push(['so the interview', 'long day honestly', '  ', 'one more thing']);

    expect(await starters(token)).toEqual([
      'so the interview',
      'long day honestly',
      'one more thing',
    ]);
    expect(await starters(token)).toEqual([
      'so the interview',
      'long day honestly',
      'one more thing',
    ]);
    expect(memory.starterRequests).toHaveLength(1);
    expect(memory.starterRequests[0]?.prompt).toContain('someone to unwind with');

    // A new memory changes what the starters are written from.
    await call(app, token, 'POST', '/memories/roy', { content: 'Has a job interview Thursday' });
    await starters(token);
    expect(memory.starterRequests).toHaveLength(2);
    expect(memory.starterRequests[1]?.prompt).toContain('- Has a job interview Thursday');
  });

  it("never uses another user's profile or memories", async () => {
    const alice = await newSession(app);
    const bob = await newSession(app);
    await call(app, alice, 'PUT', '/profile', profile);
    await call(app, alice, 'POST', '/memories/roy', { content: 'Alice has a cat named Miso' });
    memory.starters.push(['alice line 1', 'alice line 2']);
    memory.starters.push(['bob line 1', 'bob line 2']);

    expect(await starters(alice)).toEqual(['alice line 1', 'alice line 2']);
    expect(await starters(bob)).toEqual(['bob line 1', 'bob line 2']);
    const bobPrompt = memory.starterRequests[1]?.prompt ?? '';
    expect(bobPrompt).not.toContain('Miso');
    expect(bobPrompt).not.toContain('unwind');
    expect(bobPrompt).toContain('skipped the sign-up questions');
  });

  it('falls back to the companion defaults without a model, under the kill switch, or on failure', async () => {
    const plain = makeApp({}, false);
    expect(await starters(await newSession(plain), plain)).toEqual(roy.publicProfile.starters);

    const killed = makeApp({ killSwitch: true });
    expect(await starters(await newSession(killed), killed)).toEqual(roy.publicProfile.starters);
    expect(memory.starterRequests).toHaveLength(0);

    memory.starters.push(new Error('model down'));
    expect(await starters(await newSession(app))).toEqual(roy.publicProfile.starters);
    expect(logs.some((line) => line.includes('[starters] generation failed'))).toBe(true);
  });

  it('404s for an unknown companion', async () => {
    const token = await newSession(app);
    expect((await call(app, token, 'GET', '/conversations/nobody/starters')).status).toBe(404);
  });
});

describe('pacing', () => {
  it('a first message is answered as meeting someone, adapted to their answers', async () => {
    const token = await newSession(app);
    await call(app, token, 'PUT', '/profile', profile);
    await events(await postMessage(app, token, 'roy', 'hey'));
    await Promise.all(background);

    const { stable, context } = chat.requests[0]?.system ?? { stable: '', context: '' };
    expect(context).toContain('You just met');
    expect(stable).toContain('# Tuned to them');
    expect(stable).toContain('Be easy company');
    // A gentle vibe lowers Roy's roast level.
    expect(stable).toContain('Tease gently, and only about choices or takes.');
  });

  it('warms up after a few messages', async () => {
    const token = await newSession(app);
    for (let i = 0; i < 7; i++) await events(await postMessage(app, token, 'roy', `message ${i}`));
    await Promise.all(background);
    expect(chat.requests[0]?.system.context).toContain('You just met');
    expect(chat.requests.at(-1)?.system.context).toContain('still getting to know');
  });
});
