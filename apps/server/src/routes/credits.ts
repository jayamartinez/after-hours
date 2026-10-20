import {
  ClaimAdRequestSchema,
  PurchaseCreditsRequestSchema,
  PurchaseMessagesRequestSchema,
  StartPlusRequestSchema,
  type ApiError,
  type CreditsResponse,
  type GalleryResponse,
} from '@after-hours/contracts';
import { Hono } from 'hono';

import { requireUser, type AuthEnv } from '../auth/session';
import type { Db } from '../db/client';
import { listPhotos } from '../db/conversations';
import { endPlus, getCredits, purchaseCredits, startPlus, type PhotoCredits } from '../db/credits';
import { claimAd, getAllowance, purchaseMessages } from '../db/message-allowance';
import { createRateLimiter } from '../limits/rate-limit';

const BAD_REQUEST: ApiError = {
  code: 'bad_request',
  message: 'That purchase could not be completed.',
  retryable: false,
};
const RATE_LIMITED: ApiError = {
  code: 'rate_limited',
  message: 'Slow down a little. Try again in a minute.',
  retryable: true,
};
/** The user row vanished between auth and the query (account deleted meanwhile). */
const GONE: ApiError = {
  code: 'unauthorized',
  message: 'Your session expired. Reopen the app to start a new one.',
  retryable: true,
};

const NO_ADS_LEFT: ApiError = {
  code: 'rate_limited',
  message: 'No more ads today. Your messages come back at midnight UTC.',
  retryable: false,
};

/** Demo purchases per user per minute. */
const PURCHASES_PER_MIN = 10;

/**
 * Photo credits and the demo Plus subscription (D-026), the message allowance with demo
 * packs and demo ads (D-036), and the gallery of photos sent in chat. Purchases and ads
 * are demo only: nothing is charged and no ad is shown. All scoped to the session user.
 */
export function creditRoutes(db: Db, sessionSecret: string) {
  const limiter = createRateLimiter(PURCHASES_PER_MIN);

  /** Every credits response carries the message allowance too. */
  const withMessages = async (
    userId: string,
    photos: PhotoCredits | null,
  ): Promise<CreditsResponse | null> => {
    const messages = photos ? await getAllowance(db, userId) : null;
    return photos && messages ? { ...photos, messages } : null;
  };

  return new Hono<AuthEnv>()
    .use('/credits', requireUser(db, sessionSecret))
    .use('/credits/*', requireUser(db, sessionSecret))
    .use('/messages/*', requireUser(db, sessionSecret))
    .use('/plus', requireUser(db, sessionSecret))
    .use('/gallery', requireUser(db, sessionSecret))

    .get('/credits', async (c) => {
      const body = await withMessages(c.var.userId, await getCredits(db, c.var.userId));
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/messages/purchase', async (c) => {
      const parsed = PurchaseMessagesRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      if (!limiter.take(c.var.userId)) return c.json(RATE_LIMITED, 429);
      await purchaseMessages(db, c.var.userId, parsed.data.packId, parsed.data.purchaseId);
      const body = await withMessages(c.var.userId, await getCredits(db, c.var.userId));
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/messages/ad', async (c) => {
      const parsed = ClaimAdRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      if (!limiter.take(c.var.userId)) return c.json(RATE_LIMITED, 429);
      if (!(await claimAd(db, c.var.userId, parsed.data.adId))) return c.json(NO_ADS_LEFT, 429);
      const body = await withMessages(c.var.userId, await getCredits(db, c.var.userId));
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/credits/purchase', async (c) => {
      const parsed = PurchaseCreditsRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      if (!limiter.take(c.var.userId)) return c.json(RATE_LIMITED, 429);
      const body = await withMessages(
        c.var.userId,
        await purchaseCredits(db, c.var.userId, parsed.data.packId, parsed.data.purchaseId),
      );
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/plus', async (c) => {
      const parsed = StartPlusRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      const body = await withMessages(
        c.var.userId,
        await startPlus(db, c.var.userId, parsed.data.plan),
      );
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .delete('/plus', async (c) => {
      const body = await withMessages(c.var.userId, await endPlus(db, c.var.userId));
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .get('/gallery', async (c) => {
      const body: GalleryResponse = { photos: await listPhotos(db, c.var.userId) };
      return c.json(body);
    });
}
