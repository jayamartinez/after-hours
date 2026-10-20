import { describe, expect, it } from 'vitest';

import { addUsage, billedCostMicroUsd, replyCostMicroUsd } from './costs';

const usage = (input: number, output: number, cacheRead = 0, cacheWrite = 0) => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadInputTokens: cacheRead,
  cacheCreationInputTokens: cacheWrite,
});

describe('replyCostMicroUsd', () => {
  it('prices input, output, cache reads and writes, and web lookups', () => {
    // 1M input + 1M output on the Plus model: $4 + $20.
    expect(replyCostMicroUsd('claude-opus-5-5', usage(1_000_000, 1_000_000))).toBe(24_000_000);
    // Cache reads are a fraction of input; writes cost 1.25x input.
    expect(replyCostMicroUsd('claude-sonnet-5-5', usage(0, 0, 1_000_000))).toBe(200_000);
    expect(replyCostMicroUsd('claude-sonnet-5-5', usage(0, 0, 0, 1_000_000))).toBe(2_500_000);
    expect(replyCostMicroUsd('claude-sonnet-5-5', usage(0, 0), 2)).toBe(20_000);
  });

  it('prices an unknown model conservatively', () => {
    expect(replyCostMicroUsd('mystery-model', usage(1000, 0))).toBeGreaterThan(
      replyCostMicroUsd('claude-opus-5-5', usage(1000, 0)),
    );
  });

  it('adds usage across rounds', () => {
    expect(addUsage(usage(1, 2, 3, 4), usage(10, 20, 30, 40))).toEqual(usage(11, 22, 33, 44));
  });
});

describe('billedCostMicroUsd', () => {
  it('prices each request at the model that served it, then sums', () => {
    const opus = { model: 'claude-opus-5-5', usage: usage(1000, 100), webRequests: 1 };
    const sonnet = { model: 'claude-sonnet-5-5', usage: usage(1000, 100), webRequests: 0 };
    expect(billedCostMicroUsd([opus, sonnet])).toBe(
      replyCostMicroUsd('claude-opus-5-5', opus.usage, 1) +
        replyCostMicroUsd('claude-sonnet-5-5', sonnet.usage),
    );
    expect(billedCostMicroUsd([])).toBe(0);
  });
});
