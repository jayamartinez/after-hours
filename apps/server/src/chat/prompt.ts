import type { CharacterConfig, CharacterStyle } from '@after-hours/contracts';

import { SAFETY_PREAMBLE } from './safety';

/** Onboarding preferences. They can only lower a character's flirtation and roast levels. */
export interface UserPrefs {
  name?: string;
  flirtationCap?: number;
  roastCap?: number;
}

const FLIRTATION: readonly string[] = [
  'No flirting. If the user flirts, deflect lightly and change the subject.',
  'Light flirtation only: a warm compliment now and then, nothing more.',
  'Flirt back playfully when the user flirts. Keep it PG-13: never explicit, never pressuring.',
  'Bold, confident flirting is fine, but always PG-13: never explicit, never pressuring.',
];

const ROAST: readonly string[] = [
  'Do not roast or tease.',
  'Tease gently, and only about excuses or ideas.',
  'Tease and roast excuses and ideas with a wink, never the person.',
  'Roast excuses and weak plans bluntly, never the person.',
];

const BUBBLE_LENGTH: Record<CharacterStyle['bubbleLength'], string> = {
  short: 'each a short line (under about 60 characters)',
  medium: 'each one or two sentences',
  long: 'each a few sentences',
};

const clampLevel = (value: number, cap: number | undefined) =>
  Math.max(0, Math.min(value, cap ?? value, 3));

function frequency(rate: number, never: string, rare: string, some: string, often: string) {
  if (rate <= 0) return never;
  if (rate < 0.15) return rare;
  if (rate < 0.5) return some;
  return often;
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderStyle(style: CharacterStyle, prefs: UserPrefs = {}): string {
  const [min, max] = style.burst;
  const count = min === max ? `${min}` : `${min}–${max}`;
  return bulletList([
    style.casing === 'lower'
      ? 'Write in all lowercase, including the first word of each message.'
      : 'Use normal sentence case and punctuation.',
    `Send ${count} separate message bubble${max === 1 ? '' : 's'} per turn, ${BUBBLE_LENGTH[style.bubbleLength]}.`,
    frequency(
      style.emojiRate,
      'Never use emoji.',
      'Emoji are rare; most turns have none.',
      'Use an emoji occasionally.',
      'Use emoji often.',
    ),
    frequency(
      style.questionRate,
      'Do not end turns with questions.',
      'Rarely end a turn with a question.',
      'Sometimes end a turn with a question or challenge.',
      'Usually end a turn with a question or challenge.',
    ),
    FLIRTATION[clampLevel(style.flirtation, prefs.flirtationCap)] ?? '',
    ROAST[clampLevel(style.roast, prefs.roastCap)] ?? '',
  ]);
}

function renderExamples(character: CharacterConfig): string {
  return character.examples.messages
    .map((exchange) => {
      const reply = exchange.companion.map((bubble) => `${character.name}: ${bubble}`).join('\n');
      return exchange.user ? `User: ${exchange.user}\n${reply}` : reply;
    })
    .join('\n\n');
}

/**
 * System prompt for one character: app safety preamble (fixed) → identity → behavior →
 * boundaries → style → signature lines → examples → user preferences → memories.
 */
export function buildSystemPrompt(
  character: CharacterConfig,
  prefs: UserPrefs = {},
  memories: readonly string[] = [],
): string {
  const { name, pronouns } = character;
  const sections: string[] = [
    `# Rules (always apply)\n${bulletList(SAFETY_PREAMBLE)}`,
    [
      '# Who you are',
      `You are ${name} (${pronouns.subject}/${pronouns.object}), ${character.age}, a fictional character in the After Hours app. ${character.tagline}`,
      `Where you are: ${character.location}.`,
      character.backstory,
      `You love talking about: ${character.interests.join(', ')}.`,
      `Users see this disclosure about you: "${character.disclosure.note}"`,
    ].join('\n'),
    `# How you behave\n${character.personality.instructions}\nTraits: ${character.personality.traits.join(', ')}.`,
  ];

  if (character.personality.boundaries.length > 0) {
    sections.push(`# Boundaries\n${bulletList(character.personality.boundaries)}`);
  }
  sections.push(`# How you text\n${renderStyle(character.style, prefs)}`);
  if (character.examples.signatureLines.length > 0) {
    sections.push(
      `# Signature lines (use sparingly, never every turn)\n${bulletList(character.examples.signatureLines)}`,
    );
  }
  if (character.examples.messages.length > 0) {
    sections.push(
      `# Example exchanges (tone reference, do not repeat verbatim)\n${renderExamples(character)}`,
    );
  }
  if (prefs.name) sections.push(`# The user\nThey go by ${prefs.name}.`);
  if (character.memory.enabled && memories.length > 0) {
    const recalled = memories.slice(0, character.memory.maxRetrieved);
    sections.push(`# What you remember about them\n${bulletList(recalled)}`);
  }
  return sections.join('\n\n');
}
