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
  banter: ['teasing', 'sarcastic', 'banter'],
  think: ['honest', 'blunt'],
  story: ['charismatic', 'mysterious'],
  curious: [],
};

const VALUE_KEYWORDS: Record<CompanionValue, readonly string[]> = {
  remembers: ['supportive', 'attentive'],
  laugh: ['sarcastic', 'chaotic', 'funny'],
  honest: ['blunt', 'honest'],
  curious: ['curious', 'charismatic'],
  calm: ['calm', 'gentle'],
  challenges: ['competitive', 'provocative', 'blunt'],
  flirty: ['flirt'],
  listener: ['listener', 'supportive'],
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
  // Teasing side of the pad pulls toward teasing/flirty characters, gentle side toward supportive.
  if (prefs.dynamic.x > 0)
    score += 2 * prefs.dynamic.x * keywordScore(companion, ['teasing', 'flirt']);
  if (prefs.dynamic.x < 0)
    score += 2 * -prefs.dynamic.x * keywordScore(companion, ['supportive', 'gentle']);
  // Short texts suit companions with instant pace; long texts suit slower ones.
  const { meters } = companion.publicProfile;
  score -= Math.abs(meters.depth - depthTarget(prefs)) / 2;
  score -= Math.abs(PACE_INDEX[meters.pace] - paceTarget(prefs)) / 2;
  if (prefs.texting.length <= 1) score += PACE_INDEX[meters.pace] / 4;
  return score;
}

/**
 * Picks the companion whose config best fits the answers. Deterministic: the same answers
 * and companions always give the same id; ties go to the earlier companion in the list.
 * Returns null only when there are no companions.
 */
export function matchCompanion(
  prefs: OnboardingPreferences,
  companions: readonly MatchableCompanion[],
): string | null {
  let best: { id: string; score: number } | null = null;
  for (const companion of companions) {
    const score = scoreCompanion(prefs, companion);
    if (!best || score > best.score + 1e-9) best = { id: companion.id, score };
  }
  return best?.id ?? null;
}

/** The first companion that is not `id` — the reveal's "Not feeling it? See …" target. */
export function otherCompanion<T extends { id: string }>(
  companions: readonly T[],
  id: string | null,
): T | undefined {
  return companions.find((companion) => companion.id !== id);
}
