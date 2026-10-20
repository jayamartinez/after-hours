import { and, eq, sql } from 'drizzle-orm';

import { WEB_LOOKUPS_PER_DAY } from '../chat/web-tools';

import type { Db } from './client';
import { utcDay } from './message-allowance';
import { users, webUsage } from './schema';

/**
 * Daily web lookup budget (D-038): searches, link reads, and shared pictures count alike.
 * Plus gets a bigger budget. A reply may overshoot by its per-reply caps; the next reply
 * then gets no web tools.
 */
export async function remainingWebLookups(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<number> {
  const [user] = await db
    .select({ plusPlan: users.plusPlan })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return 0;
  const [usage] = await db
    .select({ count: webUsage.count })
    .from(webUsage)
    .where(and(eq(webUsage.userId, userId), eq(webUsage.day, utcDay(now))));
  const budget = user.plusPlan ? WEB_LOOKUPS_PER_DAY.plus : WEB_LOOKUPS_PER_DAY.free;
  return Math.max(0, budget - (usage?.count ?? 0));
}

export async function addWebLookups(
  db: Db,
  userId: string,
  count: number,
  now = new Date(),
): Promise<void> {
  if (count <= 0) return;
  await db
    .insert(webUsage)
    .values({ userId, day: utcDay(now), count })
    .onConflictDoUpdate({
      target: [webUsage.userId, webUsage.day],
      set: { count: sql`${webUsage.count} + ${count}` },
    });
}
