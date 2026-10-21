import type {
  ChatMessageDto,
  ConversationSummary,
  GalleryPhoto,
  ReactionId,
} from '@after-hours/contracts';
import { and, asc, count, desc, eq, inArray, lte } from 'drizzle-orm';

import type { Db } from './client';
import { isUuid } from './ids';
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
    image: row.media ? { kind: 'placeholder', description: row.media.description ?? '' } : null,
  };
}

/**
 * The user's thread with a companion, created on first access. A new thread starts empty:
 * the user sends the first message.
 */
export async function getOrCreateConversation(
  db: Db,
  userId: string,
  companionId: string,
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

/** User messages in a thread up to and including `uptoSeq` (all when unset). */
export async function countUserMessages(
  db: Db,
  conversationId: string,
  uptoSeq?: number,
): Promise<number> {
  const conditions = [eq(messages.conversationId, conversationId), eq(messages.role, 'user')];
  if (uptoSeq) conditions.push(lte(messages.seq, uptoSeq));
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(...conditions));
  return row?.n ?? 0;
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

/** The stored user message with this idempotency key, if any. */
export async function findUserMessage(
  db: Db,
  conversationId: string,
  clientId: string,
): Promise<MessageRow | undefined> {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.clientId, clientId)));
  return row;
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

/**
 * Stores a photo the companion sent. Until image generation exists there is no image:
 * the app draws a labeled placeholder card with `description` (what it would show).
 */
export async function insertAssistantPhoto(
  db: Db,
  conversationId: string,
  replyTo: string,
  photo: { caption: string; description: string },
): Promise<MessageRow> {
  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      role: 'assistant',
      kind: 'image',
      content: photo.caption,
      replyTo,
      media: { kind: 'placeholder', description: photo.description },
    })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

/** Every photo companions sent this user, newest first (the Gallery tab). */
export async function listPhotos(db: Db, userId: string): Promise<GalleryPhoto[]> {
  const rows = await db
    .select({ message: messages, companionId: conversations.companionId })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.kind, 'image'),
        eq(messages.role, 'assistant'),
      ),
    )
    .orderBy(desc(messages.seq));
  return rows.flatMap(({ message, companionId }) =>
    message.media
      ? [
          {
            messageId: message.id,
            companionId,
            // Rows from before descriptions existed have none.
            description: message.media.description ?? '',
            caption: message.content,
            createdAt: message.createdAt.toISOString(),
          },
        ]
      : [],
  );
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

/**
 * Clears the user's thread with a companion: the conversation row and (by cascade) every
 * message. The next read starts a fresh, empty thread. Memories are kept; they
 * have their own controls. False when there was no thread.
 */
export async function deleteConversation(
  db: Db,
  userId: string,
  companionId: string,
): Promise<boolean> {
  const rows = await db
    .delete(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.companionId, companionId)))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

/** One of the user's own messages in their thread with a companion, or null. */
export async function getUserMessage(
  db: Db,
  userId: string,
  companionId: string,
  messageId: string,
): Promise<MessageRow | null> {
  if (!isUuid(messageId)) return null;
  const [row] = await db
    .select({ message: messages })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.role, 'user'),
        eq(conversations.userId, userId),
        eq(conversations.companionId, companionId),
      ),
    );
  return row?.message ?? null;
}
