import type { Memory, MemoryCategory } from '@after-hours/contracts';
import { and, desc, eq } from 'drizzle-orm';

import type { Db } from './client';
import { isUuid } from './ids';
import { memories, type MemoryRow } from './schema';

/**
 * Memory CRUD, always scoped to one user and one companion: every query filters on both,
 * so a memory id from another user (or the other companion) matches nothing.
 */

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    companionId: row.companionId,
    content: row.content,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    pinned: row.pinned,
  };
}

const owned = (userId: string, companionId: string) =>
  and(eq(memories.userId, userId), eq(memories.companionId, companionId));

/** Lowercased, punctuation-free text used to spot duplicates. */
export function normalizeMemory(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** This user's memories for one companion, pinned first, then newest. */
export async function listMemories(db: Db, userId: string, companionId: string): Promise<Memory[]> {
  const rows = await db
    .select()
    .from(memories)
    .where(owned(userId, companionId))
    .orderBy(desc(memories.pinned), desc(memories.createdAt));
  return rows.map(toMemory);
}

export interface NewMemory {
  content: string;
  category: MemoryCategory;
  pinned?: boolean;
  sourceMessageId?: string;
}

/**
 * Saves a memory unless the companion already remembers the same text (after
 * normalization). Returns the existing memory in that case, with `created: false`.
 */
export async function addMemory(
  db: Db,
  userId: string,
  companionId: string,
  input: NewMemory,
): Promise<{ memory: Memory; created: boolean }> {
  const key = normalizeMemory(input.content);
  const existing = await listMemories(db, userId, companionId);
  const duplicate = existing.find((memory) => normalizeMemory(memory.content) === key);
  if (duplicate) return { memory: duplicate, created: false };

  const [row] = await db
    .insert(memories)
    .values({ userId, companionId, ...input })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return { memory: toMemory(row), created: true };
}

/** Edits text or pin state. Null when the memory is not this user's for this companion. */
export async function updateMemory(
  db: Db,
  userId: string,
  companionId: string,
  memoryId: string,
  patch: { content?: string; pinned?: boolean },
): Promise<Memory | null> {
  if (!isUuid(memoryId)) return null;
  const [row] = await db
    .update(memories)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(memories.id, memoryId), owned(userId, companionId)))
    .returning();
  return row ? toMemory(row) : null;
}

/** Deletes one memory. False when it is not this user's for this companion. */
export async function deleteMemory(
  db: Db,
  userId: string,
  companionId: string,
  memoryId: string,
): Promise<boolean> {
  if (!isUuid(memoryId)) return false;
  const rows = await db
    .delete(memories)
    .where(and(eq(memories.id, memoryId), owned(userId, companionId)))
    .returning({ id: memories.id });
  return rows.length > 0;
}

/** Forgets everything this companion remembers about the user. Returns the count. */
export async function deleteAllMemories(
  db: Db,
  userId: string,
  companionId: string,
): Promise<number> {
  const rows = await db
    .delete(memories)
    .where(owned(userId, companionId))
    .returning({ id: memories.id });
  return rows.length;
}
