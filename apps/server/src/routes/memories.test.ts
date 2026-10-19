import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  MemoriesResponseSchema,
  MemorySchema,
  MessagesResponseSchema,
} from '@after-hours/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { openDatabase, type Database } from '../db/client';
import { conversations, memories, messages, users } from '../db/schema';
import {
  call,
  events,
  newSession,
  postMessage,
  scriptedModel,
  scriptedStructuredModel,
} from '../test-chat';
import { testConfig } from '../test-config';

const SECRET = 'test-session-secret-0123456789abcdef';

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-memory-'));
  database = openDatabase({ kind: 'pglite' });
  await database.migrate();
});

afterAll(async () => {
  await database.close();
  rmSync(workDir, { recursive: true, force: true });
});

let chat: ReturnType<typeof scriptedModel>;
let extractor: ReturnType<typeof scriptedStructuredModel>;
let app: ReturnType<typeof createApp>;
let background: Promise<void>[];
const logs: string[] = [];

beforeEach(() => {
  chat = scriptedModel();
  extractor = scriptedStructuredModel();
  background = [];
  logs.length = 0;
  app = createApp(testConfig(workDir), () => {}, {
    chat: {
      db: database.db,
      model: chat.model,
      memoryModel: extractor.model,
      sessionSecret: SECRET,
      waitUntil: (task) => void background.push(task),
    },
    log: (message) => logs.push(message),
  });
});

const settle = () => Promise.all(background);

async function list(token: string, companionId: string) {
  const res = await call(app, token, 'GET', `/memories/${companionId}`);
  expect(res.status).toBe(200);
  return MemoriesResponseSchema.parse(await res.json()).memories;
}

async function remember(token: string, companionId: string, content: string) {
  const res = await call(app, token, 'POST', `/memories/${companionId}`, { content });
  expect(res.status).toBe(201);
  return MemorySchema.parse(await res.json());
}

const fact = (content: string, confidence = 0.9) => ({ content, category: 'fact', confidence });

describe('automatic memories', () => {
  it('extracts confident new facts after a reply and uses them on the next turn', async () => {
    const token = await newSession(app);
    chat.script.push({ chunks: ['a dog! what kind'] });
    extractor.script.push({
      memories: [fact('Has a dog named Pixel'), fact('Might like jazz', 0.4)],
    });
    await events(await postMessage(app, token, 'roy', 'just got a dog, her name is pixel'));
    await settle();

    const saved = await list(token, 'roy');
    expect(saved.map((m) => m.content)).toEqual(['Has a dog named Pixel']);
    // The extractor saw the user's message and the reply, plus what is already known.
    expect(extractor.requests[0]?.prompt).toContain('USER: just got a dog, her name is pixel');
    expect(extractor.requests[0]?.prompt).toContain('COMPANION: a dog! what kind');

    await events(await postMessage(app, token, 'roy', 'morning'));
    await settle();
    expect(chat.requests[1]?.system.context).toContain('Has a dog named Pixel');
    expect(extractor.requests[1]?.prompt).toContain('- Has a dog named Pixel');
  });

  it('skips duplicates and stores memories only for the companion that heard them', async () => {
    const token = await newSession(app);
    await remember(token, 'roy', 'Has a dog named Pixel');
    extractor.script.push({ memories: [fact('has a dog named pixel.'), fact('Lives in Lisbon')] });
    await events(await postMessage(app, token, 'roy', 'pixel says hi from lisbon'));
    await settle();

    expect((await list(token, 'roy')).map((m) => m.content).sort()).toEqual([
      'Has a dog named Pixel',
      'Lives in Lisbon',
    ]);
    expect(await list(token, 'roya')).toEqual([]);
  });

  it('a failed extraction is logged and never breaks the chat', async () => {
    const token = await newSession(app);
    extractor.script.push(new Error('memory model down'));
    const list1 = await events(await postMessage(app, token, 'roy', 'hello'));
    expect(list1.at(-1)?.type).toBe('done');
    await settle();
    expect(logs.join('\n')).toContain('[memory] extraction failed: memory model down');
    expect(await list(token, 'roy')).toEqual([]);
  });
});

describe('memory controls', () => {
  it('lists pinned first, edits, pins, deletes one, and forgets all', async () => {
    const token = await newSession(app);
    const first = await remember(token, 'roy', 'Hates cilantro');
    const second = await remember(token, 'roy', 'Runs on Sundays');
    expect((await list(token, 'roy')).map((m) => m.id)).toEqual([second.id, first.id]);

    const pinned = await call(app, token, 'PATCH', `/memories/roy/${first.id}`, { pinned: true });
    expect(MemorySchema.parse(await pinned.json()).pinned).toBe(true);
    expect((await list(token, 'roy'))[0]?.id).toBe(first.id);

    const edited = await call(app, token, 'PATCH', `/memories/roy/${second.id}`, {
      content: 'Runs on Saturdays',
    });
    expect(MemorySchema.parse(await edited.json()).content).toBe('Runs on Saturdays');

    expect((await call(app, token, 'DELETE', `/memories/roy/${second.id}`)).status).toBe(204);
    expect((await call(app, token, 'DELETE', `/memories/roy/${second.id}`)).status).toBe(404);
    expect((await list(token, 'roy')).map((m) => m.id)).toEqual([first.id]);

    expect((await call(app, token, 'DELETE', '/memories/roy')).status).toBe(204);
    expect(await list(token, 'roy')).toEqual([]);
  });

  it('"Remember this" twice returns the existing memory', async () => {
    const token = await newSession(app);
    const memory = await remember(token, 'roya', 'Plays the cello');
    const again = await call(app, token, 'POST', '/memories/roya', { content: 'plays the cello' });
    expect(again.status).toBe(200);
    expect(MemorySchema.parse(await again.json()).id).toBe(memory.id);
  });

  /** Sends a message, waits for extraction (scripted empty), and returns its id. */
  async function sentMessage(token: string, text: string): Promise<string> {
    extractor.script.push({ memories: [] });
    const list = await events(await postMessage(app, token, 'roy', text));
    await settle();
    const ack = list.find((e) => e.type === 'ack');
    if (ack?.type !== 'ack') throw new Error('no ack');
    return ack.message.id;
  }

  it('"Remember this" on a message saves it phrased as a fact', async () => {
    const token = await newSession(app);
    const messageId = await sentMessage(token, 'also i hate cilantro');
    extractor.script.push({ content: 'Hates cilantro', category: 'preference', duplicateOf: null });
    const res = await call(app, token, 'POST', '/memories/roy', { messageId });
    expect(res.status).toBe(201);
    expect(MemorySchema.parse(await res.json())).toMatchObject({
      content: 'Hates cilantro',
      category: 'preference',
    });
    expect(extractor.requests.at(-1)?.prompt).toContain('also i hate cilantro');
    const rows = await database.db
      .select()
      .from(memories)
      .where(eq(memories.content, 'Hates cilantro'));
    expect(rows[0]?.sourceMessageId).toBe(messageId);
  });

  it('"Remember this" returns the existing memory when it says the same thing', async () => {
    const token = await newSession(app);
    const known = await remember(token, 'roy', 'Dislikes cilantro');
    const messageId = await sentMessage(token, 'ugh cilantro is the worst');
    extractor.script.push({ content: 'Hates cilantro', category: 'preference', duplicateOf: 1 });
    const res = await call(app, token, 'POST', '/memories/roy', { messageId });
    expect(res.status).toBe(200);
    expect(MemorySchema.parse(await res.json()).id).toBe(known.id);
    expect(await list(token, 'roy')).toHaveLength(1);
  });

  it('"Remember this" keeps the user’s words when phrasing fails', async () => {
    const token = await newSession(app);
    const messageId = await sentMessage(token, 'my cat is called Miso');
    extractor.script.push(new Error('memory model down'));
    const res = await call(app, token, 'POST', '/memories/roy', { messageId });
    expect(res.status).toBe(201);
    expect(MemorySchema.parse(await res.json()).content).toBe('my cat is called Miso');
    expect(logs.join('\n')).toContain('[memory] phrasing failed');
  });

  it('rate-limits new memories per user', async () => {
    app = createApp(testConfig(workDir, { rateLimitPerMin: 2 }), () => {}, {
      chat: { db: database.db, model: chat.model, sessionSecret: SECRET },
    });
    const token = await newSession(app);
    await remember(token, 'roy', 'One');
    await remember(token, 'roy', 'Two');
    const res = await call(app, token, 'POST', '/memories/roy', { content: 'Three' });
    expect(res.status).toBe(429);
  });

  it('KILL_SWITCH: "Remember this" saves the message as is, without the model', async () => {
    const token = await newSession(app);
    const messageId = await sentMessage(token, 'my cat is called Miso');
    app = createApp(testConfig(workDir, { killSwitch: true }), () => {}, {
      chat: {
        db: database.db,
        model: chat.model,
        memoryModel: extractor.model,
        sessionSecret: SECRET,
      },
    });
    const calls = extractor.requests.length;
    const res = await call(app, token, 'POST', '/memories/roy', { messageId });
    expect(MemorySchema.parse(await res.json()).content).toBe('my cat is called Miso');
    expect(extractor.requests).toHaveLength(calls);
  });

  it('a deleted memory is excluded from the next prompt', async () => {
    const token = await newSession(app);
    const memory = await remember(token, 'roy', 'Is allergic to cats');
    await call(app, token, 'DELETE', `/memories/roy/${memory.id}`);
    await events(await postMessage(app, token, 'roy', 'hey'));
    expect(chat.requests[0]?.system.context ?? '').not.toContain('allergic');
    const rows = await database.db.select().from(memories).where(eq(memories.id, memory.id));
    expect(rows).toEqual([]);
  });

  it('rejects bad input and unknown companions', async () => {
    const token = await newSession(app);
    expect((await call(app, token, 'POST', '/memories/roy', { content: ' ' })).status).toBe(400);
    expect((await call(app, token, 'POST', '/memories/nobody', { content: 'x' })).status).toBe(404);
    expect(
      (await call(app, token, 'PATCH', '/memories/roy/not-a-uuid', { pinned: true })).status,
    ).toBe(404);
    expect((await call(app, token, 'GET', '/memories/roy', undefined)).status).toBe(200);
    expect((await app.request('/memories/roy')).status).toBe(401);
  });
});

describe('isolation between users', () => {
  it("B cannot list, edit, pin, or delete A's memories", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    const memory = await remember(a, 'roy', 'Has a sister named Ines');

    expect(await list(b, 'roy')).toEqual([]);
    const path = `/memories/roy/${memory.id}`;
    expect((await call(app, b, 'PATCH', path, { content: 'hijacked' })).status).toBe(404);
    expect((await call(app, b, 'PATCH', path, { pinned: true })).status).toBe(404);
    expect((await call(app, b, 'DELETE', path)).status).toBe(404);
    expect((await call(app, b, 'DELETE', '/memories/roy')).status).toBe(204);

    expect(await list(a, 'roy')).toEqual([memory]);
  });

  it("B cannot turn A's message into B's memory", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    const list1 = await events(await postMessage(app, a, 'roy', 'a private detail'));
    await settle();
    const ack = list1.find((e) => e.type === 'ack');
    if (ack?.type !== 'ack') throw new Error('no ack');
    const res = await call(app, b, 'POST', '/memories/roy', { messageId: ack.message.id });
    expect(res.status).toBe(404);
    expect(await list(b, 'roy')).toEqual([]);
    // Nor through the other companion's path.
    expect(
      (await call(app, a, 'POST', '/memories/roya', { messageId: ack.message.id })).status,
    ).toBe(404);
  });

  it("a memory id is scoped to its companion: Roya's path cannot reach Roy's memory", async () => {
    const token = await newSession(app);
    const memory = await remember(token, 'roy', 'Collects vinyl');
    expect((await call(app, token, 'DELETE', `/memories/roya/${memory.id}`)).status).toBe(404);
    expect((await list(token, 'roy')).map((m) => m.id)).toEqual([memory.id]);
  });

  it("clearing B's history leaves A's thread untouched", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    await events(await postMessage(app, a, 'roy', 'a was here'));
    expect((await call(app, b, 'DELETE', '/conversations/roy')).status).toBe(204);
    const thread = MessagesResponseSchema.parse(
      await (await call(app, a, 'GET', '/conversations/roy/messages')).json(),
    ).messages;
    expect(thread.map((m) => m.content)).toContain('a was here');
  });
});

describe('data deletion', () => {
  it('clear history removes messages, restarts with the opener, and keeps memories', async () => {
    const token = await newSession(app);
    await remember(token, 'roy', 'Owns a red bike');
    await events(await postMessage(app, token, 'roy', 'forget this chat'));

    expect((await call(app, token, 'DELETE', '/conversations/roy')).status).toBe(204);
    const thread = MessagesResponseSchema.parse(
      await (await call(app, token, 'GET', '/conversations/roy/messages')).json(),
    ).messages;
    expect(thread.map((m) => m.content)).not.toContain('forget this chat');
    expect(thread.every((m) => m.role === 'assistant')).toBe(true);
    expect((await list(token, 'roy')).map((m) => m.content)).toEqual(['Owns a red bike']);
  });

  it("delete account removes the user's rows and only theirs", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    await remember(a, 'roy', 'A memory');
    await remember(b, 'roy', 'B memory');
    await events(await postMessage(app, a, 'roy', 'a message'));
    const userA = JSON.parse(Buffer.from(a.split('.')[1] ?? '', 'base64url').toString())
      .sub as string;

    expect((await call(app, a, 'DELETE', '/account')).status).toBe(204);
    expect((await call(app, a, 'GET', '/memories/roy')).status).toBe(401);

    const { db } = database;
    expect(await db.$count(users, eq(users.id, userA))).toBe(0);
    expect(await db.$count(conversations, eq(conversations.userId, userA))).toBe(0);
    expect(await db.$count(memories, eq(memories.userId, userA))).toBe(0);
    expect(await db.$count(messages, eq(messages.content, 'a message'))).toBe(0);
    expect((await list(b, 'roy')).map((m) => m.content)).toEqual(['B memory']);
  });
});
