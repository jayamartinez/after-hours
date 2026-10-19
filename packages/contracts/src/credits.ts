import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * Photo credits (D-026). A companion's photo costs one credit. Purchases are a demo: no
 * payment is taken and the UI labels every price as such (D-008).
 */

/** Credits every new user starts with. */
export const FREE_STARTING_CREDITS = 3;
/** Credits the demo Plus subscription adds every 30 days while active. */
export const PLUS_MONTHLY_CREDITS = 50;
/** Days per Plus credit period. */
export const PLUS_PERIOD_DAYS = 30;
/** Highest balance a user can reach through demo purchases. */
export const MAX_CREDIT_BALANCE = 999;

export const CREDIT_PACKS = [
  { id: 'photos-10', credits: 10, demoPrice: '$2.99' },
  { id: 'photos-30', credits: 30, demoPrice: '$6.99' },
  { id: 'photos-100', credits: 100, demoPrice: '$14.99' },
] as const;

export const CreditPackIdSchema = z.enum(['photos-10', 'photos-30', 'photos-100']);
export const PlusPlanSchema = z.enum(['annual', 'monthly']);

/** `GET /credits`, and the body of every credits mutation. */
export const CreditsResponseSchema = z.object({
  balance: z.number().int().min(0),
  /** Active demo Plus subscription, or null. */
  plus: z
    .object({
      plan: PlusPlanSchema,
      /** When the next monthly credits arrive (ISO 8601). */
      nextCreditsAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

/** `POST /credits/purchase` (demo). `purchaseId` makes a retried tap count once. */
export const PurchaseCreditsRequestSchema = z.object({
  packId: CreditPackIdSchema,
  purchaseId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

/** `POST /plus` (demo): starts Plus, which adds monthly photo credits. */
export const StartPlusRequestSchema = z.object({ plan: PlusPlanSchema });

/** One photo a companion sent in chat (`GET /gallery`). */
export const GalleryPhotoSchema = z.object({
  messageId: z.string().min(1),
  companionId: CompanionIdSchema,
  /** What the photo would show (drawn on the placeholder card). */
  description: z.string(),
  caption: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});

/** `GET /gallery`: newest first, every companion. */
export const GalleryResponseSchema = z.object({ photos: z.array(GalleryPhotoSchema) });

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type CreditPackId = z.infer<typeof CreditPackIdSchema>;
export type PlusPlan = z.infer<typeof PlusPlanSchema>;
export type CreditsResponse = z.infer<typeof CreditsResponseSchema>;
export type PurchaseCreditsRequest = z.infer<typeof PurchaseCreditsRequestSchema>;
export type StartPlusRequest = z.infer<typeof StartPlusRequestSchema>;
export type GalleryPhoto = z.infer<typeof GalleryPhotoSchema>;
export type GalleryResponse = z.infer<typeof GalleryResponseSchema>;
