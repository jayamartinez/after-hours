import { presets, toPublicCharacter } from '@after-hours/companions';
import { CompanionsResponseSchema, type PublicCharacter } from '@after-hours/contracts';
import { useQuery } from '@tanstack/react-query';

import { API_URL } from './config';

const REQUEST_TIMEOUT_MS = 4000;

export const COMPANIONS_QUERY_KEY = ['companions'] as const;

export interface CompanionsResult {
  companions: PublicCharacter[];
  /** `local`: the server was unreachable or invalid; bundled presets are shown, with no images. */
  source: 'server' | 'local';
}

/** Bundled presets projected to the public shape (no overrides, so every image slot is empty). */
const bundledCompanions = (): PublicCharacter[] =>
  presets.map((preset) => toPublicCharacter(preset));

async function fetchFromServer(): Promise<PublicCharacter[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/companions`, { signal: controller.signal });
    if (!res.ok) throw new Error(`GET /companions failed with ${res.status}`);
    return CompanionsResponseSchema.parse(await res.json()).companions;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server first (presets + local overrides + resolved images). If the server is unreachable
 * or returns an invalid body, fall back to the bundled presets.
 */
export async function loadCompanions(): Promise<CompanionsResult> {
  try {
    return { companions: await fetchFromServer(), source: 'server' };
  } catch (error) {
    console.warn('[companions] Server unavailable; showing bundled profiles.', error);
    return { companions: bundledCompanions(), source: 'local' };
  }
}

/** The one source of companion identity, copy, and images for every screen. */
export function useCompanions() {
  return useQuery({ queryKey: COMPANIONS_QUERY_KEY, queryFn: loadCompanions, staleTime: 60_000 });
}

export function useCompanion(id: string | undefined) {
  const query = useCompanions();
  return { ...query, companion: query.data?.companions.find((c) => c.id === id) };
}
