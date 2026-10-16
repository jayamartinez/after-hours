import { z } from 'zod';

import { CompanionIdSchema, CompanionImagesSchema, FocalPointSchema } from './companion';

/**
 * Character configuration (docs/companions.md). Presets live in
 * `packages/companions/presets/*.json`; deployers override fields in the git-ignored
 * `config/companions.local.json`. Objects are strict so a typo in an override is reported
 * instead of silently ignored.
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

export const PersonalitySchema = z.strictObject({
  traits: z.array(text).min(1),
  instructions: text.describe('Behavioral instructions for the system prompt, second person'),
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
    .describe('Bubbles per turn, [min, max]'),
  emojiRate: unit,
  questionRate: unit,
  flirtation: level3.describe('0 none, 1 light, 2 playful, 3 bold (always PG-13)'),
  roast: level3.describe('0 none, 1 gentle, 2 teasing, 3 blunt (excuses and ideas only)'),
});

export const ExampleExchangeSchema = z.strictObject({
  user: text.optional(),
  companion: z.array(text).min(1).describe('Reply bubbles'),
});

export const ExamplesSchema = z.strictObject({
  messages: z.array(ExampleExchangeSchema).describe('Few-shot exchanges for the prompt'),
  starters: z.array(text).describe('Conversation starters / quick replies'),
  signatureLines: z.array(text),
});

export const VoiceConfigSchema = z.strictObject({
  description: text,
  summary: text.describe(
    'Short form of the description for compact rows, e.g. "Fast, bright tenor"',
  ),
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
  about: text,
  talks: text,
  voice: text,
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
  profileSections: ProfileSectionsSchema,
  voiceLabel: text,
  sampleOpener: text.describe('Example opening line shown on discovery ("He might open with")'),
  chatLocation: text
    .optional()
    .describe('Short fictional place for the chat header status, e.g. "South Calder"'),
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

export const CharacterConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  id: CompanionIdSchema.describe('Immutable slug'),
  name: text,
  age: z.number().int().min(21),
  pronouns: PronounsSchema,
  tagline: text,
  statusLine: text,
  location: text.describe('Fictional place'),
  locationShort: text.describe('Short place label for status lines, e.g. "South Calder"'),
  blurb: text.describe('One or two sentences for discovery cards and the cast list'),
  tint: TintSchema,
  bio: text.describe('Short; profile "About"'),
  backstory: text,
  interests: z.array(text),
  chips: z.array(text).length(3),
  talkStyle: z.array(text).min(1).max(6).describe('Profile "How they talk" chips'),
  meters: MetersSchema,
  disclosure: DisclosureSchema,
  personality: PersonalitySchema,
  style: StyleSchema,
  examples: ExamplesSchema,
  voice: VoiceConfigSchema,
  memory: MemoryConfigSchema,
  proactive: ProactiveConfigSchema,
  copy: CharacterCopySchema,
  appearance: AppearanceSchema,
  images: CharacterImagesSchema,
});

/**
 * What the app receives from `GET /companions`. Prompt-only and feature config
 * (instructions, boundaries, example exchanges, style, memory, proactive, voice ids,
 * appearance) stays on the server.
 */
export const PublicCharacterSchema = z.object({
  id: CompanionIdSchema,
  name: text,
  age: z.number().int().min(21),
  pronouns: PronounsSchema,
  tagline: z.string(),
  statusLine: z.string(),
  location: z.string(),
  locationShort: z.string(),
  blurb: z.string(),
  tint: TintSchema,
  bio: z.string(),
  backstory: z.string(),
  interests: z.array(z.string()),
  chips: z.array(z.string()),
  talkStyle: z.array(z.string()),
  meters: MetersSchema,
  disclosure: DisclosureSchema,
  personality: z.object({ traits: z.array(z.string()) }),
  examples: z.object({ starters: z.array(z.string()), signatureLines: z.array(z.string()) }),
  voice: z.object({ description: z.string(), summary: z.string() }),
  /** `proactive.enabledByDefault`: the default for the user's "Proactive messages" toggle. */
  proactiveByDefault: z.boolean(),
  copy: CharacterCopySchema,
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
export type ImageSlotDefault = z.infer<typeof ImageSlotDefaultSchema>;
export type CharacterConfig = z.infer<typeof CharacterConfigSchema>;
export type PublicCharacter = z.infer<typeof PublicCharacterSchema>;
export type CompanionsResponse = z.infer<typeof CompanionsResponseSchema>;
export type CharacterOverrides = z.infer<typeof CharacterOverridesSchema>;
export type ConfigIssue = z.infer<typeof ConfigIssueSchema>;
export type DevCharacterResponse = z.infer<typeof DevCharacterResponseSchema>;
