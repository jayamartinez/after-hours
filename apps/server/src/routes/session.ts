import type { ApiError, SessionResponse } from '@after-hours/contracts';
import { Hono } from 'hono';

import { issueSessionToken } from '../auth/session';
import type { Db } from '../db/client';
import type { DemoLimits } from '../config';
import { takeNetworkSession } from '../db/demo-limits';
import { createUser } from '../db/users';
import { clientAddress, networkKey } from '../limits/network';
import { createRateLimiter } from '../limits/rate-limit';

/** New anonymous sessions per client address per minute. */
const SESSIONS_PER_MIN = 10;

/** `POST /session`: a new anonymous user and its bearer token (D-023). */
export function sessionRoutes(db: Db, secret: string, limits: DemoLimits) {
  const limiter = createRateLimiter(SESSIONS_PER_MIN);
  return new Hono().post('/session', async (c) => {
    const address = clientAddress(c, limits.trustProxy);
    if (!limiter.take(address)) {
      const error: ApiError = {
        code: 'rate_limited',
        message: 'Too many new sessions. Wait a minute and try again.',
        retryable: true,
      };
      return c.json(error, 429);
    }
    // A daily cap per network, stored, so minting fresh accounts cannot reset the limits.
    const network = networkKey(address, secret);
    if (!(await takeNetworkSession(db, network, limits.sessionsPerNetworkPerDay))) {
      const error: ApiError = {
        code: 'rate_limited',
        message: 'Too many new accounts from this network today. Try again tomorrow.',
        retryable: false,
      };
      return c.json(error, 429);
    }
    const userId = await createUser(db);
    const body: SessionResponse = { token: await issueSessionToken(secret, userId), userId };
    return c.json(body, 201);
  });
}
