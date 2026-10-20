import { StartersResponseSchema, type PublicCharacter } from '@after-hours/contracts';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './transport';

export const STARTERS_QUERY_KEY = ['starters'] as const;

async function fetchStarters(companion: PublicCharacter): Promise<string[]> {
  try {
    const res = await apiRequest('GET', `/conversations/${companion.id}/starters`);
    return StartersResponseSchema.parse(await res.json()).starters;
  } catch {
    return companion.publicProfile.starters;
  }
}

/**
 * Tap-to-send lines for an empty thread, written for this user from their onboarding
 * answers and what the companion remembers (D-032). The companion's default starters show
 * while they load and stand in for the demo fallback or a failed request.
 */
export function useStarters(
  companion: PublicCharacter | undefined,
  options: { enabled?: boolean; isDemo?: boolean } = {},
): string[] {
  const { enabled = true, isDemo = false } = options;
  const query = useQuery({
    queryKey: [...STARTERS_QUERY_KEY, companion?.id],
    queryFn: () => (companion ? fetchStarters(companion) : []),
    enabled: !!companion && enabled && !isDemo,
    // The server caches them until memories change; refetching on mount is cheap.
    staleTime: 0,
  });
  if (!companion) return [];
  if (isDemo) return companion.publicProfile.starters;
  return query.data ?? companion.publicProfile.starters;
}
