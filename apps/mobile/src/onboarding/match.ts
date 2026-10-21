import type { PublicCharacter } from '@after-hours/contracts';

import type { CompanionValue, LookingFor, OnboardingPreferences } from './preferences';

/** What matching reads from a companion: public meters, match tags, and chips. */
export type MatchableCompanion = Pick<PublicCharacter, 'id'> & {
  publicProfile: Pick<PublicCharacter['publicProfile'], 'meters' | 'chips' | 'matchTags'>;
};

/**
 * Answer → tag keywords. A companion whose match tags or chips contain a keyword scores for
 * it, so matching follows character config rather than hard-coded ids.
 */
const LOOKING_FOR_KEYWORDS: Record<LookingFor, readonly string[]> = {
  unwind: ['supportive', 'calm', 'warm'],
  banter: ['banter', 'playful', 'irreverent', 'quick'],
  think: ['honest', 'blunt', 'opinionated'],
  story: ['charismatic', 'mysterious', 'perceptive'],
  curious: [],
};

const VALUE_KEYWORDS: Record<CompanionValue, readonly string[]> = {
  remembers: ['attentive', 'loyal'],
  laugh: ['funny', 'chaotic', 'irreverent', 'playful'],
  honest: ['honest', 'blunt', 'sincere'],
  curious: ['curious'],
  calm: ['calm', 'gentle', 'warm'],
  challenges: ['competitive', 'provocative', 'blunt'],
  flirty: ['flirt'],
  listener: ['listener', 'supportive', 'perceptive'],
};

/** Earlier picks on "what matters" count more. */
const VALUE_RANK_WEIGHTS = [3, 2, 1] as const;
const PACE_INDEX = { easy: 0, quick: 1, instant: 2 } as const;
const METER_MAX = 5;

function keywordScore(companion: MatchableCompanion, keywords: readonly string[]): number {
  const { matchTags, chips } = companion.publicProfile;
  const haystack = [...matchTags, ...chips].map((t) => t.toLowerCase());
  return keywords.some((keyword) => haystack.some((trait) => trait.includes(keyword))) ? 1 : 0;
}

/** Target depth 0–5 from the dynamic pad and "looking for" answers. */
function depthTarget(prefs: OnboardingPreferences): number {
  let target = ((prefs.dynamic.y + 1) / 2) * METER_MAX;
  if (prefs.lookingFor.includes('story') || prefs.lookingFor.includes('think')) target += 0.5;
  return Math.min(METER_MAX, target);
}

/** Target pace 0 (easy) – 2 (instant) from the reply-speed slider. */
const paceTarget = (prefs: OnboardingPreferences) => (prefs.texting.pace / 4) * 2;

export function scoreCompanion(
  prefs: OnboardingPreferences,
  companion: MatchableCompanion,
): number {
  let score = 0;
  for (const answer of prefs.lookingFor)
    score += keywordScore(companion, LOOKING_FOR_KEYWORDS[answer]);
  prefs.values.forEach((value, rank) => {
    score += (VALUE_RANK_WEIGHTS[rank] ?? 1) * keywordScore(companion, VALUE_KEYWORDS[value]);
  });
  // Teasing side of the pad pulls toward characters with an edge, gentle side toward soft ones.
  if (prefs.dynamic.x > 0)
    score += 2 * prefs.dynamic.x * keywordScore(companion, ['teasing', 'irreverent']);
  if (prefs.dynamic.x < 0)
    score += 2 * -prefs.dynamic.x * keywordScore(companion, ['supportive', 'gentle', 'sincere']);
  // Short texts suit companions with instant pace; long texts suit slower ones.
  const { meters } = companion.publicProfile;
  score -= Math.abs(meters.depth - depthTarget(prefs)) / 2;
  score -= Math.abs(PACE_INDEX[meters.pace] - paceTarget(prefs)) / 2;
  if (prefs.texting.length <= 1) score += PACE_INDEX[meters.pace] / 4;
  return score;
}

/**
 * Scores within this of the best are a toss-up: answers close to the defaults (a quick
 * tap-through) land here, and they used to go to Roya nearly every time.
 */
export const CLOSE_MATCH = 1;

/**
 * Picks the companion whose config best fits the answers. A clear winner always wins; a
 * toss-up goes to one of the close companions by `tiebreak` (0 to 1, stored per device), so
 * the same answers on the same device always give the same id. Returns null only when
 * there are no companions.
 */
export function matchCompanion(
  prefs: OnboardingPreferences,
  companions: readonly MatchableCompanion[],
  tiebreak = 0,
): string | null {
  const scored = companions.map((companion) => ({
    id: companion.id,
    score: scoreCompanion(prefs, companion),
  }));
  if (scored.length === 0) return null;
  const top = Math.max(...scored.map((c) => c.score));
  const close = scored.filter((c) => top - c.score < CLOSE_MATCH);
  const pick = Math.min(
    close.length - 1,
    Math.floor(Math.max(0, Math.min(1, tiebreak)) * close.length),
  );
  return close[pick]?.id ?? null;
}

/** The first companion that is not `id`, the reveal's "Not feeling it? See …" target. */
export function otherCompanion<T extends { id: string }>(
  companions: readonly T[],
  id: string | null,
): T | undefined {
  return companions.find((companion) => companion.id !== id);
}
