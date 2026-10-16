/**
 * Per-companion boolean preference (e.g. "Proactive messages"). Unset companions fall back to
 * the character-config default. With `storage`, choices persist locally (AsyncStorage: native
 * storage on iOS, localStorage on web); without it they last for the session.
 */
export interface PreferenceStore {
  /** The stored value, or `fallback` (the config default) when the user has not chosen. */
  get(companionId: string, fallback: boolean): boolean;
  set(companionId: string, value: boolean): void;
  subscribe(listener: () => void): () => void;
  /** Resolves once stored values have been read (immediately without storage). */
  ready: Promise<void>;
}

export interface PreferenceStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

function parseStored(raw: string | null): Map<string, boolean> {
  const parsed = new Map<string, boolean>();
  if (!raw) return parsed;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return parsed;
    for (const [id, value] of Object.entries(data)) {
      if (typeof value === 'boolean') parsed.set(id, value);
    }
  } catch {
    // Corrupt value: start from config defaults.
  }
  return parsed;
}

export function createPreferenceStore(storage?: PreferenceStorage, key = ''): PreferenceStore {
  const values = new Map<string, boolean>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const persist = () => {
    if (!storage) return;
    Promise.resolve(storage.setItem(key, JSON.stringify(Object.fromEntries(values)))).catch(
      (error: unknown) => console.warn('[preferences] Could not save.', error),
    );
  };

  const ready = storage
    ? Promise.resolve()
        .then(() => storage.getItem(key))
        .then((raw) => {
          // Choices made before storage answered win over stored ones.
          for (const [id, value] of parseStored(raw)) {
            if (!values.has(id)) values.set(id, value);
          }
          notify();
        })
        .catch((error: unknown) => console.warn('[preferences] Could not load.', error))
    : Promise.resolve();

  return {
    get: (companionId, fallback) => values.get(companionId) ?? fallback,
    set(companionId, value) {
      if (values.get(companionId) === value) return;
      values.set(companionId, value);
      notify();
      persist();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ready,
  };
}
