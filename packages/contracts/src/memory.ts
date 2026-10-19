import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * One remembered fact about the user, owned by exactly one companion (docs/architecture.md,
 * "Memory"). Roy's and Roya's memories never mix: prompt assembly drops any memory whose
 * `companionId` differs from the companion being prompted. Users can list, edit, and delete
 * these individually, so `content` is plain, user-readable text.
 */
export const MemoryCategorySchema = z.enum([
  'fact',
  'preference',
  'event',
  'relationship',
  'boundary',
]);

export const MemorySchema = z.object({
  id: z.string().min(1),
  companionId: CompanionIdSchema,
  content: z
    .string()
    .trim()
    .min(1)
    .describe('Plain fact in the third person, e.g. "Has a dog named Pixel"'),
  category: MemoryCategorySchema,
  /** When the user said it (ISO 8601). Rendered as rough recency in the prompt. */
  createdAt: z.iso.datetime(),
  pinned: z.boolean().default(false),
});

/** Longest memory text a user may save or edit, in characters. */
export const MAX_MEMORY_CHARS = 280;

const memoryText = z.string().trim().min(1).max(MAX_MEMORY_CHARS);

/** `GET /memories/:companionId`: pinned first, then newest. */
export const MemoriesResponseSchema = z.object({
  companionId: CompanionIdSchema,
  memories: z.array(MemorySchema),
});

/**
 * `POST /memories/:companionId`. Either a memory written by the user (saved as given), or
 * "Remember this" on one of their chat messages: the server phrases it as a short fact and
 * returns an existing memory instead when the companion already knows it.
 */
export const CreateMemoryRequestSchema = z.union([
  z.object({ content: memoryText, category: MemoryCategorySchema.default('fact') }),
  z.object({
    messageId: z.string().min(1).max(64),
    /** IANA time zone of the device, to resolve relative dates in the message. */
    timeZone: z.string().max(64).optional(),
  }),
]);

/** `PATCH /memories/:companionId/:memoryId`: edit the text, pin, or unpin. */
export const UpdateMemoryRequestSchema = z
  .object({ content: memoryText.optional(), pinned: z.boolean().optional() })
  .refine((body) => body.content !== undefined || body.pinned !== undefined, {
    message: 'nothing to update',
  });

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type MemoriesResponse = z.infer<typeof MemoriesResponseSchema>;
export type CreateMemoryRequest = z.input<typeof CreateMemoryRequestSchema>;
export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequestSchema>;
