import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  AD_REWARD_MESSAGES,
  ApiErrorSchema,
  FREE_MAX_MESSAGE_CHARS,
  MAX_MESSAGE_CHARS,
  CreditsResponseSchema,
  FREE_DAILY_MESSAGES,
  MAX_ADS_PER_DAY,
  PLUS_DAILY_MESSAGES,
} from '@after-hours/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { openDatabase, type Database } from '../db/client';
import { DAILY_COST_BUDGET_USD, replyCostMicroUsd } from '../chat/costs';
import { SEND_PHOTO } from '../chat/photo-tool';
import { addSpend, getAllowance, spendMessage } from '../db/message-allowance';
import { spendUsage, webUsage } from '../db/schema';
import { ChatModelError } from '../providers/types';
import { call, events, newSession, nextClientId, scriptedModel, USAGE } from '../test-chat';
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
      plan: 'free',
      dailyIncluded: FREE_DAILY_MESSAGES,
      includedLeftToday: FREE_DAILY_MESSAGES,
      bonus: 0,
      adsLeftToday: MAX_ADS_PER_DAY,
    });
  });

  it('refuses a new message once the free ones are used, without storing it or calling the model', async () => {
    const token = await newSession(app);
    await useFreeMessages(token);
    expect((await credits(token)).messages.includedLeftToday).toBe(0);
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
    expect((await credits(token)).messages.includedLeftToday).toBe(0);
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

  it('Plus includes more messages a day, counted the same way', async () => {
    const token = await newSession(app);
    await call(app, token, 'POST', '/plus', { plan: 'monthly' });
    for (let i = 0; i < FREE_DAILY_MESSAGES + 2; i++) {
      expect((await post(token, `plus ${i}`)).status).toBe(200);
    }
    const { messages } = await credits(token);
    expect(messages).toMatchObject({
      plan: 'plus',
      dailyIncluded: PLUS_DAILY_MESSAGES,
      includedLeftToday: PLUS_DAILY_MESSAGES - FREE_DAILY_MESSAGES - 2,
    });
  });

  it('past the daily cost budget only bonus messages go through, and the budget stays hidden', async () => {
    const token = await newSession(app);
    const userId = userIdOf(token);
    await addSpend(database.db, userId, Math.round(DAILY_COST_BUDGET_USD.free * 1_000_000));
    const { messages } = await credits(token);
    expect(messages.includedLeftToday).toBe(0);
    expect(JSON.stringify(messages)).not.toMatch(/budget|usd|spend/i);
    expect((await post(token, 'over budget')).status).toBe(402);

    await call(app, token, 'POST', '/messages/ad', { adId: 'budget-ad-01' });
    expect((await post(token, 'paid for this one')).status).toBe(200);
    expect((await credits(token)).messages.bonus).toBe(AD_REWARD_MESSAGES - 1);
  });

  it('records the estimated cost of each reply', async () => {
    const token = await newSession(app);
    await events(await post(token, 'hi'));
    const [row] = await database.db
      .select()
      .from(spendUsage)
      .where(eq(spendUsage.userId, userIdOf(token)));
    expect(row?.microUsd).toBeGreaterThan(0);
  });

  describe('every billed request counts against the cost budget', () => {
    const spentBy = async (token: string) => {
      const [row] = await database.db
        .select()
        .from(spendUsage)
        .where(eq(spendUsage.userId, userIdOf(token)));
      return row?.microUsd ?? 0;
    };
    const lookupsBy = async (token: string) => {
      const [row] = await database.db
        .select()
        .from(webUsage)
        .where(eq(webUsage.userId, userIdOf(token)));
      return row?.count ?? 0;
    };
    /** One scripted request's estimated cost. */
    const one = (model = 'test-model', lookups = 0) => replyCostMicroUsd(model, USAGE, lookups);
    const billedOnce = (lookups = 0) => [
      { model: 'test-model', usage: USAGE, webRequests: lookups },
    ];
    const photoCall = {
      id: 'call_1',
      name: SEND_PHOTO,
      input: { moment: 'desk, cold coffee', caption: 'look' },
    };

    it('a refusal after output', async () => {
      const token = await newSession(app);
      chat.script.push({
        chunks: ['so about that'],
        error: new ChatModelError('refusal', 'declined', false, { billed: billedOnce(1) }),
      });
      const list = await events(await post(token, 'hm'));
      expect(list.at(-1)?.type).toBe('error');
      expect(await spentBy(token)).toBe(one('test-model', 1));
      expect(await lookupsBy(token)).toBe(1);
    });

    it('an error in the second tool round', async () => {
      const token = await newSession(app);
      chat.script.push(
        { chunks: ['one sec'], toolCalls: [photoCall] },
        {
          chunks: [],
          error: new ChatModelError('api', 'boom', true, { billed: billedOnce() }),
        },
      );
      const list = await events(await post(token, 'send a pic'));
      expect(list.at(-1)?.type).toBe('error');
      expect(await spentBy(token)).toBe(2 * one());
    });

    it('an empty reply', async () => {
      const token = await newSession(app);
      chat.script.push({ chunks: [] });
      const list = await events(await post(token, 'hello?'));
      expect(list.at(-1)?.type).toBe('error');
      expect(await spentBy(token)).toBe(one());
    });

    it('a retried first attempt, and the retry of a failed message', async () => {
      const token = await newSession(app);
      const clientId = nextClientId();
      chat.script.push(
        {
          chunks: [],
          error: new ChatModelError('api', 'overloaded', true, { billed: billedOnce() }),
        },
        {
          chunks: [],
          error: new ChatModelError('api', 'overloaded', true, { billed: billedOnce() }),
        },
      );
      expect((await events(await post(token, 'hey', clientId))).at(-1)?.type).toBe('error');
      expect(await spentBy(token)).toBe(2 * one());

      // Resending the undelivered message spends no message, but its cost still counts.
      const before = await credits(token);
      expect((await events(await post(token, 'hey', clientId))).at(-1)?.type).toBe('done');
      expect(await spentBy(token)).toBe(3 * one());
      expect((await credits(token)).messages.includedLeftToday).toBe(
        before.messages.includedLeftToday,
      );
    });

    it('prices each request at the model that served it', async () => {
      const token = await newSession(app);
      chat.script.push(
        { chunks: ['one sec'], toolCalls: [photoCall], model: 'claude-opus-5-5' },
        { chunks: ['there'], model: 'claude-sonnet-5-5' },
      );
      expect((await events(await post(token, 'send a pic'))).at(-1)?.type).toBe('done');
      expect(await spentBy(token)).toBe(one('claude-opus-5-5') + one('claude-sonnet-5-5'));
    });
  });

  it("one user's usage, ads, and packs never affect another's", async () => {
    const a = await newSession(app);
    const b = await newSession(app);
    await useFreeMessages(a);
    await call(app, a, 'POST', '/messages/ad', { adId: 'shared-ad-id' });
    // B reusing A's ad id gets B's own reward.
    await call(app, b, 'POST', '/messages/ad', { adId: 'shared-ad-id' });
    expect((await credits(b)).messages).toMatchObject({
      includedLeftToday: FREE_DAILY_MESSAGES,
      bonus: AD_REWARD_MESSAGES,
    });
    expect((await credits(a)).messages.bonus).toBe(AD_REWARD_MESSAGES);
  });

  it('the free allowance resets at UTC midnight', async () => {
    const token = await newSession(app);
    const userId = userIdOf(token);
    const day = new Date('2026-10-20T23:00:00Z');
    for (let i = 0; i < FREE_DAILY_MESSAGES; i++) {
      expect(await spendMessage(database.db, userId, day)).toBe('included');
    }
    expect(await spendMessage(database.db, userId, day)).toBeNull();
    const next = new Date('2026-10-21T00:00:01Z');
    expect((await getAllowance(database.db, userId, next))?.includedLeftToday).toBe(
      FREE_DAILY_MESSAGES,
    );
    expect(await spendMessage(database.db, userId, next)).toBe('included');
    expect((await getAllowance(database.db, userId, day))?.resetsAt).toBe(
      '2026-10-21T00:00:00.000Z',
    );
  });
});

describe('free and Plus tiers (D-040)', () => {
  let free: ReturnType<typeof scriptedModel>;
  let tiered: ReturnType<typeof createApp>;

  beforeEach(() => {
    free = scriptedModel();
    tiered = createApp(testConfig(workDir, { rateLimitPerMin: 1_000 }), () => {}, {
      chat: {
        db: database.db,
        model: chat.model,
        freeModel: free.model,
        sessionSecret: 'test-session-secret-0123456789abcdef',
      },
    });
  });

  const send = (token: string, text: string) =>
    call(tiered, token, 'POST', '/conversations/roy/messages', { text, clientId: nextClientId() });

  it('free users get the free model and the shorter message limit', async () => {
    const token = await newSession(tiered);
    await events(await send(token, 'x'.repeat(FREE_MAX_MESSAGE_CHARS)));
    expect(free.requests).toHaveLength(1);
    expect(chat.requests).toHaveLength(0);

    const res = await send(token, 'x'.repeat(FREE_MAX_MESSAGE_CHARS + 1));
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).code).toBe('message_too_long');
    // Refused before anything is stored or spent.
    expect((await credits(token)).messages.includedLeftToday).toBe(FREE_DAILY_MESSAGES - 1);
  });

  it('Plus users get the Plus model and the full limit', async () => {
    const token = await newSession(tiered);
    await call(tiered, token, 'POST', '/plus', { plan: 'monthly' });
    await events(await send(token, 'y'.repeat(MAX_MESSAGE_CHARS)));
    expect(chat.requests).toHaveLength(1);
    expect(free.requests).toHaveLength(0);
  });
});
