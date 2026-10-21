import AsyncStorage from '@react-native-async-storage/async-storage';

import { createNotificationsStore } from './store';

/** App-wide notifications store, persisted locally like the onboarding answers. */
export const notificationsStore = createNotificationsStore(AsyncStorage);
