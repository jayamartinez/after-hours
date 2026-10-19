import type { ApiError, SessionResponse } from '@after-hours/contracts';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';

import { issueSessionToken } from '../auth/session';
import type { Db } from '../db/client';
import { createUser } from '../db/users';
import { createRateLimiter } from '../limits/rate-limit';

/** New anonymous sessions per client address per minute. */
const SESSIONS_PER_MIN = 10;

function clientAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // `app.request` in tests has no socket.
    return 'unknown';
  }
}

/** `POST /session`: a new anonymous user and its bearer token (D-023). */
export function sessionRoutes(db: Db, secret: string) {
  const limiter = createRateLimiter(SESSIONS_PER_MIN);
  return new Hono().post('/session', async (c) => {
    if (!limiter.take(clientAddress(c))) {
      const error: ApiError = {
        code: 'rate_limited',
        message: 'Too many new sessions. Wait a minute and try again.',
        retryable: true,
      };
      return c.json(error, 429);
    }
    const userId = await createUser(db);
    const body: SessionResponse = { token: await issueSessionToken(secret, userId), userId };
    return c.json(body, 201);
  });
}
