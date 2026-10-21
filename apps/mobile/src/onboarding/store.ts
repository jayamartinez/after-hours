import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  DEFAULT_PREFERENCES,
  defaultPreferences,
  MAX_VALUES,
  type CompanionValue,
  type Dynamic,
  type LookingFor,
  type OnboardingPreferences,
  type TalkWindow,
  type TextingStyle,
  type VoicePreference,
  clampUnit,
  wrapHour,
} from './preferences';

export type DemoPlan = 'annual' | 'monthly';

export interface OnboardingData {
  preferences: OnboardingPreferences;
  /** True once the user finished or skipped onboarding; first launch routes here until then. */
  completed: boolean;
  /** Companion picked by matching (or by "See the other one") for the reveal and first chat. */
  matchedCompanionId: string | null;
  /** Local mock entitlement. No payment is ever taken. */
  demoPurchase: { plan: DemoPlan; purchasedAt: string } | null;
  /** The answers changed and the server has not saved them yet (`PUT /profile`, D-032). */
  profilePending: boolean;
  /** Messages sent in the onboarding chat this run; the paywall follows the last free one. */
  firstChatSent: number;
}

export interface OnboardingActions {
  toggleLookingFor: (id: LookingFor) => void;
  setTalkWindow: (window: TalkWindow) => void;
  setTexting: (patch: Partial<TextingStyle>) => void;
  /** Adds a value at the next rank, or drops it (and later picks move up) if already picked. */
  toggleValue: (id: CompanionValue) => void;
  setDynamic: (dynamic: Dynamic) => void;
  setVoice: (voice: VoicePreference) => void;
  setAllowCalls: (allow: boolean) => void;
  setMatchedCompanion: (id: string | null) => void;
  /** Finish onboarding with the current answers. */
  complete: () => void;
  /** Skip: finish onboarding with default answers. Keeps any match already made. */
  skip: () => void;
  /** Replay: clear answers and completion so first launch routes to onboarding again. */
  replay: () => void;
  purchaseDemo: (plan: DemoPlan, now?: Date) => void;
  resetDemoPurchase: () => void;
  /** The server saved `preferences`; ignored if the answers changed since they were sent. */
  markProfileSaved: (preferences: OnboardingPreferences) => void;
  countFirstChatSend: () => void;
}

export type OnboardingState = OnboardingData & OnboardingActions;

export const ONBOARDING_STORAGE_KEY = 'after-hours.onboarding.v1';

export const initialOnboardingData = (): OnboardingData => ({
  preferences: defaultPreferences(),
  completed: false,
  matchedCompanionId: null,
  demoPurchase: null,
  profilePending: false,
  firstChatSent: 0,
});

const toggle = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Store factory; storage is injected so tests run without AsyncStorage. */
export function createOnboardingStore(storage: StateStorage) {
  return createStore<OnboardingState>()(
    persist(
      (set) => {
        const updatePrefs = (fn: (p: OnboardingPreferences) => Partial<OnboardingPreferences>) =>
          set((s) => ({
            preferences: { ...s.preferences, ...fn(s.preferences) },
            profilePending: true,
          }));

        return {
          ...initialOnboardingData(),
          toggleLookingFor: (id) => updatePrefs((p) => ({ lookingFor: toggle(p.lookingFor, id) })),
          setTalkWindow: ({ start, end }) =>
            updatePrefs(() => ({ talkWindow: { start: wrapHour(start), end: wrapHour(end) } })),
          setTexting: (patch) => updatePrefs((p) => ({ texting: { ...p.texting, ...patch } })),
          toggleValue: (id) =>
            updatePrefs((p) => {
              if (p.values.includes(id)) return { values: p.values.filter((v) => v !== id) };
              if (p.values.length >= MAX_VALUES) return {};
              return { values: [...p.values, id] };
            }),
          setDynamic: ({ x, y }) =>
            updatePrefs(() => ({ dynamic: { x: clampUnit(x), y: clampUnit(y) } })),
          setVoice: (voice) => updatePrefs(() => ({ voice })),
          setAllowCalls: (allowCalls) => updatePrefs(() => ({ allowCalls })),
          setMatchedCompanion: (matchedCompanionId) => set({ matchedCompanionId }),
          complete: () => set({ completed: true }),
          // Nothing to save: skipping gives no answers.
          skip: () =>
            set({ completed: true, preferences: defaultPreferences(), profilePending: false }),
          replay: () => set((s) => ({ ...initialOnboardingData(), demoPurchase: s.demoPurchase })),
          purchaseDemo: (plan, now = new Date()) =>
            set({ demoPurchase: { plan, purchasedAt: now.toISOString() } }),
          resetDemoPurchase: () => set({ demoPurchase: null }),
          markProfileSaved: (preferences) =>
            set((s) => (s.preferences === preferences ? { profilePending: false } : {})),
          countFirstChatSend: () => set((s) => ({ firstChatSent: s.firstChatSent + 1 })),
        };
      },
      {
        name: ONBOARDING_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (s): OnboardingData => ({
          preferences: s.preferences,
          completed: s.completed,
          matchedCompanionId: s.matchedCompanionId,
          demoPurchase: s.demoPurchase,
          profilePending: s.profilePending,
          firstChatSent: s.firstChatSent,
        }),
        // Fill in fields added after a user's data was saved.
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Partial<OnboardingData>;
          return {
            ...current,
            ...saved,
            preferences: { ...DEFAULT_PREFERENCES, ...saved.preferences },
          };
        },
      },
    ),
  );
}

export type OnboardingStore = ReturnType<typeof createOnboardingStore>;
