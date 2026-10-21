import {
  AD_REWARD_MESSAGES,
  FREE_DAILY_MESSAGES,
  MAX_ADS_PER_DAY,
  MAX_BONUS_MESSAGES,
  MESSAGE_PACKS,
  PLUS_DAILY_MESSAGES,
  type MessageAllowance,
  type MessagePackId,
  type Plan,
} from '@after-hours/contracts';
import { and, count, eq, gt, gte, lt, sql } from 'drizzle-orm';

import { DAILY_COST_BUDGET_USD } from '../chat/costs';

import type { Db } from './client';
import { localDay, localDayStart, nextLocalMidnight } from './local-day';
import { messageGrants, messageUsage, spendUsage, users } from './schema';

/**
 * Message allowance (D-036, D-041): each plan includes messages per day (free 10, Plus 300),
 * then bonus messages from demo packs and ads are spent. The day is the user's own (their
 * stored time zone, D-045), so it resets at their midnight. A hidden daily cost budget
 * (`DAILY_COST_BUDGET_USD`, from real token usage, counted per UTC day) backs this up: once
 * a user's estimated spend for the day reaches it, only bonus messages go through.
 */

/** The UTC day `now` falls in, as stored in the spend and lookup tables. */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** The user's zone, or UTC when the app has not reported one. */
const zoneOf = (timeZone: string | null) => timeZone ?? 'UTC';

export type MessageSpend = 'included' | 'bonus';

const planOf = (plusPlan: string | null): Plan => (plusPlan ? 'plus' : 'free');
const dailyIncluded = (plan: Plan) => (plan === 'plus' ? PLUS_DAILY_MESSAGES : FREE_DAILY_MESSAGES);
const budgetMicroUsd = (plan: Plan) => Math.round(DAILY_COST_BUDGET_USD[plan] * 1_000_000);

/** Estimated spend so far today, in micro-dollars. */
async function spentToday(db: Db, userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ microUsd: spendUsage.microUsd })
    .from(spendUsage)
    .where(and(eq(spendUsage.userId, userId), eq(spendUsage.day, utcDay(now))));
  return row?.microUsd ?? 0;
}

/** Records the estimated cost of a reply against today's budget. */
export async function addSpend(
  db: Db,
  userId: string,
  microUsd: number,
  now = new Date(),
): Promise<void> {
  if (microUsd <= 0) return;
  await db
    .insert(spendUsage)
    .values({ userId, day: utcDay(now), microUsd })
    .onConflictDoUpdate({
      target: [spendUsage.userId, spendUsage.day],
      set: { microUsd: sql`${spendUsage.microUsd} + ${microUsd}` },
    });
}

export async function getAllowance(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<MessageAllowance | null> {
  const [user] = await db
    .select({ plusPlan: users.plusPlan, bonus: users.bonusMessages, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;
  const plan = planOf(user.plusPlan);
  const zone = zoneOf(user.timeZone);
  const [usage] = await db
    .select({ count: messageUsage.count })
    .from(messageUsage)
    .where(and(eq(messageUsage.userId, userId), eq(messageUsage.day, localDay(now, zone))));
  const [ads] = await db
    .select({ n: count() })
    .from(messageGrants)
    .where(
      and(
        eq(messageGrants.userId, userId),
        eq(messageGrants.kind, 'ad'),
        gte(messageGrants.createdAt, localDayStart(now, zone)),
        lt(messageGrants.createdAt, nextLocalMidnight(now, zone)),
      ),
    );
  const overBudget = (await spentToday(db, userId, now)) >= budgetMicroUsd(plan);
  return {
    plan,
    dailyIncluded: dailyIncluded(plan),
    // Past the hidden budget the plan's messages read as used up (the budget itself is
    // never shown).
    includedLeftToday: overBudget ? 0 : Math.max(0, dailyIncluded(plan) - (usage?.count ?? 0)),
    bonus: user.bonus,
    adsLeftToday: Math.max(0, MAX_ADS_PER_DAY - (ads?.n ?? 0)),
    resetsAt: nextLocalMidnight(now, zone).toISOString(),
  };
}

/**
 * Takes one message from the allowance: the plan's daily messages first (unless today's
 * cost budget is used up), then bonus messages. Null when nothing is left (the send is
 * refused).
 */
export async function spendMessage(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<MessageSpend | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ plusPlan: users.plusPlan, timeZone: users.timeZone })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return null;
    const plan = planOf(user.plusPlan);

    if ((await spentToday(tx, userId, now)) < budgetMicroUsd(plan)) {
      // Counts one included message unless today's are used up (atomic under concurrent sends).
      const [included] = await tx
        .insert(messageUsage)
        .values({ userId, day: localDay(now, zoneOf(user.timeZone)), count: 1 })
        .onConflictDoUpdate({
          target: [messageUsage.userId, messageUsage.day],
          set: { count: sql`${messageUsage.count} + 1` },
          setWhere: lt(messageUsage.count, dailyIncluded(plan)),
        })
        .returning({ count: messageUsage.count });
      if (included) return 'included';
    }

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
 * times per local day (D-045). False when today's ads are used up. Idempotent on `adId`.
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
