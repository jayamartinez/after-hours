import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  AD_REWARD_MESSAGES,
  ApiErrorSchema,
  CreditsResponseSchema,
  FREE_DAILY_MESSAGES,
  MAX_ADS_PER_DAY,
} from '@after-hours/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { openDatabase, type Database } from '../db/client';
import { getAllowance, spendMessage } from '../db/message-allowance';
import { call, events, newSession, nextClientId, scriptedModel } from '../test-chat';
import { testConfig } from '../test-config';

let workDir: string;
let database: Database;

beforeAll(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-messages-'));
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
  app = createApp(testConfig(workDir, { rateLimitPerMin: 1_000 }), () => {}, {
    chat: {
      db: database.db,
      model: chat.model,
      sessionSecret: 'test-session-secret-0123456789abcdef',
    },
  });
});

const userIdOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub as string;

const post = (token: string, text: string, clientId = nextClientId()) =>
  call(app, token, 'POST', '/conversations/roy/messages', { text, clientId });

async function credits(token: string) {
  const res = await call(app, token, 'GET', '/credits');
  expect(res.status).toBe(200);
  return CreditsResponseSchema.parse(await res.json());
}

async function useFreeMessages(token: string) {
  for (let i = 0; i < FREE_DAILY_MESSAGES; i++) await events(await post(token, `hi ${i}`));
}

describe('message allowance', () => {
  it('a new user has the daily free messages and no photo credits', async () => {
    const token = await newSession(app);
    const body = await credits(token);
    expect(body.balance).toBe(0);
    expect(body.messages).toMatchObject({
      unlimited: false,
      freeLeftToday: FREE_DAILY_MESSAGES,
      bonus: 0,
      adsLeftToday: MAX_ADS_PER_DAY,
    });
  });

  it('refuses a new message once the free ones are used, without storing it or calling the model', async () => {
    const token = await newSession(app);
    await useFreeMessages(token);
    expect((await credits(token)).messages.freeLeftToday).toBe(0);
    const calls = chat.requests.length;

    const res = await post(token, 'one more');
    expect(res.status).toBe(402);
    expect(ApiErrorSchema.parse(await res.json()).code).toBe('messages_required');
    expect(chat.requests).toHaveLength(calls);
    const history = await (await call(app, token, 'GET', '/conversations/roy/messages')).json();
    expect(JSON.stringify(history)).not.toContain('one more');
  });

  it('resending a stored message never spends again', async () => {
    const token = await newSession(app);
    const clientId = nextClientId();
    await events(await post(token, 'hello', clientId));
    for (let i = 1; i < FREE_DAILY_MESSAGES; i++) await events(await post(token, `hi ${i}`));
    // Out of messages, but the same clientId replays instead of being refused.
    expect((await post(token, 'hello', clientId)).status).toBe(200);
  });

  it('clearing a conversation does not give messages back', async () => {
    const token = await newSession(app);
    await useFreeMessages(token);
    await call(app, token, 'DELETE', '/conversations/roy');
    expect((await credits(token)).messages.freeLeftToday).toBe(0);
    expect((await post(token, 'fresh start?')).status).toBe(402);
  });

  it('a demo ad adds bonus messages, once per ad, a few times a day', async () => {
    const token = await newSession(app);
    await useFreeMessages(token);
    const ad = (adId: string) => call(app, token, 'POST', '/messages/ad', { adId });

    const first = CreditsResponseSchema.parse(await (await ad('ad-00000001')).json());
    expect(first.messages.bonus).toBe(AD_REWARD_MESSAGES);
    // A retried claim of the same ad counts once.
    await ad('ad-00000001');
    expect((await credits(token)).messages.bonus).toBe(AD_REWARD_MESSAGES);

    await events(await post(token, 'thanks to the ad'));
    expect((await credits(token)).messages.bonus).toBe(AD_REWARD_MESSAGES - 1);

    for (let i = 2; i <= MAX_ADS_PER_DAY; i++) await ad(`ad-0000000${i}`);
    expect((await credits(token)).messages.adsLeftToday).toBe(0);
    expect((await ad('ad-00000099')).status).toBe(429);
  });

  it('a demo pack adds bonus messages once per purchaseId', async () => {
    const token = await newSession(app);
    const buy = () =>
      call(app, token, 'POST', '/messages/purchase', {
        packId: 'messages-50',
        purchaseId: 'pack-00000001',
      });
    await buy();
    await buy();
    expect((await credits(token)).messages.bonus).toBe(50);
    expect((await call(app, token, 'POST', '/messages/purchase', { packId: 'nope' })).status).toBe(
      400,
    );
  });

  it('Plus is unlimited and never touches the free count', async () => {
    const token = await newSession(app);
    await call(app, token, 'POST', '/plus', { plan: 'monthly' });
    for (let i = 0; i < FREE_DAILY_MESSAGES + 2; i++) {
      expect((await post(token, `plus ${i}`)).status).toBe(200);
    }
    const { messages } = await credits(token);
    expect(messages.unlimited).toBe(true);
    expect(messages.freeLeftToday).toBe(FREE_DAILY_MESSAGES);
  });

  it("one user's usage, ads, and packs never affect another's", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    await useFreeMessages(a);
    await call(app, a, 'POST', '/messages/ad', { adId: 'shared-ad-id' });
    // B reusing A's ad id gets B's own reward.
    await call(app, b, 'POST', '/messages/ad', { adId: 'shared-ad-id' });
    expect((await credits(b)).messages).toMatchObject({
      freeLeftToday: FREE_DAILY_MESSAGES,
      bonus: AD_REWARD_MESSAGES,
    });
    expect((await credits(a)).messages.bonus).toBe(AD_REWARD_MESSAGES);
  });

  it('the free allowance resets at UTC midnight', async () => {
    const token = await newSession(app);
    const userId = userIdOf(token);
    const day = new Date('2026-10-20T23:00:00Z');
    for (let i = 0; i < FREE_DAILY_MESSAGES; i++) {
      expect(await spendMessage(database.db, userId, day)).toBe('free');
    }
    expect(await spendMessage(database.db, userId, day)).toBeNull();
    const next = new Date('2026-10-21T00:00:01Z');
    expect((await getAllowance(database.db, userId, next))?.freeLeftToday).toBe(
      FREE_DAILY_MESSAGES,
    );
    expect(await spendMessage(database.db, userId, next)).toBe('free');
    expect((await getAllowance(database.db, userId, day))?.resetsAt).toBe(
      '2026-10-21T00:00:00.000Z',
    );
  });
});
