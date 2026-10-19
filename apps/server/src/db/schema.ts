import { FREE_STARTING_CREDITS, type MessageImage } from '@after-hours/contracts';
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Database schema (docs/architecture.md, "Persistence"). Every table has RLS enabled with
 * no policies: the server connects as the table owner and filters by `user_id` itself,
 * while Supabase's public PostgREST API (anon/authenticated roles) sees nothing.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Anonymous device users (D-023), with their photo credits and demo Plus state (D-026). */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    imageCredits: integer('image_credits').notNull().default(FREE_STARTING_CREDITS),
    /** Demo Plus plan; null when not subscribed. */
    plusPlan: text('plus_plan', { enum: ['annual', 'monthly'] }),
    /** Start of the current demo Plus subscription; credit periods count from here. */
    plusSince: timestamp('plus_since', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check('users_image_credits_check', sql`${t.imageCredits} >= 0`)],
).enableRLS();

/**
 * Every change to a user's credits. `ref` is unique per user, which makes purchases,
 * spends, and Plus grants idempotent (a retried request finds its own row).
 */
export const creditEvents = pgTable(
  'credit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['purchase', 'spend', 'plus_grant'] }).notNull(),
    /** Signed change: positive for purchases and grants, -1 for a spend. */
    amount: integer('amount').notNull(),
    ref: text('ref').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('credit_events_user_ref_key').on(t.userId, t.ref)],
).enableRLS();

/** One thread per user × companion. */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companionId: text('companion_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('conversations_user_companion_key').on(t.userId, t.companionId)],
).enableRLS();

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Insertion order; bubbles of one reply share a timestamp closely. */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    kind: text('kind', { enum: ['text', 'image', 'voice'] })
      .notNull()
      .default('text'),
    content: text('content').notNull(),
    status: text('status', { enum: ['sent', 'read', 'failed'] })
      .notNull()
      .default('sent'),
    /** Idempotency key of a user message (unique per conversation). */
    clientId: text('client_id'),
    /** The user message an assistant bubble answers. */
    replyTo: uuid('reply_to'),
    reactions: jsonb('reactions').$type<string[]>().notNull().default([]),
    /** Picture of an image message (a described placeholder for now). */
    media: jsonb('media').$type<MessageImage>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('messages_conversation_client_key').on(t.conversationId, t.clientId),
    index('messages_conversation_seq_idx').on(t.conversationId, t.seq),
    index('messages_reply_to_idx').on(t.replyTo),
    check('messages_role_check', sql`${t.role} in ('user', 'assistant')`),
    check('messages_status_check', sql`${t.status} in ('sent', 'read', 'failed')`),
  ],
).enableRLS();

/**
 * Remembered facts, owned by one user and one companion. Written by extraction after each
 * reply and by "Remember this"; deletes are hard deletes so forgotten text is really gone.
 */
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companionId: text('companion_id').notNull(),
    content: text('content').notNull(),
    category: text('category', {
      enum: ['fact', 'preference', 'event', 'relationship', 'boundary'],
    }).notNull(),
    pinned: boolean('pinned').notNull().default(false),
    sourceMessageId: uuid('source_message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('memories_user_companion_idx').on(t.userId, t.companionId)],
).enableRLS();

export type UserRow = typeof users.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
