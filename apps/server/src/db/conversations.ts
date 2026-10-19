import type { ChatMessageDto, ConversationSummary, ReactionId } from '@after-hours/contracts';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';

import type { Db } from './client';
import { conversations, messages, type MessageRow } from './schema';

/**
 * Conversation and message queries. Every entry point takes the owning `userId` or a
 * conversation id obtained through it (`getOrCreateConversation`), so a user can only
 * ever reach their own rows.
 */

export function toMessageDto(row: MessageRow): ChatMessageDto {
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reactions: row.reactions as ReactionId[],
    clientId: row.clientId,
  };
}

/**
 * The user's thread with a companion, created on first access. A new thread starts with
 * the companion's opener (`publicProfile.copy.firstMessage`), like the onboarding preview.
 */
export async function getOrCreateConversation(
  db: Db,
  userId: string,
  companionId: string,
  opener: readonly string[],
): Promise<string> {
  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.companionId, companionId)));
  if (existing[0]) return existing[0].id;

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(conversations)
      .values({ userId, companionId })
      .onConflictDoNothing()
      .returning({ id: conversations.id });
    const created = inserted[0];
    if (!created) {
      // A concurrent request created it first.
      const [row] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.userId, userId), eq(conversations.companionId, companionId)));
      if (!row) throw new Error('conversation vanished after conflict');
      return row.id;
    }
    const lines = opener.map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0) {
      await tx.insert(messages).values(
        lines.map((content) => ({
          conversationId: created.id,
          role: 'assistant' as const,
          content,
        })),
      );
    }
    return created.id;
  });
}

/** Messages oldest first; with `limit`, only the most recent ones. */
export async function listMessages(
  db: Db,
  conversationId: string,
  options: { limit?: number; uptoSeq?: number } = {},
): Promise<MessageRow[]> {
  const where = options.uptoSeq
    ? and(eq(messages.conversationId, conversationId), lte(messages.seq, options.uptoSeq))
    : eq(messages.conversationId, conversationId);
  if (!options.limit) {
    return db.select().from(messages).where(where).orderBy(asc(messages.seq));
  }
  const newest = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(desc(messages.seq))
    .limit(options.limit);
  return newest.reverse();
}

/** Last message per existing conversation of this user. */
export async function listConversationSummaries(
  db: Db,
  userId: string,
): Promise<ConversationSummary[]> {
  const threads = await db
    .select({ id: conversations.id, companionId: conversations.companionId })
    .from(conversations)
    .where(eq(conversations.userId, userId));
  return Promise.all(
    threads.map(async (thread) => {
      const [last] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, thread.id))
        .orderBy(desc(messages.seq))
        .limit(1);
      return { companionId: thread.companionId, lastMessage: last ? toMessageDto(last) : null };
    }),
  );
}

/**
 * Persists a user message, idempotent on `clientId`: a resend returns the stored row
 * (`created: false`) instead of inserting a duplicate.
 */
export async function insertUserMessage(
  db: Db,
  conversationId: string,
  content: string,
  clientId: string,
): Promise<{ row: MessageRow; created: boolean }> {
  const [inserted] = await db
    .insert(messages)
    .values({ conversationId, role: 'user', content, clientId, status: 'sent' })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { row: inserted, created: true };
  const [existing] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.clientId, clientId)));
  if (!existing) throw new Error('message vanished after conflict');
  return { row: existing, created: false };
}

/** Assistant bubbles already stored for a user message (an idempotent replay). */
export function listReplies(db: Db, userMessageId: string): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.replyTo, userMessageId), eq(messages.role, 'assistant')))
    .orderBy(asc(messages.seq));
}

export async function insertAssistantBubble(
  db: Db,
  conversationId: string,
  replyTo: string,
  content: string,
): Promise<MessageRow> {
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role: 'assistant', content, replyTo })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

export async function setMessageStatus(
  db: Db,
  conversationId: string,
  ids: string[],
  status: MessageRow['status'],
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(messages)
    .set({ status })
    .where(and(eq(messages.conversationId, conversationId), inArray(messages.id, ids)));
}
