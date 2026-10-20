import { eq, lt, sql } from 'drizzle-orm';

import type { Db } from './client';
import { utcDay } from './message-allowance';
import { globalSpend, networkSessions, networkSpend, spendUsage } from './schema';

/**
 * Public demo abuse limits (D-042), on top of the per-user allowance and budget:
 * - a lifetime spend cap per network, which deleting data or new sessions do not reset;
 * - a global spend cap per UTC day, which pauses chat for everyone;
 * - a cap on new anonymous accounts per network per day.
 */

const toMicro = (usd: number) => Math.round(usd * 1_000_000);

export type DemoLimit = 'global' | 'network' | null;

/** Which limit, if any, blocks a new message from this network right now. */
export async function demoLimitReached(
  db: Db,
  network: string,
  limits: { globalDailyUsd: number; networkLifetimeUsd: number },
  now = new Date(),
): Promise<DemoLimit> {
  const [global] = await db
    .select({ microUsd: globalSpend.microUsd })
    .from(globalSpend)
    .where(eq(globalSpend.day, utcDay(now)));
  if ((global?.microUsd ?? 0) >= toMicro(limits.globalDailyUsd)) return 'global';
  const [mine] = await db
    .select({ microUsd: networkSpend.microUsd })
    .from(networkSpend)
    .where(eq(networkSpend.network, network));
  if ((mine?.microUsd ?? 0) >= toMicro(limits.networkLifetimeUsd)) return 'network';
  return null;
}

/** Records a reply's estimated cost for the user (daily), the network (ever), and everyone. */
export async function recordReplyCost(
  db: Db,
  cost: { userId: string; network: string; microUsd: number },
  now = new Date(),
): Promise<void> {
  const { userId, network, microUsd } = cost;
  if (microUsd <= 0) return;
  const day = utcDay(now);
  await db.transaction(async (tx) => {
    await tx
      .insert(spendUsage)
      .values({ userId, day, microUsd })
      .onConflictDoUpdate({
        target: [spendUsage.userId, spendUsage.day],
        set: { microUsd: sql`${spendUsage.microUsd} + ${microUsd}` },
      });
    await tx
      .insert(networkSpend)
      .values({ network, microUsd })
      .onConflictDoUpdate({
        target: networkSpend.network,
        set: { microUsd: sql`${networkSpend.microUsd} + ${microUsd}`, updatedAt: now },
      });
    await tx
      .insert(globalSpend)
      .values({ day, microUsd })
      .onConflictDoUpdate({
        target: globalSpend.day,
        set: { microUsd: sql`${globalSpend.microUsd} + ${microUsd}` },
      });
  });
}

/** Counts a new anonymous account for the network; false once today's are used up. */
export async function takeNetworkSession(
  db: Db,
  network: string,
  perDay: number,
  now = new Date(),
): Promise<boolean> {
  const [row] = await db
    .insert(networkSessions)
    .values({ network, day: utcDay(now), count: 1 })
    .onConflictDoUpdate({
      target: [networkSessions.network, networkSessions.day],
      set: { count: sql`${networkSessions.count} + 1` },
      setWhere: lt(networkSessions.count, perDay),
    })
    .returning({ count: networkSessions.count });
  return !!row;
}

/** Test helper and admin view: the network's lifetime spend. */
export async function networkSpent(db: Db, network: string): Promise<number> {
  const [row] = await db
    .select({ microUsd: networkSpend.microUsd })
    .from(networkSpend)
    .where(eq(networkSpend.network, network));
  return row?.microUsd ?? 0;
}
