import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
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

/** Anonymous device users (D-023). */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: createdAt(),
}).enableRLS();

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

/** Remembered facts, owned by one user and one companion. Extraction lands in M4. */
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
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('memories_user_companion_idx').on(t.userId, t.companionId)],
).enableRLS();

export type MessageRow = typeof messages.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
