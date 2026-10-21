import { UserProfileSchema, type ApiError } from '@after-hours/contracts';
import { Hono } from 'hono';

import { requireUser, type AuthEnv } from '../auth/session';
import type { Db } from '../db/client';
import { setProfile } from '../db/users';

const BAD_REQUEST: ApiError = {
  code: 'bad_request',
  message: 'Those answers could not be saved.',
  retryable: false,
};

/**
 * `PUT /profile`: the user's onboarding answers (D-032), used to pace and personalize the
 * first conversations. Deleted with the account.
 */
export function profileRoutes(db: Db, sessionSecret: string) {
  return new Hono<AuthEnv>()
    .use('/profile', requireUser(db, sessionSecret))
    .put('/profile', async (c) => {
      const parsed = UserProfileSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      await setProfile(db, c.var.userId, parsed.data);
      return c.body(null, 204);
    });
}
