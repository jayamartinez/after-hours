import { z } from 'zod';

/** Lowercase slug, e.g. "roy". Logic never branches on a specific id. */
export const CompanionIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

const unit = z.number().min(0).max(1);

/** Focal point `[x, y]`, each 0..1, used as the cover-crop anchor. */
export const FocalPointSchema = z.tuple([unit, unit]);

export const ImageSlotNameSchema = z.enum(['hero', 'avatar', 'gallery']);

/**
 * One resolved image slot. `uri: null` means no image: the app ships no art (D-030) and shows a
 * loading pulse. `asset` is the slot's key (e.g. "roy/hero").
 */
export const ImageSlotSchema = z.object({
  uri: z.string().min(1).nullable(),
  asset: z.string(),
  focal: FocalPointSchema,
  alt: z.string(),
});

export const CompanionImagesSchema = z.object({
  hero: ImageSlotSchema,
  avatar: ImageSlotSchema,
  gallery: z.tuple([ImageSlotSchema, ImageSlotSchema]),
});

export type CompanionId = z.infer<typeof CompanionIdSchema>;
export type FocalPoint = z.infer<typeof FocalPointSchema>;
export type ImageSlotName = z.infer<typeof ImageSlotNameSchema>;
export type ImageSlot = z.infer<typeof ImageSlotSchema>;
export type CompanionImages = z.infer<typeof CompanionImagesSchema>;
