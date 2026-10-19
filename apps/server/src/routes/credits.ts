import {
  PurchaseCreditsRequestSchema,
  StartPlusRequestSchema,
  type ApiError,
  type GalleryResponse,
} from '@after-hours/contracts';
import { Hono } from 'hono';

import { requireUser, type AuthEnv } from '../auth/session';
import type { Db } from '../db/client';
import { listPhotos } from '../db/conversations';
import { endPlus, getCredits, purchaseCredits, startPlus } from '../db/credits';
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

/** Demo purchases per user per minute. */
const PURCHASES_PER_MIN = 10;

/**
 * Photo credits and the demo Plus subscription (D-026), plus the gallery of photos sent
 * in chat. Purchases are demo only: nothing is charged. All scoped to the session user.
 */
export function creditRoutes(db: Db, sessionSecret: string) {
  const limiter = createRateLimiter(PURCHASES_PER_MIN);

  return new Hono<AuthEnv>()
    .use('/credits', requireUser(db, sessionSecret))
    .use('/credits/*', requireUser(db, sessionSecret))
    .use('/plus', requireUser(db, sessionSecret))
    .use('/gallery', requireUser(db, sessionSecret))

    .get('/credits', async (c) => {
      const body = await getCredits(db, c.var.userId);
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/credits/purchase', async (c) => {
      const parsed = PurchaseCreditsRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      if (!limiter.take(c.var.userId)) return c.json(RATE_LIMITED, 429);
      const body = await purchaseCredits(
        db,
        c.var.userId,
        parsed.data.packId,
        parsed.data.purchaseId,
      );
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .post('/plus', async (c) => {
      const parsed = StartPlusRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      const body = await startPlus(db, c.var.userId, parsed.data.plan);
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .delete('/plus', async (c) => {
      const body = await endPlus(db, c.var.userId);
      return body ? c.json(body) : c.json(GONE, 401);
    })

    .get('/gallery', async (c) => {
      const body: GalleryResponse = { photos: await listPhotos(db, c.var.userId) };
      return c.json(body);
    });
}
