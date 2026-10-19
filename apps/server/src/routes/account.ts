import { Hono } from 'hono';

import { requireUser, type AuthEnv } from '../auth/session';
import type { Db } from '../db/client';
import { deleteUser } from '../db/users';

/**
 * `DELETE /account`: deletes the anonymous user with every conversation, message, and
 * memory (cascade). The token stops working; the app starts a new session afterwards.
 */
export function accountRoutes(db: Db, sessionSecret: string) {
  return new Hono<AuthEnv>()
    .use('/account', requireUser(db, sessionSecret))
    .delete('/account', async (c) => {
      await deleteUser(db, c.var.userId);
      return c.body(null, 204);
    });
}
