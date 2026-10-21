import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * Photo credits (D-026) and messages (D-036). A companion's photo costs one credit; free
 * users get none. Messages: a daily free allowance, then bonus messages from demo packs or
 * demo ads; Plus is unlimited. Purchases and ads are a demo: no payment is taken, no ad is
 * shown, and the UI labels them as such (D-008).
 */

/** Photo credits every new user starts with: photos need a pack or Plus (D-036). */
export const FREE_STARTING_CREDITS = 0;

/** Messages a free user can send per UTC day, across companions. */
export const FREE_DAILY_MESSAGES = 10;
/** Bonus messages one (demo) ad grants. */
export const AD_REWARD_MESSAGES = 5;
/** Ads a user can watch per UTC day. */
export const MAX_ADS_PER_DAY = 3;
/** Highest bonus message balance reachable through demo purchases and ads. */
export const MAX_BONUS_MESSAGES = 9_999;

export const MESSAGE_PACKS = [
  { id: 'messages-50', messages: 50, demoPrice: '$1.99' },
  { id: 'messages-200', messages: 200, demoPrice: '$4.99' },
] as const;

export const MessagePackIdSchema = z.enum(['messages-50', 'messages-200']);
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

/** What the user can still send. */
export const MessageAllowanceSchema = z.object({
  /** Plus: no limit. The counts below still report usage. */
  unlimited: z.boolean(),
  freeLeftToday: z.number().int().min(0),
  /** Bought or earned messages, spent after the free ones. */
  bonus: z.number().int().min(0),
  adsLeftToday: z.number().int().min(0),
  /** Next UTC midnight, when the free allowance and ads reset (ISO 8601). */
  resetsAt: z.iso.datetime({ offset: true }),
});

/** `GET /credits`, and the body of every credits mutation. */
export const CreditsResponseSchema = z.object({
  balance: z.number().int().min(0),
  messages: MessageAllowanceSchema,
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

const RefSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** `POST /messages/purchase` (demo). `purchaseId` makes a retried tap count once. */
export const PurchaseMessagesRequestSchema = z.object({
  packId: MessagePackIdSchema,
  purchaseId: RefSchema,
});

/** `POST /messages/ad` (demo: no ad is shown). `adId` makes a retried claim count once. */
export const ClaimAdRequestSchema = z.object({ adId: RefSchema });

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
export type MessageAllowance = z.infer<typeof MessageAllowanceSchema>;
export type MessagePack = (typeof MESSAGE_PACKS)[number];
export type MessagePackId = z.infer<typeof MessagePackIdSchema>;
export type PurchaseMessagesRequest = z.infer<typeof PurchaseMessagesRequestSchema>;
export type ClaimAdRequest = z.infer<typeof ClaimAdRequestSchema>;
export type PurchaseCreditsRequest = z.infer<typeof PurchaseCreditsRequestSchema>;
export type StartPlusRequest = z.infer<typeof StartPlusRequestSchema>;
export type GalleryPhoto = z.infer<typeof GalleryPhotoSchema>;
export type GalleryResponse = z.infer<typeof GalleryResponseSchema>;
