import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { useStore } from 'zustand';

import { createOnboardingStore, type OnboardingState } from './store';

/** App-wide onboarding store, persisted locally (AsyncStorage: native storage on iOS, localStorage on web). */
export const onboardingStore = createOnboardingStore(AsyncStorage);

export function useOnboarding<T>(selector: (state: OnboardingState) => T): T {
  return useStore(onboardingStore, selector);
}

const subscribeHydration = (onChange: () => void) =>
  onboardingStore.persist.onFinishHydration(onChange);
const getHydrated = () => onboardingStore.persist.hasHydrated();

/** False until saved answers have loaded; routing must wait for this. */
export function useOnboardingHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}

export type { OnboardingPreferences } from './preferences';
