import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { presets } from '@after-hours/companions';
import {
  ChatStreamEventSchema,
  ConversationsResponseSchema,
  MessagesResponseSchema,
  SessionResponseSchema,
  type ChatStreamEvent,
} from '@after-hours/contracts';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { openDatabase, type Database } from '../db/client';
import { addMemory } from '../db/memories';
import { ChatModelError } from '../providers/types';
import type { ServerConfig } from '../config';
import { scriptedModel } from '../test-chat';
import { testConfig } from '../test-config';

const [roy, roya] = presets;
if (!roy || !roya) throw new Error('expected Roy and Roya presets');

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-chat-'));
  database = openDatabase({ kind: 'pglite' });
  await database.migrate();
});

afterAll(async () => {
  await database.close();
  rmSync(workDir, { recursive: true, force: true });
});

let fake: ReturnType<typeof scriptedModel>;
let app: ReturnType<typeof createApp>;
const logs: string[] = [];

function makeApp(overrides: Partial<ServerConfig> = {}) {
  fake = scriptedModel();
  return createApp(testConfig(workDir, overrides), () => {}, {
    chat: {
      db: database.db,
      model: fake.model,
      sessionSecret: 'test-session-secret-0123456789abcdef',
    },
    log: (message) => logs.push(message),
  });
}

beforeEach(() => {
  app = makeApp();
  logs.length = 0;
});

async function newSession(target = app): Promise<string> {
  const res = await target.request('/session', { method: 'POST' });
  expect(res.status).toBe(201);
  return SessionResponseSchema.parse(await res.json()).token;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function history(token: string, companionId: string, target = app) {
  const res = await target.request(`/conversations/${companionId}/messages`, {
    headers: auth(token),
  });
  expect(res.status).toBe(200);
  return MessagesResponseSchema.parse(await res.json()).messages;
}

let clientCounter = 0;
const nextClientId = () => `client-${Date.now()}-${++clientCounter}`;

async function post(
  token: string,
  companionId: string,
  text: string,
  clientId = nextClientId(),
  target = app,
) {
  return target.request(`/conversations/${companionId}/messages`, {
    method: 'POST',
    headers: { ...auth(token), 'content-type': 'application/json' },
    body: JSON.stringify({ text, clientId }),
  });
}

/** Parses an SSE body into validated events, checking each frame's `event:` name. */
async function events(res: Response): Promise<ChatStreamEvent[]> {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const frames = (await res.text()).split(/\n\n/).filter((frame) => frame.trim());
  return frames.map((frame) => {
    const name = /^event: (.+)$/m.exec(frame)?.[1];
    const data = /^data: (.+)$/m.exec(frame)?.[1] ?? '';
    const event = ChatStreamEventSchema.parse(JSON.parse(data));
    expect(name).toBe(event.type);
    return event;
  });
}

const types = (list: ChatStreamEvent[]) =>
  list.map((e) => e.type).filter((type) => type !== 'delta');

describe('sessions', () => {
  it('rejects missing, malformed, and forged tokens', async () => {
    expect((await app.request('/conversations')).status).toBe(401);
    expect((await app.request('/conversations', { headers: auth('nope') })).status).toBe(401);
    const forged = await newSession(
      createApp(testConfig(workDir), () => {}, {
        chat: {
          db: database.db,
          model: fake.model,
          sessionSecret: 'a-different-secret-0123456789abcdef',
        },
      }),
    );
    expect((await app.request('/conversations', { headers: auth(forged) })).status).toBe(401);
  });

  it('enables RLS on every table (blocks the public PostgREST API)', async () => {
    const result = (await database.db.execute(
      sql`select relname, relrowsecurity from pg_class where relname in ('users','conversations','messages','memories','credit_events') order by relname`,
    )) as unknown as { rows: { relname: string; relrowsecurity: boolean }[] };
    expect(result.rows).toEqual([
      { relname: 'conversations', relrowsecurity: true },
      { relname: 'credit_events', relrowsecurity: true },
      { relname: 'memories', relrowsecurity: true },
      { relname: 'messages', relrowsecurity: true },
      { relname: 'users', relrowsecurity: true },
    ]);
  });
});

describe('chat', () => {
  it("starts a thread with the companion's opener", async () => {
    const token = await newSession();
    const messages = await history(token, 'roy');
    expect(messages.map((m) => [m.role, m.content])).toEqual(
      roy.publicProfile.copy.firstMessage.map((line) => ['assistant', line]),
    );
    // Loading again does not seed twice.
    expect(await history(token, 'roy')).toHaveLength(roy.publicProfile.copy.firstMessage.length);
  });

  it('streams ack → typing → bubbles → done and persists every message', async () => {
    const token = await newSession();
    fake.script.push({ chunks: ['oof three dates', ' is a lot\n', '\nwho ', 'ended it'] });
    const list = await events(await post(token, 'roy', 'i got ghosted after three dates'));

    expect(types(list)).toEqual(['ack', 'typing', 'bubble', 'bubble', 'done']);
    expect(list.some((e) => e.type === 'delta')).toBe(true);
    const bubbles = list.flatMap((e) => (e.type === 'bubble' ? [e.message.content] : []));
    expect(bubbles).toEqual(['oof three dates is a lot', 'who ended it']);

    const [request] = fake.requests;
    expect(request?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'i got ghosted after three dates',
    });
    // The opener is history; the API needs a user turn first.
    expect(request?.messages[0]).toEqual({ role: 'user', content: '[opened the chat]' });
    expect(request?.system.stable).toContain('Roy');

    const stored = await history(token, 'roy');
    const tail = stored.slice(-3);
    expect(tail.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'i got ghosted after three dates', 'read'],
      ['assistant', 'oof three dates is a lot', 'sent'],
      ['assistant', 'who ended it', 'sent'],
    ]);
    const done = list.at(-1);
    expect(done?.type === 'done' && done.messageIds).toEqual(tail.slice(1).map((m) => m.id));
  });

  it('sends recent history as merged turns on the next message', async () => {
    const token = await newSession();
    fake.script.push({ chunks: ['first\n\nsecond'] }, { chunks: ['third'] });
    await events(await post(token, 'roy', 'one'));
    await events(await post(token, 'roy', 'two'));
    const last = fake.requests.at(-1);
    expect(last?.messages.slice(-3)).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'first\n\nsecond' },
      { role: 'user', content: 'two' },
    ]);
  });

  it('is idempotent on clientId: a resend replays the stored reply', async () => {
    const token = await newSession();
    fake.script.push({ chunks: ['hey you'] });
    const first = await events(await post(token, 'roy', 'hello', 'same-client-1'));
    const again = await events(await post(token, 'roy', 'hello', 'same-client-1'));

    expect(fake.requests).toHaveLength(1);
    expect(types(again)).toEqual(['ack', 'bubble', 'done']);
    const ids = (list: ChatStreamEvent[]) =>
      list.flatMap((e) => (e.type === 'bubble' ? [e.message.id] : []));
    expect(ids(again)).toEqual(ids(first));
    const stored = await history(token, 'roy');
    expect(stored.filter((m) => m.content === 'hello')).toHaveLength(1);
  });

  it('keeps Roy and Roya threads separate', async () => {
    const token = await newSession();
    fake.script.push({ chunks: ['roy reply'] }, { chunks: ['roya reply'] });
    await events(await post(token, 'roy', 'only for roy'));
    await events(await post(token, 'roya', 'only for roya'));

    const royThread = JSON.stringify(await history(token, 'roy'));
    const royaThread = JSON.stringify(await history(token, 'roya'));
    expect(royThread).toContain('only for roy');
    expect(royThread).not.toContain('only for roya');
    expect(royaThread).not.toContain('only for roy"');
    expect(JSON.stringify(fake.requests[1])).not.toContain('only for roy"');
    expect(fake.requests[1]?.system.stable).toContain('Roya');
  });

  it('isolates users: B cannot read or post into A’s conversation', async () => {
    const a = await newSession();
    const b = await newSession();
    fake.script.push({ chunks: ['for a'] }, { chunks: ['for b'] });
    await events(await post(a, 'roy', 'a secret', 'shared-client-id'));

    // B's thread is B's own: A's messages never appear.
    expect(JSON.stringify(await history(b, 'roy'))).not.toContain('a secret');

    // Reusing A's clientId does not replay A's reply into B's stream.
    const list = await events(await post(b, 'roy', 'b text', 'shared-client-id'));
    const bubbles = list.flatMap((e) => (e.type === 'bubble' ? [e.message.content] : []));
    expect(bubbles).toEqual(['for b']);
    expect(JSON.stringify(fake.requests[1])).not.toContain('a secret');
    expect(JSON.stringify(await history(a, 'roy'))).not.toContain('b text');

    const summaries = async (token: string) =>
      ConversationsResponseSchema.parse(
        await (await app.request('/conversations', { headers: auth(token) })).json(),
      ).conversations;
    expect((await summaries(a)).find((s) => s.companionId === 'roy')?.lastMessage?.content).toBe(
      'for a',
    );
    expect((await summaries(b)).find((s) => s.companionId === 'roy')?.lastMessage?.content).toBe(
      'for b',
    );
  });

  it("passes only this user's memories for this companion", async () => {
    const a = await newSession();
    const b = await newSession();
    const userId = (token: string) =>
      JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub as string;
    await addMemory(database.db, userId(a), 'roy', {
      content: 'Has a dog named Pixel',
      category: 'fact',
    });
    await addMemory(database.db, userId(a), 'roya', {
      content: 'Is learning the cello',
      category: 'fact',
    });
    await addMemory(database.db, userId(b), 'roy', {
      content: 'Works night shifts',
      category: 'fact',
    });

    await events(await post(a, 'roy', 'hey'));
    const context = fake.requests[0]?.system.context ?? '';
    expect(context).toContain('Has a dog named Pixel');
    expect(context).not.toContain('cello');
    expect(context).not.toContain('night shifts');
  });

  it('rejects unknown companions and invalid bodies', async () => {
    const token = await newSession();
    expect((await post(token, 'nobody', 'hi')).status).toBe(404);
    expect((await post(token, 'roy', 'x'.repeat(2001))).status).toBe(400);
    expect((await post(token, 'roy', '   ')).status).toBe(400);
    expect((await post(token, 'roy', 'hi', 'bad id!')).status).toBe(400);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('limits', () => {
  it('rate-limits sends per user', async () => {
    const limited = makeApp({ rateLimitPerMin: 2 });
    const a = await newSession(limited);
    const b = await newSession(limited);
    expect((await post(a, 'roy', 'one', undefined, limited)).status).toBe(200);
    expect((await post(a, 'roy', 'two', undefined, limited)).status).toBe(200);
    const third = await post(a, 'roy', 'three', undefined, limited);
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ code: 'rate_limited', retryable: true });
    expect((await post(b, 'roy', 'other user', undefined, limited)).status).toBe(200);
  });

  it('KILL_SWITCH returns 503 without calling the model', async () => {
    const off = makeApp({ killSwitch: true });
    const token = await newSession(off);
    const res = await post(token, 'roy', 'hello', undefined, off);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'unavailable' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('failures', () => {
  it('turns a refusal into a non-retryable error event', async () => {
    const token = await newSession();
    fake.script.push({
      chunks: [],
      error: new ChatModelError('refusal', 'declined', false),
    });
    const list = await events(await post(token, 'roy', 'something'));
    expect(types(list)).toEqual(['ack', 'typing', 'error']);
    const error = list.at(-1);
    expect(error?.type === 'error' && error.error).toMatchObject({
      code: 'refusal',
      retryable: false,
    });
    const stored = await history(token, 'roy');
    expect(stored.at(-1)).toMatchObject({ content: 'something', status: 'read' });
  });

  it('retries once before the first token', async () => {
    const token = await newSession();
    fake.script.push(
      { chunks: [], error: new ChatModelError('connection', 'down', true) },
      { chunks: ['back'] },
    );
    const list = await events(await post(token, 'roy', 'you there'));
    expect(types(list)).toEqual(['ack', 'typing', 'bubble', 'done']);
    expect(fake.requests).toHaveLength(2);
  });

  it('marks the message failed after two provider errors, and a retry delivers it', async () => {
    const token = await newSession();
    const down = () => ({
      chunks: [],
      error: new ChatModelError('api', 'Chat provider error (529).', true),
    });
    fake.script.push(down(), down());
    const failed = await events(await post(token, 'roy', 'hello?', 'retry-me-1'));
    expect(types(failed)).toEqual(['ack', 'typing', 'error']);
    const error = failed.at(-1);
    expect(error?.type === 'error' && error.error).toMatchObject({
      code: 'provider',
      retryable: true,
    });
    expect((await history(token, 'roy')).at(-1)).toMatchObject({
      content: 'hello?',
      status: 'failed',
    });
    expect(logs.join('\n')).toContain('reply failed (api)');
    expect(logs.join('\n')).not.toContain('hello?');

    fake.script.push({ chunks: ['sorry, here'] });
    const retried = await events(await post(token, 'roy', 'hello?', 'retry-me-1'));
    expect(types(retried)).toEqual(['ack', 'typing', 'bubble', 'done']);
    const ack = retried[0];
    expect(ack?.type === 'ack' && ack.message.status).toBe('sent');
    const stored = await history(token, 'roy');
    expect(stored.filter((m) => m.content === 'hello?')).toHaveLength(1);
    expect(stored.slice(-2).map((m) => [m.content, m.status])).toEqual([
      ['hello?', 'read'],
      ['sorry, here', 'sent'],
    ]);
  });

  it('keeps bubbles delivered before a mid-stream failure', async () => {
    const token = await newSession();
    fake.script.push({
      chunks: ['first bubble\n\nsecond'],
      error: new ChatModelError('connection', 'dropped', true),
    });
    const list = await events(await post(token, 'roy', 'go'));
    expect(types(list)).toEqual(['ack', 'typing', 'bubble', 'error']);
    const error = list.at(-1);
    expect(error?.type === 'error' && error.error.retryable).toBe(false);
    expect((await history(token, 'roy')).slice(-2).map((m) => m.content)).toEqual([
      'go',
      'first bubble',
    ]);
  });
});
