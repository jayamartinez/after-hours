/**
 * Live readouts derived from answers (texting preview, dynamic label, matching chips).
 * App copy only; nothing here speaks for a companion.
 */
import {
  RHYTHMS,
  VALUES,
  windowLength,
  type Dynamic,
  type OnboardingPreferences,
  type TalkWindow,
  type TextingStyle,
} from './preferences';

export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

export function rhythmFor(window: TalkWindow) {
  return RHYTHMS.find((r) => r.window.start === window.start && r.window.end === window.end);
}

/** Matching-moment chip for the talk window: exact rhythm, else by where the window starts. */
export function rhythmChip(window: TalkWindow): string {
  const exact = rhythmFor(window);
  if (exact) return exact.chip;
  if (window.start >= 5 && window.start < 17) return 'daytime talker';
  if (window.start >= 17 && window.start < 21) return 'evening person';
  return windowLength(window) <= 3 && window.start < 5 ? 'small hours' : 'night owl';
}

// --- Texting preview ---------------------------------------------------------------------

const LENGTH_WORDS = ['Short', 'Short', 'Medium', 'Long', 'Long'] as const;
const EXPRESSIVE_WORDS = [
  'plain',
  'low-key',
  'easygoing',
  'a little playful',
  'very expressive',
] as const;
const PACE_WORDS = [
  'replies when it can',
  'replies within the hour',
  'replies in a minute or two',
  'replies fast',
  'replies instantly',
] as const;

export function textingCaption(style: TextingStyle): string {
  return [
    LENGTH_WORDS[style.length],
    EXPRESSIVE_WORDS[style.expressiveness],
    PACE_WORDS[style.pace],
  ].join(' · ');
}

export interface PreviewBubble {
  from: 'them' | 'you';
  text: string;
}

const SHORT_LINES = [
  'long day or just a loud one?',
  'loud. the printer and I are no longer speaking',
  'good. it knows what it did.',
] as const;
const LONG_LINES = [
  'how was today, really? long day, or just a loud one?',
  'loud. the printer jammed three times before lunch and we are no longer speaking',
  'good. it knows exactly what it did, and honestly it should apologize first.',
] as const;
const EMOJI = ['', ' 😤', ' 😌'] as const;

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Three sample bubbles that change with the sliders. */
export function previewBubbles(style: TextingStyle): PreviewBubble[] {
  const lines = style.length >= 3 ? LONG_LINES : SHORT_LINES;
  return lines.map((line, i) => {
    let text: string = line;
    if (style.expressiveness <= 1) text = sentenceCase(text);
    if (style.expressiveness >= 4) text = `${text}${EMOJI[i] ?? ''}`;
    if (style.expressiveness === 0) text = text.replace(/[?.!]$/, '');
    return { from: i === 1 ? 'you' : 'them', text };
  });
}

// --- Dynamic pad -------------------------------------------------------------------------

export const QUADRANTS = {
  kindred: { label: 'Kindred', line: 'Gentle, and happy to go deep.' },
  sparks: { label: 'Sparks', line: 'Teasing, but you’ll go deep at 2 AM.' },
  cozy: { label: 'Cozy', line: 'Soft, slow, and easy on a long day.' },
  playful: { label: 'Playful', line: 'Quick jokes, light stakes, no homework.' },
} as const;
export type Quadrant = keyof typeof QUADRANTS;

export function quadrantFor({ x, y }: Dynamic): Quadrant {
  if (y >= 0) return x >= 0 ? 'sparks' : 'kindred';
  return x >= 0 ? 'playful' : 'cozy';
}

// --- Matching moment ---------------------------------------------------------------------

/** Answer chips that float around the matching animation, most prominent first. */
export function matchingChips(prefs: OnboardingPreferences): string[] {
  const chips: string[] = [];
  chips.push(rhythmChip(prefs.talkWindow));
  chips.push(prefs.dynamic.x >= 0 ? 'teasing' : 'gentle');
  chips.push(
    prefs.texting.length <= 1
      ? 'short texts'
      : prefs.texting.length >= 3
        ? 'long texts'
        : 'medium texts',
  );
  const top = VALUES.find((v) => v.id === prefs.values[0]);
  chips.push(top ? top.label.toLowerCase() : prefs.dynamic.y >= 0 ? 'goes deep' : 'easygoing');
  chips.push(prefs.voice === 'voice' ? 'voice notes too' : 'texts only');
  return chips;
}
