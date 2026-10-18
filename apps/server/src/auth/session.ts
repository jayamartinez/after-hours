import type { ApiError } from '@after-hours/contracts';
import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';

import type { Db } from '../db/client';
import { userExists } from '../db/users';

/**
 * Anonymous device sessions (D-023): `POST /session` creates a user row and returns an
 * HS256 token signed with `SESSION_SECRET`. The app sends it as `Authorization: Bearer`.
 */

const ISSUER = 'after-hours';
const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

export async function issueSessionToken(
  secret: string,
  userId: string,
  now = Date.now(),
): Promise<string> {
  const iat = Math.floor(now / 1000);
  return sign({ sub: userId, iss: ISSUER, iat, exp: iat + TOKEN_TTL_SECONDS }, secret, 'HS256');
}

/** The user id in a valid token, or null (bad signature, expired, malformed). */
export async function verifySessionToken(secret: string, token: string): Promise<string | null> {
  try {
    const payload = await verify(token, secret, { alg: 'HS256', iss: ISSUER });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export type AuthEnv = { Variables: { userId: string } };

const UNAUTHORIZED: ApiError = {
  code: 'unauthorized',
  message: 'Your session expired. Reopen the app to start a new one.',
  retryable: true,
};

/** Resolves `c.var.userId` from the bearer token; 401 when missing, invalid, or unknown. */
export function requireUser(db: Db, secret: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
    const userId = token ? await verifySessionToken(secret, token) : null;
    // A token can outlive its user row (e.g. a wiped local database).
    if (!userId || !(await userExists(db, userId))) return c.json(UNAUTHORIZED, 401);
    c.set('userId', userId);
    await next();
  });
}
