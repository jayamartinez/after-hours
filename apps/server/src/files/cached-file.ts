import { readFileSync, statSync } from 'node:fs';

/**
 * Returns a loader that re-reads `filePath` only when its mtime or size changes, so edits
 * apply without a restart and parse warnings print once per change. A missing file
 * yields `null` (normal: no overrides) and is not logged. `parse` should not throw;
 * `onReadError` handles an unreadable file.
 */
export function createCachedFileLoader<T>(
  filePath: string,
  parse: (text: string) => T,
  onReadError: (reason: string) => T,
): () => T | null {
  let cache: { mtimeMs: number; size: number; value: T } | null = null;

  return () => {
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      cache = null;
      return null;
    }
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache.value;

    let value: T;
    try {
      value = parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      value = onReadError(error instanceof Error ? error.message : String(error));
    }
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, value };
    return value;
  };
}

export type JsonResult = { ok: true; value: unknown } | { ok: false; reason: string };

/** Parses JSON without throwing. */
export function parseJson(text: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
