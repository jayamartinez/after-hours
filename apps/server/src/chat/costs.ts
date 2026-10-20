import type { ChatUsage } from '../providers/types';

/**
 * Estimated provider cost of a reply (D-041), for the hidden per-user daily budget. Prices
 * are list prices per million tokens; a cache write costs 1.25x input (5-minute TTL). An
 * unknown model is priced as the most expensive one, so the budget errs on the safe side.
 */

interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
}

const PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const FALLBACK_PRICE: ModelPrice = { input: 10, output: 50, cacheRead: 1 };
const CACHE_WRITE_MULTIPLIER = 1.25;
/** Web search is billed per search; link reads only cost their tokens. Counted as searches. */
const WEB_LOOKUP_USD = 0.01;

/** Daily cost budget per plan in US dollars; past it, only paid bonus messages go through. */
export const DAILY_COST_BUDGET_USD = { free: 0.15, plus: 1.5 } as const;

export function priceOf(model: string): ModelPrice {
  return PRICES[model] ?? FALLBACK_PRICE;
}

/** Estimated cost in micro-dollars (whole number, rounded up). */
export function replyCostMicroUsd(model: string, usage: ChatUsage, webLookups = 0): number {
  const price = priceOf(model);
  const usd =
    (usage.inputTokens * price.input +
      usage.cacheCreationInputTokens * price.input * CACHE_WRITE_MULTIPLIER +
      usage.cacheReadInputTokens * price.cacheRead +
      usage.outputTokens * price.output) /
      1_000_000 +
    webLookups * WEB_LOOKUP_USD;
  return Math.ceil(usd * 1_000_000);
}

/** Adds two usage records (continuations and tool rounds of one reply). */
export function addUsage(a: ChatUsage, b: ChatUsage): ChatUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  };
}
