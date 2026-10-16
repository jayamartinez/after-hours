import type { PublicCharacter } from '@after-hours/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { createPreferenceStore } from './preference-store';

export const PROACTIVE_STORAGE_KEY = 'after-hours:proactive-messages';

/**
 * "Proactive messages" per companion, saved on this device. Nothing sends proactive messages
 * yet; this records the user's choice for when that feature exists.
 */
const proactiveStore = createPreferenceStore(AsyncStorage, PROACTIVE_STORAGE_KEY);

export function useProactivePreference(companion: PublicCharacter) {
  const fallback = companion.proactiveByDefault;
  const read = () => proactiveStore.get(companion.id, fallback);
  const enabled = useSyncExternalStore(proactiveStore.subscribe, read, read);
  const setEnabled = (value: boolean) => proactiveStore.set(companion.id, value);
  return [enabled, setEnabled] as const;
}
