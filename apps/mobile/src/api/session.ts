import { SessionResponseSchema } from '@after-hours/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from './config';

/**
 * Anonymous device session (D-023): the server issues a signed token on first use; the
 * app keeps it in AsyncStorage (native and web) and sends it as a bearer token.
 */
const STORAGE_KEY = 'after-hours.session.v1';

let pending: Promise<string> | null = null;

async function createSession(): Promise<string> {
  const res = await fetch(`${API_URL}/session`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST /session failed with ${res.status}`);
  const { token } = SessionResponseSchema.parse(await res.json());
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable (private mode): the session lasts until reload.
  }
  return token;
}

/** The stored token, or a new session. Concurrent callers share one request. */
export function getSessionToken(): Promise<string> {
  pending ??= (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch {
      // Fall through to a new session.
    }
    return createSession();
  })().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

/** Drops a token the server rejected; the next call creates a new session. */
export async function resetSession(): Promise<void> {
  pending = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * Authenticated request to the API. A 401 (expired token, wiped database) gets one fresh
 * session and one retry.
 */
export async function authedFetch<R extends { status: number }>(
  request: (token: string) => Promise<R>,
): Promise<R> {
  const res = await request(await getSessionToken());
  if (res.status !== 401) return res;
  await resetSession();
  return request(await getSessionToken());
}
