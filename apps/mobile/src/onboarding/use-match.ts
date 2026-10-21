import type { PublicCharacter } from '@after-hours/contracts';

import { useCompanions } from '@/api/companions';

import { matchCompanion, otherCompanion } from './match';
import { useOnboarding } from './use-onboarding';

export interface MatchResult {
  companions: PublicCharacter[];
  /** Picked companion: the stored choice if it still exists, else the match for current answers. */
  companion: PublicCharacter | undefined;
  other: PublicCharacter | undefined;
  isLoading: boolean;
}

/** Current match from answers (or the user's explicit switch on the reveal). */
export function useMatch(): MatchResult {
  const { data, isLoading } = useCompanions();
  const prefs = useOnboarding((s) => s.preferences);
  const storedId = useOnboarding((s) => s.matchedCompanionId);
  const tiebreak = useOnboarding((s) => s.matchTiebreak);
  const companions = data?.companions ?? [];
  const stored = companions.find((c) => c.id === storedId);
  const matchedId = stored?.id ?? matchCompanion(prefs, companions, tiebreak);
  const companion = companions.find((c) => c.id === matchedId);
  return { companions, companion, other: otherCompanion(companions, matchedId), isLoading };
}
