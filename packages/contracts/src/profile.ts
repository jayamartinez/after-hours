import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * What the user shared in onboarding, stored per user on the server so companions can
 * pace and personalize the first conversation (`PUT /profile`). Ids match the onboarding
 * option lists in the app.
 */
export const LookingForSchema = z.enum(['unwind', 'banter', 'think', 'story', 'curious']);
export const CompanionValueSchema = z.enum([
  'remembers',
  'laugh',
  'honest',
  'curious',
  'calm',
  'challenges',
  'flirty',
  'listener',
]);

const unit = z.number().min(-1).max(1);
const step = z.number().int().min(0).max(4);

export const UserProfileSchema = z.object({
  lookingFor: z.array(LookingForSchema).max(5),
  /** Ordered, at most three. */
  values: z.array(CompanionValueSchema).max(3),
  /** x: gentle (-1) → teasing (+1). y: easygoing (-1) → deep (+1). */
  dynamic: z.object({ x: unit, y: unit }),
  /** 0 short & quick … 4 long & thoughtful. */
  textingLength: step,
});

/** Tap-to-send lines for an empty thread, written for this user (`GET …/starters`). */
export const StartersResponseSchema = z.object({
  companionId: CompanionIdSchema,
  starters: z.array(z.string().min(1).max(80)).max(6),
});

export type LookingForId = z.infer<typeof LookingForSchema>;
export type CompanionValueId = z.infer<typeof CompanionValueSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type StartersResponse = z.infer<typeof StartersResponseSchema>;
