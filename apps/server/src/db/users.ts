import { eq } from 'drizzle-orm';

import type { Db } from './client';
import { users } from './schema';

export async function createUser(db: Db): Promise<string> {
  const [row] = await db.insert(users).values({}).returning({ id: users.id });
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

export async function userExists(db: Db, userId: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return rows.length > 0;
}

/** Deletes the user and, by cascade, every conversation, message, and memory they own. */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
