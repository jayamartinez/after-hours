import { ApiErrorSchema } from '@after-hours/contracts';
import { fetch as expoFetch } from 'expo/fetch';

import type { ApiResponse, ApiTransport } from '@/chat/api-source';

import { API_URL } from './config';
import { authedFetch } from './session';

const REQUEST_TIMEOUT_MS = 8000;

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The app's API transport. Plain requests use global fetch with a timeout; reply streams
 * use `expo/fetch`, which exposes a streaming `response.body` on iOS and is the browser's
 * own fetch on web.
 */
export const apiTransport: ApiTransport = {
  get: (path) =>
    authedFetch((token) =>
      withTimeout(
        (signal) =>
          fetch(`${API_URL}${path}`, {
            headers: { authorization: `Bearer ${token}` },
            signal,
          }) as Promise<ApiResponse>,
      ),
    ),

  postStream: (path, body) =>
    authedFetch(
      (token) =>
        expoFetch(`${API_URL}${path}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
        }) as Promise<ApiResponse>,
    ),
};

const UNREACHABLE = 'Can’t reach After Hours right now. Check your connection and try again.';

/** A failed API call; `message` is user-facing (the server's, or a connection hint). */
export class ApiRequestError extends Error {}

/**
 * JSON request to the API (memories, account). Resolves with an `ok` response; otherwise
 * throws `ApiRequestError` carrying text a screen can show as is.
 */
export async function apiRequest(method: string, path: string, body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await authedFetch((token) =>
      withTimeout((signal) =>
        fetch(`${API_URL}${path}`, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        }),
      ),
    );
  } catch {
    throw new ApiRequestError(UNREACHABLE);
  }
  if (res.ok) return res;
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  throw new ApiRequestError(
    parsed.success ? parsed.data.message : 'Something went wrong. Try again.',
  );
}
