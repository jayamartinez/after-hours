import {
  CREDIT_PACKS,
  MAX_CREDIT_BALANCE,
  PLUS_MONTHLY_CREDITS,
  PLUS_PERIOD_DAYS,
  type CreditPackId,
  type CreditsResponse,
  type PlusPlan,
} from '@after-hours/contracts';
import { and, eq, gt, sql } from 'drizzle-orm';

import type { Db } from './client';
import { creditEvents, users, type UserRow } from './schema';

/**
 * Photo credits (D-026). The balance lives on `users.image_credits` so a spend is one
 * atomic conditional update; `credit_events` records every change, and its unique
 * `(user_id, ref)` makes purchases, spends, and Plus grants count once.
 */

const PERIOD_MS = PLUS_PERIOD_DAYS * 86_400_000;

/** Photo credits and Plus state; routes add the message allowance (`withMessages`). */
export type PhotoCredits = Omit<CreditsResponse, 'messages'>;

/** Plus credit period `now` falls in (0 = the first 30 days). */
const plusPeriod = (since: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - since.getTime()) / PERIOD_MS));

function toCredits(user: Pick<UserRow, 'imageCredits' | 'plusPlan' | 'plusSince'>, now: Date) {
  const { plusPlan, plusSince } = user;
  const plus =
    plusPlan && plusSince
      ? {
          plan: plusPlan,
          nextCreditsAt: new Date(
            plusSince.getTime() + (plusPeriod(plusSince, now) + 1) * PERIOD_MS,
          ).toISOString(),
        }
      : null;
  return { balance: user.imageCredits, plus } satisfies PhotoCredits;
}

/**
 * Inserts a ledger row and applies its amount, once per `ref`. Returns false when the ref
 * was already recorded (a retry). Runs inside the caller's transaction.
 */
async function applyOnce(
  tx: Db,
  userId: string,
  event: { kind: 'purchase' | 'plus_grant'; amount: number; ref: string },
): Promise<boolean> {
  const inserted = await tx
    .insert(creditEvents)
    .values({ userId, ...event })
    .onConflictDoNothing()
    .returning({ id: creditEvents.id });
  if (inserted.length === 0) return false;
  await tx
    .update(users)
    .set({
      imageCredits: sql`least(${users.imageCredits} + ${event.amount}, ${MAX_CREDIT_BALANCE})`,
    })
    .where(eq(users.id, userId));
  return true;
}

/**
 * The user's balance and Plus state. An active Plus subscription receives its credits for
 * the current period here, at most once per period (missed periods are not back-paid).
 */
export async function getCredits(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<PhotoCredits | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) return null;
    if (!user.plusPlan || !user.plusSince) return toCredits(user, now);

    const period = plusPeriod(user.plusSince, now);
    const granted = await applyOnce(tx, userId, {
      kind: 'plus_grant',
      amount: PLUS_MONTHLY_CREDITS,
      ref: `plus:${user.plusSince.getTime()}:${period}`,
    });
    if (!granted) return toCredits(user, now);
    const [updated] = await tx.select().from(users).where(eq(users.id, userId));
    return updated ? toCredits(updated, now) : null;
  });
}

/**
 * Spends one credit for a photo. Null when the balance is zero; otherwise the new
 * balance. `ref` (e.g. the photo's tool call) keeps a retried spend from charging twice.
 */
export async function spendCredit(db: Db, userId: string, ref: string): Promise<number | null> {
  await getCredits(db, userId); // Apply any Plus credits that are due first.
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(creditEvents)
      .values({ userId, kind: 'spend', amount: -1, ref: `spend:${ref}` })
      .onConflictDoNothing()
      .returning({ id: creditEvents.id });
    if (!event) {
      // Already spent for this ref.
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      return user?.imageCredits ?? null;
    }
    const [row] = await tx
      .update(users)
      .set({ imageCredits: sql`${users.imageCredits} - 1` })
      .where(and(eq(users.id, userId), gt(users.imageCredits, 0)))
      .returning({ balance: users.imageCredits });
    if (row) return row.balance;
    // No credits: drop the ledger row so a later attempt with credits can spend.
    await tx.delete(creditEvents).where(eq(creditEvents.id, event.id));
    return null;
  });
}

/** Demo purchase of a credit pack. Idempotent on `purchaseId`. */
export async function purchaseCredits(
  db: Db,
  userId: string,
  packId: CreditPackId,
  purchaseId: string,
): Promise<PhotoCredits | null> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  await db.transaction((tx) =>
    applyOnce(tx, userId, {
      kind: 'purchase',
      amount: pack.credits,
      ref: `purchase:${purchaseId}`,
    }),
  );
  return getCredits(db, userId);
}

/** Starts demo Plus (or switches plan); the first period's credits arrive at once. */
export async function startPlus(
  db: Db,
  userId: string,
  plan: PlusPlan,
  now = new Date(),
): Promise<PhotoCredits | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  await db
    .update(users)
    .set({ plusPlan: plan, plusSince: user.plusPlan ? user.plusSince : now })
    .where(eq(users.id, userId));
  return getCredits(db, userId, now);
}

/** Ends demo Plus. Credits already granted stay. */
export async function endPlus(db: Db, userId: string): Promise<PhotoCredits | null> {
  await db.update(users).set({ plusPlan: null, plusSince: null }).where(eq(users.id, userId));
  return getCredits(db, userId);
}
