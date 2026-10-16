import { describe, expect, it, vi } from 'vitest';

import { createPreferenceStore, type PreferenceStorage } from './preference-store';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: PreferenceStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
  };
  return { storage, data };
}

describe('preference store', () => {
  it('falls back to the config default until the user chooses', () => {
    const store = createPreferenceStore();
    expect(store.get('roy', false)).toBe(false);
    expect(store.get('roya', true)).toBe(true);
    store.set('roy', true);
    expect(store.get('roy', false)).toBe(true);
    expect(store.get('roya', true)).toBe(true);
  });

  it('notifies subscribers on change only', () => {
    const store = createPreferenceStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set('roy', true);
    store.set('roy', true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set('roy', false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('loads saved choices and persists new ones', async () => {
    const { storage, data } = memoryStorage({ prefs: JSON.stringify({ roya: true }) });
    const store = createPreferenceStore(storage, 'prefs');
    await store.ready;
    expect(store.get('roya', false)).toBe(true);
    store.set('roy', true);
    await Promise.resolve();
    expect(JSON.parse(data.get('prefs') ?? '{}')).toEqual({ roya: true, roy: true });
  });

  it('keeps a choice made before storage finished loading', async () => {
    const { storage } = memoryStorage({ prefs: JSON.stringify({ roy: false }) });
    const store = createPreferenceStore(storage, 'prefs');
    store.set('roy', true);
    await store.ready;
    expect(store.get('roy', false)).toBe(true);
  });

  it('ignores corrupt or non-boolean stored values', async () => {
    for (const raw of ['not json', '[true]', JSON.stringify({ roy: 'yes', roya: true })]) {
      const store = createPreferenceStore(memoryStorage({ prefs: raw }).storage, 'prefs');
      await store.ready;
      expect(store.get('roy', false)).toBe(false);
    }
  });
});
