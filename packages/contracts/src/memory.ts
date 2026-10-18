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

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;
export type Memory = z.infer<typeof MemorySchema>;
