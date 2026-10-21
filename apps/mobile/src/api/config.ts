/**
 * Public client config. `EXPO_PUBLIC_*` values are inlined into the bundle and are
 * visible to anyone, never put secrets here.
 */
const DEFAULT_API_URL = 'http://localhost:8787';

function readApiUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_URL;
  if (!/^https?:\/\/[^/]+/i.test(raw)) {
    console.warn(
      `[config] EXPO_PUBLIC_API_URL "${raw}" is not an http(s) URL; using ${DEFAULT_API_URL}.`,
    );
    return DEFAULT_API_URL;
  }
  return raw.replace(/\/+$/, '');
}

export const API_URL = readApiUrl();

/**
 * Local character editor (`/dev/companions`). Off unless `EXPO_PUBLIC_DEV_EDITOR=true` at
 * bundle time; it also needs the server's `DEV_EDITOR=true` and a localhost connection.
 */
export const DEV_EDITOR_ENABLED = process.env.EXPO_PUBLIC_DEV_EDITOR === 'true';
