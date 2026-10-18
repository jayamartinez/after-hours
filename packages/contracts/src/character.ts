import { z } from 'zod';

import { CompanionIdSchema, CompanionImagesSchema, FocalPointSchema } from './companion';

/**
 * Character configuration (docs/companions.md). Presets live in
 * `packages/companions/presets/*.json`; deployers override fields in the git-ignored
 * `config/companions.local.json`. Objects are strict so a typo in an override is reported
 * instead of silently ignored.
 *
 * Groups: identity at the top level (both sides), `publicProfile` (the only character
 * content the app may display), `persona` (server-only, builds the LLM prompt), and
 * server-only feature config (`voice`, `memory`, `proactive`, `appearance`).
 */

const text = z.string().trim().min(1);
const unit = z.number().min(0).max(1);
const level3 = z.number().int().min(0).max(3);
const level5 = z.number().int().min(0).max(5);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected "HH:MM" (24-hour)');

export const PronounsSchema = z.strictObject({
  subject: text.describe('e.g. "he"'),
  object: text.describe('e.g. "him"'),
  possessive: text.describe('e.g. "his"'),
});

export const MetersSchema = z.strictObject({
  banter: level5,
  depth: level5,
  pace: z.enum(['easy', 'quick', 'instant']),
});

export const DisclosureSchema = z.strictObject({
  badge: text.describe('Pill next to the name, e.g. "AI PARODY"'),
  note: text.describe('One short line, shown once in the profile footer'),
});

/**
 * How the character behaves in each conversational register, one to three lines each, in
 * the character's own terms. The prompt asks the model to read the situation and pick the
 * register silently.
 */
export const ConversationModesSchema = z.strictObject({
  casual: text.describe('Casual joking and banter'),
  teasing: text.describe('Light teasing'),
  smallTalk: text.describe('Small talk and ordinary topics: food, music, plans, their day'),
  relationshipAdvice: text.describe('Dating, friendships, and relationship advice'),
  goodNews: text.describe('The user had a good day or has good news'),
  badDay: text.describe('The user had a frustrating day'),
  sincere: text.describe('Genuinely emotional moments: lonely, sad, scared'),
  disagreement: text.describe('The user disagrees, or the character thinks they are wrong'),
  flirting: text.describe('The user flirts (bounded by style.flirtation)'),
  building: text.describe(
    'The user brings up a startup, project, code, or tech work. The only place founder talk belongs.',
  ),
});

export const PersonalitySchema = z.strictObject({
  traits: z.array(text).min(1),
  instructions: text.describe('Behavioral instructions for the system prompt, second person'),
  modes: ConversationModesSchema,
  boundaries: z
    .array(text)
    .describe('Character-specific do-nots. The app-level safety preamble always applies too.'),
});

export const StyleSchema = z.strictObject({
  casing: z.enum(['lower', 'sentence']),
  bubbleLength: z.enum(['short', 'medium', 'long']),
  burst: z
    .tuple([z.number().int().min(1).max(4), z.number().int().min(1).max(4)])
    .refine(([min, max]) => min <= max, 'burst must be [min, max] with min <= max')
    .describe('Usual bubbles per turn, [min, max]; the model varies within it'),
  emojiRate: unit,
  questionRate: unit,
  flirtation: level3.describe('0 none, 1 light, 2 playful, 3 bold (always PG-13)'),
  roast: level3.describe('0 none, 1 gentle, 2 teasing, 3 blunt (excuses and ideas only)'),
  profanity: level3.describe('0 never, 1 rare and mild, 2 occasional for emphasis, 3 casual'),
});

export const ExampleExchangeSchema = z.strictObject({
  user: text.optional(),
  companion: z.array(text).min(1).describe('Reply bubbles'),
});

export const ExamplesSchema = z.strictObject({
  messages: z.array(ExampleExchangeSchema).describe('Few-shot exchanges for the prompt'),
  signatureLines: z.array(text).describe('Voice reference lines for the prompt'),
});

export const VoiceConfigSchema = z.strictObject({
  description: text,
  provider: text.optional(),
  voiceId: text.optional(),
  voiceIdEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .optional()
    .describe('Name of the env var holding the TTS voice id'),
  speed: z.number().min(0.5).max(2).optional(),
});

export const MemoryConfigSchema = z.strictObject({
  enabled: z.boolean(),
  focus: z.array(text),
  maxRetrieved: z.number().int().min(1).max(20),
});

export const ProactiveConfigSchema = z.strictObject({
  enabledByDefault: z.boolean(),
  quietHours: z.strictObject({ start: clock, end: clock }),
  maxPerDay: z.number().int().min(0).max(5),
  openers: z.array(text),
});

export const ProfileSectionsSchema = z.strictObject({
  remembers: text,
  photos: text,
});

export const CharacterCopySchema = z.strictObject({
  spotlightCta: text,
  revealHeadline: text,
  revealSubline: text,
  revealCta: text.describe('Reveal screen primary button, e.g. "Say hi"'),
  matchReasons: z.array(text),
  firstMessage: z.array(text).min(1).describe('Opening bubbles'),
  sampleOpener: text.describe('Example opening line shown on discovery ("He might open with")'),
  voiceLabel: text.describe('Spotlight voice pill, e.g. "Hear his voice"'),
  profileSections: ProfileSectionsSchema,
});

/** Default art for one slot: a key into the app's bundled image registry plus crop and alt. */
export const ImageSlotDefaultSchema = z.strictObject({
  asset: z
    .string()
    .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)
    .describe('Bundled default image key, e.g. "roy/hero"'),
  focal: FocalPointSchema,
  alt: text,
});

export const CharacterImagesSchema = z.strictObject({
  hero: ImageSlotDefaultSchema.describe('3:4'),
  avatar: ImageSlotDefaultSchema.describe('1:1'),
  gallery: z.tuple([ImageSlotDefaultSchema, ImageSlotDefaultSchema]).describe('Two 4:5 images'),
});

/** Accent family for status lines, dots, and waveforms. Maps to design tokens in the app. */
export const TintSchema = z.enum(['window', 'lamplight']);

/** Art direction for image generation (server-only). */
export const AppearanceSchema = z.strictObject({
  style: text,
  look: text,
});

/** The only character content the app may display or use. */
export const PublicProfileSchema = z.strictObject({
  chips: z.array(text).length(3).describe('Short temperament tags on the Spotlight card'),
  meters: MetersSchema,
  voiceSummary: text.describe('Short voice label for compact rows, e.g. "Fast, bright tenor"'),
  matchTags: z.array(text).min(1).describe('Keywords onboarding matching scores against'),
  starters: z.array(text).describe('Conversation starters / quick replies'),
  about: text.describe(
    'Two or three plain sentences on temperament, shown only in the profile "About" sheet (⋯). No invented biography.',
  ),
  copy: CharacterCopySchema,
});

/** Server-only: everything the LLM prompt is built from. Never sent to the app. */
export const PersonaSchema = z.strictObject({
  backstory: text.describe('Temperament, habits of mind, how they are with people'),
  interests: z.array(text),
  personality: PersonalitySchema,
  style: StyleSchema,
  examples: ExamplesSchema,
});

export const CharacterConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  id: CompanionIdSchema.describe('Immutable slug'),
  name: text,
  age: z.number().int().min(21),
  pronouns: PronounsSchema,
  tint: TintSchema,
  disclosure: DisclosureSchema,
  images: CharacterImagesSchema,
  publicProfile: PublicProfileSchema,
  persona: PersonaSchema,
  voice: VoiceConfigSchema,
  memory: MemoryConfigSchema,
  proactive: ProactiveConfigSchema,
  appearance: AppearanceSchema,
});

/**
 * What the app receives from `GET /companions`: identity, `publicProfile`, the proactive
 * default, and resolved images. `persona` and feature config stay on the server.
 */
export const PublicCharacterSchema = z.object({
  id: CompanionIdSchema,
  name: text,
  age: z.number().int().min(21),
  pronouns: PronounsSchema,
  tint: TintSchema,
  disclosure: DisclosureSchema,
  publicProfile: PublicProfileSchema,
  /** `proactive.enabledByDefault`: the default for the user's "Proactive messages" toggle. */
  proactiveByDefault: z.boolean(),
  images: CompanionImagesSchema,
});

export const CompanionsResponseSchema = z.object({
  companions: z.array(PublicCharacterSchema),
});

/** `config/companions.local.json`: `{ "<id>": <deep partial CharacterConfig> }`. Validated after merge. */
export const CharacterOverridesSchema = z.record(
  CompanionIdSchema,
  z.record(z.string(), z.unknown()),
);

export const ConfigIssueSchema = z.object({ path: z.string(), message: z.string() });

/** Dev editor: `GET`/`PUT /dev/companions/:id`. */
export const DevCharacterResponseSchema = z.object({
  id: CompanionIdSchema,
  preset: CharacterConfigSchema,
  override: z.record(z.string(), z.unknown()).nullable(),
  merged: CharacterConfigSchema,
  valid: z.boolean(),
  issues: z.array(ConfigIssueSchema),
  public: PublicCharacterSchema,
});

export type Pronouns = z.infer<typeof PronounsSchema>;
export type CharacterTint = z.infer<typeof TintSchema>;
export type CharacterStyle = z.infer<typeof StyleSchema>;
export type ConversationModes = z.infer<typeof ConversationModesSchema>;
export type ImageSlotDefault = z.infer<typeof ImageSlotDefaultSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type CharacterConfig = z.infer<typeof CharacterConfigSchema>;
export type PublicCharacter = z.infer<typeof PublicCharacterSchema>;
export type CompanionsResponse = z.infer<typeof CompanionsResponseSchema>;
export type CharacterOverrides = z.infer<typeof CharacterOverridesSchema>;
export type ConfigIssue = z.infer<typeof ConfigIssueSchema>;
export type DevCharacterResponse = z.infer<typeof DevCharacterResponseSchema>;
