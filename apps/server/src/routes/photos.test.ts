import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CreditsResponseSchema,
  FREE_STARTING_CREDITS,
  GalleryResponseSchema,
  PLUS_MONTHLY_CREDITS,
  type ChatStreamEvent,
} from '@after-hours/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { PHOTO_RESULTS, SEND_PHOTO } from '../chat/photo-tool';
import { openDatabase, type Database } from '../db/client';
import { getCredits, startPlus } from '../db/credits';
import { creditEvents, users } from '../db/schema';
import type { ToolCall } from '../providers/types';
import { call, events, newSession, nextClientId, scriptedModel } from '../test-chat';
import { testConfig } from '../test-config';

const SECRET = 'test-session-secret-0123456789abcdef';

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-photos-'));
  database = openDatabase({ kind: 'pglite' });
  await database.migrate();
});

afterAll(async () => {
  await database.close();
  rmSync(workDir, { recursive: true, force: true });
});

let chat: ReturnType<typeof scriptedModel>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  chat = scriptedModel();
  app = createApp(testConfig(workDir), () => {}, {
    chat: { db: database.db, model: chat.model, sessionSecret: SECRET },
  });
});

const photoCall = (id = 'call-1', caption = 'late shift'): ToolCall => ({
  id,
  name: SEND_PHOTO,
  input: { moment: 'desk, cold coffee', caption },
});

const userIdOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub as string;

async function send(token: string, text: string, clientId = nextClientId()) {
  return events(await call(app, token, 'POST', '/conversations/roy/messages', { text, clientId }));
}

const shape = (list: ChatStreamEvent[]) =>
  list
    .filter((e) => e.type !== 'delta' && e.type !== 'typing' && e.type !== 'ack')
    .map((e) =>
      e.type === 'bubble'
        ? e.message.kind === 'image'
          ? `photo:${e.message.image?.kind === 'placeholder' ? e.message.image.description : e.message.image?.url}:${e.message.content}`
          : `text:${e.message.content}`
        : e.type === 'credits'
          ? `credits:${e.balance}`
          : e.type,
    );

/** Free users start with no photo credits (D-036): photo tests buy a 10-pack first. */
const STARTING = 10;
async function photoSession() {
  const token = await newSession(app);
  const res = await call(app, token, 'POST', '/credits/purchase', {
    packId: 'photos-10',
    purchaseId: `setup-${nextClientId()}`,
  });
  expect(res.status).toBe(200);
  return token;
}

async function credits(token: string) {
  const res = await call(app, token, 'GET', '/credits');
  expect(res.status).toBe(200);
  return CreditsResponseSchema.parse(await res.json());
}

describe('send_photo', () => {
  it('never sends a second photo in the same reply, even in a later tool round', async () => {
    const token = await photoSession();
    chat.script.push(
      { chunks: [], toolCalls: [photoCall('call_a')] },
      { chunks: [], toolCalls: [photoCall('call_b')] },
      { chunks: ['ok that one'] },
    );
    const list = await send(token, 'pics');
    expect(list.filter((e) => e.type === 'bubble' && e.message.kind === 'image')).toHaveLength(1);
    expect((await credits(token)).balance).toBe(STARTING - 1);
    expect(chat.requests[2]?.toolChoice).toBe('none');
  });

  it('sends a placeholder photo for one credit, then the companion finishes the reply', async () => {
    const token = await photoSession();
    chat.script.push({ chunks: ['one sec'], toolCalls: [photoCall()] }, { chunks: ['there'] });
    const list = await send(token, 'send me a pic');

    expect(shape(list)).toEqual([
      'text:one sec',
      'photo:desk, cold coffee:late shift',
      `credits:${STARTING - 1}`,
      'text:there',
      'done',
    ]);
    expect((await credits(token)).balance).toBe(STARTING - 1);

    const [first, second] = chat.requests;
    expect(first?.tools?.map((t) => t.name)).toEqual([SEND_PHOTO]);
    expect(first?.system.stable).toContain('# Photos');
    // One more tool round is allowed (a picture retry); photos stay one per reply.
    expect(second?.toolChoice).toBe('auto');
    const results = second?.messages.at(-1);
    expect(results?.role === 'user' && results.toolResults).toEqual([
      { callId: 'call-1', content: PHOTO_RESULTS.sent },
    ]);
    // The continuation echoes the provider's own record of the turn.
    const echoed = second?.messages.at(-2);
    expect(echoed?.role === 'assistant' && echoed.raw).toBeTruthy();
  });

  it('keeps the photo in history as [photo] with its caption', async () => {
    const token = await photoSession();
    chat.script.push({ chunks: [], toolCalls: [photoCall('a', '')] }, { chunks: ['ok'] });
    await send(token, 'pic?');
    chat.script.push({ chunks: [], toolCalls: [photoCall('b', 'again')] }, { chunks: ['ok'] });
    const list = await send(token, 'another');
    expect(shape(list)).toContain('photo:desk, cold coffee:again');
    const history = JSON.stringify(chat.requests[2]?.messages);
    expect(history).toContain('[photo]');
  });

  it('without credits: no photo, credits_required, and the companion says it will wait', async () => {
    const token = await newSession(app);
    await database.db
      .update(users)
      .set({ imageCredits: 0 })
      .where(eq(users.id, userIdOf(token)));
    chat.script.push({ chunks: [], toolCalls: [photoCall()] }, { chunks: ['later then'] });
    const list = await send(token, 'pic?');

    expect(shape(list)).toEqual(['credits_required', 'text:later then', 'done']);
    const results = chat.requests[1]?.messages.at(-1);
    expect(results?.role === 'user' && results.toolResults?.[0]?.content).toBe(
      PHOTO_RESULTS.noCredits,
    );
    expect((await credits(token)).balance).toBe(0);
  });

  it('sends at most one photo per reply and rejects invalid input without spending', async () => {
    const token = await photoSession();
    chat.script.push(
      {
        chunks: [],
        toolCalls: [
          { id: 'bad', name: SEND_PHOTO, input: { caption: 'no moment' } },
          photoCall('one'),
          photoCall('two'),
        ],
      },
      { chunks: ['done'] },
    );
    const list = await send(token, 'pics pls');
    expect(shape(list).filter((s) => s.startsWith('photo:'))).toHaveLength(1);
    expect((await credits(token)).balance).toBe(STARTING - 1);
    const results = chat.requests[1]?.messages.at(-1);
    expect(results?.role === 'user' && results.toolResults).toEqual([
      { callId: 'bad', content: PHOTO_RESULTS.invalid, isError: true },
      { callId: 'one', content: PHOTO_RESULTS.sent },
      { callId: 'two', content: PHOTO_RESULTS.oncePerReply, isError: true },
    ]);
  });

  it('a resent message replays its photo without spending again', async () => {
    const token = await photoSession();
    const clientId = nextClientId();
    chat.script.push({ chunks: [], toolCalls: [photoCall()] }, { chunks: ['ok'] });
    await send(token, 'pic?', clientId);
    const replay = await send(token, 'pic?', clientId);
    expect(shape(replay)).toEqual(['photo:desk, cold coffee:late shift', 'text:ok', 'done']);
    expect(chat.requests).toHaveLength(2);
    expect((await credits(token)).balance).toBe(STARTING - 1);
  });
});

describe('credits', () => {
  it('demo purchases add a pack once per purchaseId', async () => {
    const token = await newSession(app);
    const buy = () =>
      call(app, token, 'POST', '/credits/purchase', {
        packId: 'photos-10',
        purchaseId: 'purchase-123456',
      });
    expect(CreditsResponseSchema.parse(await (await buy()).json()).balance).toBe(
      FREE_STARTING_CREDITS + 10,
    );
    expect(CreditsResponseSchema.parse(await (await buy()).json()).balance).toBe(
      FREE_STARTING_CREDITS + 10,
    );
    const bad = await call(app, token, 'POST', '/credits/purchase', {
      packId: 'photos-9000',
      purchaseId: 'purchase-999999',
    });
    expect(bad.status).toBe(400);
  });

  it('demo Plus grants monthly credits once per period and ends cleanly', async () => {
    const token = await newSession(app);
    const res = await call(app, token, 'POST', '/plus', { plan: 'monthly' });
    const started = CreditsResponseSchema.parse(await res.json());
    expect(started.balance).toBe(FREE_STARTING_CREDITS + PLUS_MONTHLY_CREDITS);
    expect(started.plus?.plan).toBe('monthly');
    expect((await credits(token)).balance).toBe(FREE_STARTING_CREDITS + PLUS_MONTHLY_CREDITS);

    // 31 days later: one more grant, not two.
    const later = new Date(Date.now() + 31 * 86_400_000);
    const userId = userIdOf(token);
    await getCredits(database.db, userId, later);
    const after = await getCredits(database.db, userId, later);
    expect(after?.balance).toBe(FREE_STARTING_CREDITS + 2 * PLUS_MONTHLY_CREDITS);

    const ended = CreditsResponseSchema.parse(
      await (await call(app, token, 'DELETE', '/plus')).json(),
    );
    expect(ended.plus).toBeNull();
    expect(ended.balance).toBe(FREE_STARTING_CREDITS + 2 * PLUS_MONTHLY_CREDITS);
  });

  it('switching Plus plans does not grant the period again', async () => {
    const token = await newSession(app);
    const userId = userIdOf(token);
    await startPlus(database.db, userId, 'monthly');
    const switched = await startPlus(database.db, userId, 'annual');
    expect(switched?.balance).toBe(FREE_STARTING_CREDITS + PLUS_MONTHLY_CREDITS);
    expect(switched?.plus?.plan).toBe('annual');
  });
});

describe('isolation between users', () => {
  it("B never sees A's photos, balance, or purchases", async () => {
    const a = await photoSession();
    const b = await newSession(app);
    chat.script.push({ chunks: [], toolCalls: [photoCall()] }, { chunks: ['ok'] });
    await send(a, 'pic?');
    await call(app, a, 'POST', '/credits/purchase', {
      packId: 'photos-30',
      purchaseId: 'shared-purchase-id',
    });
    // B reusing A's purchaseId buys B's own pack.
    await call(app, b, 'POST', '/credits/purchase', {
      packId: 'photos-10',
      purchaseId: 'shared-purchase-id',
    });

    const gallery = async (token: string) =>
      GalleryResponseSchema.parse(await (await call(app, token, 'GET', '/gallery')).json()).photos;
    expect(await gallery(a)).toHaveLength(1);
    expect(await gallery(b)).toEqual([]);
    expect((await credits(a)).balance).toBe(STARTING - 1 + 30);
    expect((await credits(b)).balance).toBe(FREE_STARTING_CREDITS + 10);
  });

  it('requires a session and deletes the ledger with the account', async () => {
    expect((await app.request('/credits')).status).toBe(401);
    expect((await app.request('/gallery')).status).toBe(401);
    const token = await newSession(app);
    await call(app, token, 'POST', '/credits/purchase', {
      packId: 'photos-10',
      purchaseId: 'purchase-to-delete',
    });
    const userId = userIdOf(token);
    await call(app, token, 'DELETE', '/account');
    expect(await database.db.$count(creditEvents, eq(creditEvents.userId, userId))).toBe(0);
  });
});
