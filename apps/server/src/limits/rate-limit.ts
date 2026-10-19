/**
 * In-process fixed-window limiter (one server instance; docs/architecture.md open
 * decision 6). `take(key)` returns false once `limit` hits arrive within one window.
 */
export interface RateLimiter {
  take(key: string): boolean;
}

export function createRateLimiter(
  limit: number,
  windowMs = 60_000,
  now: () => number = Date.now,
): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key) {
      const t = now();
      const current = windows.get(key);
      if (!current || t - current.start >= windowMs) {
        // Drop stale keys occasionally so the map stays small.
        if (windows.size > 10_000) {
          for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
        }
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}
