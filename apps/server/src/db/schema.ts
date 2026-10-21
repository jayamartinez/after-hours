import { FREE_STARTING_CREDITS, type MessageImage, type UserProfile } from '@after-hours/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

/**
 * Anonymous device users (D-023), with their photo credits and demo Plus state (D-026) and
 * onboarding profile (D-032).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    imageCredits: integer('image_credits').notNull().default(FREE_STARTING_CREDITS),
    /** Demo Plus plan; null when not subscribed. */
    plusPlan: text('plus_plan', { enum: ['annual', 'monthly'] }),
    /** Start of the current demo Plus subscription; credit periods count from here. */
    plusSince: timestamp('plus_since', { withTimezone: true }),
    /** Messages bought or earned from ads, spent after the daily free ones (D-036). */
    bonusMessages: integer('bonus_messages').notNull().default(0),
    /** Onboarding answers (`PUT /profile`); null until the app sends them. */
    profile: jsonb('profile').$type<UserProfile>(),
    /**
     * IANA zone from the app, set once (D-045): the daily message allowance resets at this
     * zone's midnight. Null until the app reports one (UTC until then).
     */
    timeZone: text('time_zone'),
    createdAt: createdAt(),
  },
  (t) => [
    check('users_image_credits_check', sql`${t.imageCredits} >= 0`),
    check('users_bonus_messages_check', sql`${t.bonusMessages} >= 0`),
  ],
).enableRLS();

/**
 * Free messages sent per user per day, in the user's time zone (D-036, D-045). Its own table so clearing a
 * conversation (which deletes messages) never gives the allowance back.
 */
export const messageUsage = pgTable(
  'message_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
).enableRLS();

/**
 * Estimated provider spend per user per UTC day, in micro-dollars (D-041), from the token
 * usage of every chat reply and its web lookups. Drives the hidden daily cost budget.
 */
export const spendUsage = pgTable(
  'spend_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    microUsd: bigint('micro_usd', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
).enableRLS();

/**
 * Estimated spend per network (a keyed hash of the client's IP or IPv6 /64), ever (D-042).
 * Not linked to users, so deleting an account or starting a new session does not reset it.
 */
export const networkSpend = pgTable('network_spend', {
  network: text('network').primaryKey(),
  microUsd: bigint('micro_usd', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Estimated spend across everyone per UTC day (D-042): the global daily cap. */
export const globalSpend = pgTable('global_spend', {
  day: date('day', { mode: 'string' }).primaryKey(),
  microUsd: bigint('micro_usd', { mode: 'number' }).notNull().default(0),
}).enableRLS();

/** New anonymous accounts per network per UTC day (D-042). */
export const networkSessions = pgTable(
  'network_sessions',
  {
    network: text('network').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.network, t.day] })],
).enableRLS();

/** Web lookups (searches, link reads, shared pictures) per user per UTC day (D-038). */
export const webUsage = pgTable(
  'web_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
).enableRLS();

/**
 * Bonus messages granted by a demo pack or a demo ad. `ref` is unique per user, so a
 * retried purchase or ad claim counts once; ads per day are counted from here.
 */
export const messageGrants = pgTable(
  'message_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['purchase', 'ad'] }).notNull(),
    amount: integer('amount').notNull(),
    ref: text('ref').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('message_grants_user_ref_key').on(t.userId, t.ref)],
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
