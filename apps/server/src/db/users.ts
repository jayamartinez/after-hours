import type { UserProfile } from '@after-hours/contracts';
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

/** Whether the user has demo Plus (bigger limits, the Plus chat model). */
export async function isPlus(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ plusPlan: users.plusPlan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.plusPlan;
}

/** The user's onboarding answers, or null when the app has not sent them. */
export async function getProfile(db: Db, userId: string): Promise<UserProfile | null> {
  const [row] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.profile ?? null;
}

/** Replaces the user's onboarding answers (a replayed onboarding sends new ones). */
export async function setProfile(db: Db, userId: string, profile: UserProfile): Promise<void> {
  await db.update(users).set({ profile }).where(eq(users.id, userId));
}

/** Deletes the user and, by cascade, every conversation, message, and memory they own. The profile lives on the user row. */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
