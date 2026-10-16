import { DevCharacterResponseSchema, type DevCharacterResponse } from '@after-hours/contracts';

import { API_URL } from './config';

export type SaveResult =
  | { ok: true; data: DevCharacterResponse }
  | { ok: false; data?: DevCharacterResponse; error: string };

const devUrl = (id: string) => `${API_URL}/dev/companions/${encodeURIComponent(id)}`;

async function readError(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error;
  }
  return `Request failed with ${res.status}`;
}

export async function fetchDevCharacter(id: string): Promise<DevCharacterResponse> {
  const res = await fetch(devUrl(id));
  if (!res.ok) throw new Error(await readError(res));
  return DevCharacterResponseSchema.parse(await res.json());
}

/** Saves a deep-partial override. A 422 carries the validation issues. */
export async function saveDevCharacter(id: string, override: object): Promise<SaveResult> {
  const res = await fetch(devUrl(id), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(override),
  });
  if (res.ok) return { ok: true, data: DevCharacterResponseSchema.parse(await res.json()) };
  if (res.status === 422) {
    const data = DevCharacterResponseSchema.parse(await res.json());
    return { ok: false, data, error: 'Not saved: the override is invalid.' };
  }
  return { ok: false, error: await readError(res) };
}
