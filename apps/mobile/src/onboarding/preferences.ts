/**
 * Onboarding answers. These feed prompt preferences later (M3), so the shape is exported as
 * `OnboardingPreferences`. Option labels here are app copy, not companion copy.
 */

export const LOOKING_FOR = [
  { id: 'unwind', title: 'Someone to unwind with', detail: 'Low stakes. Tell them about the day.' },
  { id: 'banter', title: 'Banter that keeps up', detail: 'Quick wit, callbacks, a little edge.' },
  { id: 'think', title: 'A place to think out loud', detail: 'Untangle a thought, out loud.' },
  { id: 'story', title: 'A character to get to know', detail: 'A story that unfolds slowly.' },
  { id: 'curious', title: 'Just curious', detail: 'No plan. See where it goes.' },
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number]['id'];

export const VALUES = [
  { id: 'remembers', label: 'Remembers the little things' },
  { id: 'laugh', label: 'Makes me laugh' },
  { id: 'honest', label: 'Honest with me' },
  { id: 'curious', label: 'Curious about me' },
  { id: 'calm', label: 'Calm presence' },
  { id: 'challenges', label: 'Challenges me' },
  { id: 'flirty', label: 'Flirty but kind' },
  { id: 'listener', label: 'Good listener' },
] as const;
export type CompanionValue = (typeof VALUES)[number]['id'];
export const MAX_VALUES = 3;

/** Hours on a 24-hour clock, 0–23. `end` may be smaller than `start` (window crosses midnight). */
export interface TalkWindow {
  start: number;
  end: number;
}

export const RHYTHMS = [
  { id: 'evenings', label: 'Evenings', chip: 'evening person', window: { start: 18, end: 22 } },
  { id: 'late-night', label: 'Late night', chip: 'night owl', window: { start: 22, end: 1 } },
  { id: 'small-hours', label: 'Small hours', chip: 'small hours', window: { start: 0, end: 4 } },
] as const;

/** Slider positions, 0–4 (five stops). */
export type SliderStep = 0 | 1 | 2 | 3 | 4;
export const SLIDER_STEPS = 5;

export interface TextingStyle {
  /** 0 short & quick … 4 long & thoughtful. */
  length: SliderStep;
  /** 0 plain … 4 expressive. */
  expressiveness: SliderStep;
  /** 0 slow replies OK … 4 instant. */
  pace: SliderStep;
}

/**
 * Position on the dynamic pad, each axis -1…1.
 * x: gentle (-1) → teasing (+1). y: easygoing (-1) → deep (+1).
 */
export interface Dynamic {
  x: number;
  y: number;
}

export type VoicePreference = 'text' | 'voice';

export interface OnboardingPreferences {
  lookingFor: LookingFor[];
  talkWindow: TalkWindow;
  texting: TextingStyle;
  /** Ordered, at most three. */
  values: CompanionValue[];
  dynamic: Dynamic;
  voice: VoicePreference;
  allowCalls: boolean;
}

export const DEFAULT_PREFERENCES: OnboardingPreferences = {
  lookingFor: [],
  talkWindow: { start: 22, end: 1 },
  texting: { length: 1, expressiveness: 3, pace: 2 },
  values: [],
  dynamic: { x: 0.55, y: 0.52 },
  voice: 'voice',
  allowCalls: false,
};

export const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));
export const wrapHour = (hour: number) => ((Math.round(hour) % 24) + 24) % 24;

/** Hours covered by a window, end exclusive; a zero-length window covers none. */
export function windowLength({ start, end }: TalkWindow): number {
  return (end - start + 24) % 24;
}

export function isHourInWindow(hour: number, window: TalkWindow): boolean {
  const offset = (wrapHour(hour) - window.start + 24) % 24;
  return offset <= windowLength(window);
}

/** A fresh copy of the defaults (no shared nested objects). */
export const defaultPreferences = (): OnboardingPreferences => ({
  ...DEFAULT_PREFERENCES,
  lookingFor: [...DEFAULT_PREFERENCES.lookingFor],
  talkWindow: { ...DEFAULT_PREFERENCES.talkWindow },
  texting: { ...DEFAULT_PREFERENCES.texting },
  values: [...DEFAULT_PREFERENCES.values],
  dynamic: { ...DEFAULT_PREFERENCES.dynamic },
});
