import {
  CreateMemoryRequestSchema,
  MAX_MEMORY_CHARS,
  UpdateMemoryRequestSchema,
  type ApiError,
  type MemoriesResponse,
} from '@after-hours/contracts';
import { Hono } from 'hono';

import { requireUser, type AuthEnv } from '../auth/session';
import type { CharacterStore } from '../characters/store';
import { phraseMemory } from '../chat/memory-extract';
import { validTimeZone } from '../chat/time-zone';
import type { Db } from '../db/client';
import { getUserMessage } from '../db/conversations';
import {
  addMemory,
  deleteAllMemories,
  deleteMemory,
  listMemories,
  updateMemory,
  type NewMemory,
} from '../db/memories';
import { createRateLimiter } from '../limits/rate-limit';
import type { StructuredModel } from '../providers/types';

const NOT_FOUND: ApiError = { code: 'not_found', message: 'No such companion.', retryable: false };
const MEMORY_NOT_FOUND: ApiError = {
  code: 'not_found',
  message: 'That memory is already gone.',
  retryable: false,
};
const MESSAGE_NOT_FOUND: ApiError = {
  code: 'not_found',
  message: 'That message isn’t saved yet. Try again in a moment.',
  retryable: true,
};
const BAD_REQUEST: ApiError = {
  code: 'bad_request',
  message: 'That memory could not be saved.',
  retryable: false,
};

export interface MemoryRoutesOptions {
  db: Db;
  store: CharacterStore;
  sessionSecret: string;
  /** Phrases "Remember this" messages; unset saves the message text as is. */
  memoryModel?: StructuredModel;
  /** `KILL_SWITCH`: no model calls; "Remember this" saves the message text as is. */
  killSwitch: boolean;
  /** New memories per user per minute ("Remember this" may call the memory model). */
  rateLimitPerMin: number;
  log?: (message: string) => void;
}

const RATE_LIMITED: ApiError = {
  code: 'rate_limited',
  message: 'Slow down a little. Try again in a minute.',
  retryable: true,
};

/**
 * Memory controls (PRD "Memory controls"): list, "Remember this", edit or pin, delete one,
 * and forget everything for a companion. Every query is scoped to the authenticated user
 * and the companion in the path.
 */
export function memoryRoutes(options: MemoryRoutesOptions) {
  const { db, store, sessionSecret } = options;
  const log = options.log ?? ((message: string) => console.warn(message));
  const limiter = createRateLimiter(options.rateLimitPerMin);
  const phrasingModel = options.killSwitch ? undefined : options.memoryModel;
  return new Hono<AuthEnv>()
    .use('/memories/*', requireUser(db, sessionSecret))

    .get('/memories/:companionId', async (c) => {
      const character = store.get(c.req.param('companionId'));
      if (!character) return c.json(NOT_FOUND, 404);
      const body: MemoriesResponse = {
        companionId: character.id,
        memories: await listMemories(db, c.var.userId, character.id),
      };
      return c.json(body);
    })

    .post('/memories/:companionId', async (c) => {
      const character = store.get(c.req.param('companionId'));
      if (!character) return c.json(NOT_FOUND, 404);
      const parsed = CreateMemoryRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      const userId = c.var.userId;
      if (!limiter.take(userId)) return c.json(RATE_LIMITED, 429);

      if ('content' in parsed.data) {
        const { memory, created } = await addMemory(db, userId, character.id, parsed.data);
        return c.json(memory, created ? 201 : 200);
      }

      // "Remember this" on one of the user's own messages.
      const message = await getUserMessage(db, userId, character.id, parsed.data.messageId);
      if (!message) return c.json(MESSAGE_NOT_FOUND, 404);
      let input: NewMemory = {
        content: message.content.trim().slice(0, MAX_MEMORY_CHARS),
        category: 'fact',
        sourceMessageId: message.id,
      };
      if (phrasingModel) {
        const existing = await listMemories(db, userId, character.id);
        try {
          const phrased = await phraseMemory(phrasingModel, character, {
            message: message.content,
            existing,
            timeZone: validTimeZone(parsed.data.timeZone),
          });
          if (phrased.duplicate) return c.json(phrased.duplicate, 200);
          input = { ...input, content: phrased.content, category: phrased.category };
        } catch (error) {
          // Keep the user's own words rather than failing the tap.
          log(
            `[memory] phrasing failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      const { memory, created } = await addMemory(db, userId, character.id, input);
      return c.json(memory, created ? 201 : 200);
    })

    .patch('/memories/:companionId/:memoryId', async (c) => {
      const character = store.get(c.req.param('companionId'));
      if (!character) return c.json(NOT_FOUND, 404);
      const parsed = UpdateMemoryRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json(BAD_REQUEST, 400);
      const memory = await updateMemory(
        db,
        c.var.userId,
        character.id,
        c.req.param('memoryId'),
        parsed.data,
      );
      return memory ? c.json(memory) : c.json(MEMORY_NOT_FOUND, 404);
    })

    .delete('/memories/:companionId/:memoryId', async (c) => {
      const character = store.get(c.req.param('companionId'));
      if (!character) return c.json(NOT_FOUND, 404);
      const deleted = await deleteMemory(db, c.var.userId, character.id, c.req.param('memoryId'));
      return deleted ? c.body(null, 204) : c.json(MEMORY_NOT_FOUND, 404);
    })

    .delete('/memories/:companionId', async (c) => {
      const character = store.get(c.req.param('companionId'));
      if (!character) return c.json(NOT_FOUND, 404);
      await deleteAllMemories(db, c.var.userId, character.id);
      return c.body(null, 204);
    });
}
