import {
  AD_REWARD_MESSAGES,
  FREE_DAILY_MESSAGES,
  MAX_ADS_PER_DAY,
  MAX_BONUS_MESSAGES,
  MESSAGE_PACKS,
  type MessageAllowance,
  type MessagePackId,
} from '@after-hours/contracts';
import { and, count, eq, gt, gte, lt, sql } from 'drizzle-orm';

import type { Db } from './client';
import { messageGrants, messageUsage, users } from './schema';

/**
 * Message allowance (D-036): Plus is unlimited; everyone else gets `FREE_DAILY_MESSAGES`
 * per UTC day, then spends bonus messages from demo packs and demo ads.
 */

const DAY_MS = 86_400_000;

/** The UTC day `now` falls in, as stored in `message_usage.day`. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);
const dayStart = (now: Date) => new Date(`${utcDay(now)}T00:00:00.000Z`);
const nextReset = (now: Date) => new Date(dayStart(now).getTime() + DAY_MS);

export type MessageSpend = 'unlimited' | 'free' | 'bonus';

export async function getAllowance(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<MessageAllowance | null> {
  const [user] = await db
    .select({ plusPlan: users.plusPlan, bonus: users.bonusMessages })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;
  const [usage] = await db
    .select({ count: messageUsage.count })
    .from(messageUsage)
    .where(and(eq(messageUsage.userId, userId), eq(messageUsage.day, utcDay(now))));
  const [ads] = await db
    .select({ n: count() })
    .from(messageGrants)
    .where(
      and(
        eq(messageGrants.userId, userId),
        eq(messageGrants.kind, 'ad'),
        gte(messageGrants.createdAt, dayStart(now)),
        lt(messageGrants.createdAt, nextReset(now)),
      ),
    );
  return {
    unlimited: user.plusPlan !== null,
    freeLeftToday: Math.max(0, FREE_DAILY_MESSAGES - (usage?.count ?? 0)),
    bonus: user.bonus,
    adsLeftToday: Math.max(0, MAX_ADS_PER_DAY - (ads?.n ?? 0)),
    resetsAt: nextReset(now).toISOString(),
  };
}

/**
 * Takes one message from the allowance: free first, then bonus. Null when nothing is left
 * (the send is refused). Plus users are never charged, and their free count is untouched.
 */
export async function spendMessage(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<MessageSpend | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ plusPlan: users.plusPlan })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return null;
    if (user.plusPlan !== null) return 'unlimited';

    // Counts one free message unless today's are used up (atomic under concurrent sends).
    const [free] = await tx
      .insert(messageUsage)
      .values({ userId, day: utcDay(now), count: 1 })
      .onConflictDoUpdate({
        target: [messageUsage.userId, messageUsage.day],
        set: { count: sql`${messageUsage.count} + 1` },
        setWhere: lt(messageUsage.count, FREE_DAILY_MESSAGES),
      })
      .returning({ count: messageUsage.count });
    if (free) return 'free';

    const [bonus] = await tx
      .update(users)
      .set({ bonusMessages: sql`${users.bonusMessages} - 1` })
      .where(and(eq(users.id, userId), gt(users.bonusMessages, 0)))
      .returning({ bonus: users.bonusMessages });
    return bonus ? 'bonus' : null;
  });
}

/** Adds bonus messages once per `ref`. False when the ref was already granted (a retry). */
async function grantOnce(
  db: Db,
  userId: string,
  grant: { kind: 'purchase' | 'ad'; amount: number; ref: string; createdAt?: Date },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(messageGrants)
      .values({ userId, ...grant })
      .onConflictDoNothing()
      .returning({ id: messageGrants.id });
    if (inserted.length === 0) return false;
    await tx
      .update(users)
      .set({
        bonusMessages: sql`least(${users.bonusMessages} + ${grant.amount}, ${MAX_BONUS_MESSAGES})`,
      })
      .where(eq(users.id, userId));
    return true;
  });
}

/** Demo purchase of a message pack. Idempotent on `purchaseId`. */
export async function purchaseMessages(
  db: Db,
  userId: string,
  packId: MessagePackId,
  purchaseId: string,
): Promise<void> {
  const pack = MESSAGE_PACKS.find((p) => p.id === packId);
  if (!pack) return;
  await grantOnce(db, userId, {
    kind: 'purchase',
    amount: pack.messages,
    ref: `purchase:${purchaseId}`,
  });
}

/**
 * A watched (demo) ad: `AD_REWARD_MESSAGES` bonus messages, at most `MAX_ADS_PER_DAY`
 * times per UTC day. False when today's ads are used up. Idempotent on `adId`.
 */
export async function claimAd(
  db: Db,
  userId: string,
  adId: string,
  now = new Date(),
): Promise<boolean> {
  const allowance = await getAllowance(db, userId, now);
  if (!allowance) return false;
  const ref = `ad:${adId}`;
  const [already] = await db
    .select({ id: messageGrants.id })
    .from(messageGrants)
    .where(and(eq(messageGrants.userId, userId), eq(messageGrants.ref, ref)));
  if (already) return true;
  if (allowance.adsLeftToday === 0) return false;
  await grantOnce(db, userId, { kind: 'ad', amount: AD_REWARD_MESSAGES, ref, createdAt: now });
  return true;
}
