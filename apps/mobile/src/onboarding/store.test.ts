import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';

import { DEFAULT_PREFERENCES } from './preferences';
import { createOnboardingStore, ONBOARDING_STORAGE_KEY } from './store';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StateStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { storage, data };
}

const saved = (data: Map<string, string>) =>
  JSON.parse(data.get(ONBOARDING_STORAGE_KEY) ?? '{}').state;

describe('onboarding store', () => {
  it('starts incomplete with default answers', () => {
    const store = createOnboardingStore(memoryStorage().storage);
    const s = store.getState();
    expect(s.completed).toBe(false);
    expect(s.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(s.demoPurchase).toBeNull();
  });

  it('records answers and completes with them', () => {
    const { storage, data } = memoryStorage();
    const store = createOnboardingStore(storage);
    const a = store.getState();
    a.toggleLookingFor('banter');
    a.toggleLookingFor('think');
    a.toggleLookingFor('banter');
    a.setTexting({ pace: 4 });
    a.setDynamic({ x: 2, y: -3 });
    a.setTalkWindow({ start: 23, end: 26 });
    a.setMatchedCompanion('roya');
    a.complete();

    const s = store.getState();
    expect(s.completed).toBe(true);
    expect(s.preferences.lookingFor).toEqual(['think']);
    expect(s.preferences.texting).toEqual({ ...DEFAULT_PREFERENCES.texting, pace: 4 });
    expect(s.preferences.dynamic).toEqual({ x: 1, y: -1 });
    expect(s.preferences.talkWindow).toEqual({ start: 23, end: 2 });
    expect(saved(data)).toMatchObject({ completed: true, matchedCompanionId: 'roya' });
  });

  it('keeps at most three values in pick order; dropping one moves later picks up', () => {
    const store = createOnboardingStore(memoryStorage().storage);
    const { toggleValue } = store.getState();
    toggleValue('remembers');
    toggleValue('curious');
    toggleValue('honest');
    toggleValue('calm');
    expect(store.getState().preferences.values).toEqual(['remembers', 'curious', 'honest']);
    toggleValue('remembers');
    toggleValue('calm');
    expect(store.getState().preferences.values).toEqual(['curious', 'honest', 'calm']);
  });

  it('skip completes with default answers', () => {
    const store = createOnboardingStore(memoryStorage().storage);
    store.getState().toggleValue('flirty');
    store.getState().skip();
    const s = store.getState();
    expect(s.completed).toBe(true);
    expect(s.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('replay clears answers and completion but keeps the demo purchase', () => {
    const store = createOnboardingStore(memoryStorage().storage);
    const a = store.getState();
    a.toggleValue('honest');
    a.setMatchedCompanion('roy');
    a.purchaseDemo('annual', new Date('2026-10-16T00:00:00Z'));
    a.complete();
    a.replay();
    const s = store.getState();
    expect(s.completed).toBe(false);
    expect(s.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(s.matchedCompanionId).toBeNull();
    expect(s.demoPurchase).toEqual({ plan: 'annual', purchasedAt: '2026-10-16T00:00:00.000Z' });
  });

  it('marks changed answers for saving until the server has the latest ones', () => {
    const { storage, data } = memoryStorage();
    const store = createOnboardingStore(storage);
    expect(store.getState().profilePending).toBe(false);
    store.getState().toggleValue('honest');
    const sent = store.getState().preferences;
    expect(store.getState().profilePending).toBe(true);
    expect(saved(data).profilePending).toBe(true);

    // Changed again while the save was in flight: the older answers do not count.
    store.getState().toggleValue('calm');
    store.getState().markProfileSaved(sent);
    expect(store.getState().profilePending).toBe(true);

    store.getState().markProfileSaved(store.getState().preferences);
    expect(store.getState().profilePending).toBe(false);
    expect(saved(data).profilePending).toBe(false);
  });

  it('skip leaves nothing to save', () => {
    const store = createOnboardingStore(memoryStorage().storage);
    store.getState().toggleValue('flirty');
    store.getState().skip();
    expect(store.getState().profilePending).toBe(false);
  });

  it('demo purchase sets and resets the local entitlement', () => {
    const { storage, data } = memoryStorage();
    const store = createOnboardingStore(storage);
    store.getState().purchaseDemo('monthly');
    expect(store.getState().demoPurchase?.plan).toBe('monthly');
    expect(saved(data).demoPurchase.plan).toBe('monthly');
    store.getState().resetDemoPurchase();
    expect(store.getState().demoPurchase).toBeNull();
    expect(saved(data).demoPurchase).toBeNull();
  });

  it('rehydrates saved state and fills answers added later with defaults', async () => {
    const { storage } = memoryStorage({
      [ONBOARDING_STORAGE_KEY]: JSON.stringify({
        state: { completed: true, matchedCompanionId: 'roy', preferences: { voice: 'text' } },
        version: 1,
      }),
    });
    const store = createOnboardingStore(storage);
    await store.persist.rehydrate();
    const s = store.getState();
    expect(s.completed).toBe(true);
    expect(s.matchedCompanionId).toBe('roy');
    expect(s.preferences).toEqual({ ...DEFAULT_PREFERENCES, voice: 'text' });
  });
});
