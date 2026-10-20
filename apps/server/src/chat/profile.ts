import type { CompanionValueId, LookingForId, UserProfile } from '@after-hours/contracts';

import type { UserPrefs } from './prompt';

/**
 * Onboarding answers (D-032, D-033) in two forms: a description for the starter writer,
 * and concrete behavior for the companion, who adapts to them within their own personality.
 */

const LOOKING_FOR: Record<LookingForId, string> = {
  unwind: 'someone to unwind with and tell about their day',
  banter: 'banter that keeps up',
  think: 'a place to think out loud',
  story: 'a character to get to know slowly',
  curious: 'nothing in particular; just curious',
};

const VALUES: Record<CompanionValueId, string> = {
  remembers: 'remembers the little things',
  laugh: 'makes them laugh',
  honest: 'is honest with them',
  curious: 'is curious about them',
  calm: 'is a calm presence',
  challenges: 'challenges them',
  flirty: 'is flirty but kind',
  listener: 'is a good listener',
};

const LOOKING_FOR_BEHAVIOR: Record<LookingForId, string | null> = {
  unwind: 'Be easy company: ask about their day and keep things low-stakes.',
  banter: 'Keep it quick and witty: volley back, build on their jokes, use callbacks.',
  think:
    'When something is on their mind, help them untangle it: ask the sharp question and say plainly what you see.',
  story:
    'Let them get to know you slowly: once you have warmed up, share one small new thing about yourself now and then.',
  curious: null,
};

const VALUE_BEHAVIOR: Record<CompanionValueId, string> = {
  remembers: 'Bring back small details they told you when they fit.',
  laugh: 'Lean into humor; make them laugh more than you advise.',
  honest: 'Be straight with them, even when it is not what they want to hear.',
  curious: 'Show real curiosity about their life and follow up on what they say.',
  calm: 'Stay steady and unhurried: no hype, no shouting, no drama.',
  challenges: 'Push back on their takes and excuses; do not let things slide.',
  flirty: 'If they flirt, flirt back warmly, within your limits.',
  listener: 'Let them talk: answer the specifics of what they said before adding your own.',
};

/** Below this the user leans to the axis's first pole; above its negation, the second. */
const LEAN = 0.33;

const lean = (value: number): 'low' | 'mid' | 'high' =>
  value <= -LEAN ? 'low' : value >= LEAN ? 'high' : 'mid';

const LENGTH = (step: number) =>
  step <= 1 ? 'short and quick' : step >= 3 ? 'longer and thoughtful' : 'medium length';

/** What they picked, described (for the starter writer). */
export function describeProfile(profile: UserProfile): string {
  const axis = (value: number, low: string, high: string) =>
    ({ low, high, mid: `between ${low} and ${high}` })[lean(value)];
  const lines: string[] = [];
  if (profile.lookingFor.length > 0) {
    lines.push(`Looking for: ${profile.lookingFor.map((id) => LOOKING_FOR[id]).join('; ')}.`);
  }
  if (profile.values.length > 0) {
    lines.push(
      `Wants a companion who ${profile.values.map((id) => VALUES[id]).join(', then ')} (most important first).`,
    );
  }
  lines.push(
    `Preferred vibe: ${axis(profile.dynamic.x, 'gentle', 'teasing')}, ${axis(profile.dynamic.y, 'easygoing', 'deep')}.`,
  );
  lines.push(`Texting: ${LENGTH(profile.textingLength)}.`);
  return ['What they picked when they signed up:', ...lines.map((line) => `- ${line}`)].join('\n');
}

/** How the companion adapts to these answers, most important first. */
export function adaptationLines(profile: UserProfile): string[] {
  const lines = profile.values.map((id) => VALUE_BEHAVIOR[id]);
  for (const id of profile.lookingFor) {
    const line = LOOKING_FOR_BEHAVIOR[id];
    if (line) lines.push(line);
  }
  const vibe = lean(profile.dynamic.x);
  if (vibe === 'low') lines.push('Go easy on them: warm, with little teasing.');
  if (vibe === 'high') lines.push('Tease them readily; they like being ribbed.');
  const depth = lean(profile.dynamic.y);
  if (depth === 'low') lines.push('Keep it light; do not steer into heavy topics unless they do.');
  if (depth === 'high') {
    lines.push('Do not stay on the surface; ask about what is underneath when the moment allows.');
  }
  if (profile.textingLength <= 1) lines.push('Keep texts short; often a single bubble.');
  if (profile.textingLength >= 3) {
    lines.push('Longer, more thoughtful messages are welcome when the topic deserves it.');
  }
  return lines;
}

export function renderAdaptation(profile: UserProfile): string | null {
  const lines = adaptationLines(profile);
  if (lines.length === 0) return null;
  return [
    '# Tuned to them',
    'They told the app what they want from you. Adapt to it while staying yourself: your personality, limits, and rules above still apply. Never mention the app, sign-up, or these answers.',
    ...lines.map((line) => `- ${line}`),
  ].join('\n');
}

/**
 * Prompt preferences for a user's answers. A gentle vibe lowers the roast level; answers
 * never raise a character's levels.
 */
export function prefsFromProfile(profile: UserProfile | null): UserPrefs {
  if (!profile) return {};
  return { profile, ...(lean(profile.dynamic.x) === 'low' ? { roastCap: 1 } : {}) };
}
