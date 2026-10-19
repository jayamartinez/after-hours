import type { Memory, MemoryCategory } from '@after-hours/contracts';
import { and, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './client';
import { memories, type MemoryRow } from './schema';

/**
 * Memory CRUD, always scoped to one user (and, for reads, one companion). The extraction
 * pipeline that writes memories is Milestone 4; chat already retrieves them.
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

/** This user's live memories for one companion, newest first. */
export async function listMemories(db: Db, userId: string, companionId: string): Promise<Memory[]> {
  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        eq(memories.companionId, companionId),
        isNull(memories.deletedAt),
      ),
    )
    .orderBy(desc(memories.createdAt));
  return rows.map(toMemory);
}

export async function addMemory(
  db: Db,
  userId: string,
  input: { companionId: string; content: string; category: MemoryCategory; pinned?: boolean },
): Promise<Memory> {
  const [row] = await db
    .insert(memories)
    .values({ userId, ...input })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return toMemory(row);
}

/** Soft-deletes one of this user's memories. False when it is not theirs or not found. */
export async function deleteMemory(db: Db, userId: string, memoryId: string): Promise<boolean> {
  const rows = await db
    .update(memories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId), isNull(memories.deletedAt)))
    .returning({ id: memories.id });
  return rows.length > 0;
}
