import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/** In-app notifications (D-046): unread counts per companion and the sounds setting. */
export interface NotificationsData {
  /** Companion messages that arrived while their chat was not open. */
  unread: Record<string, number>;
  /** The send tap and the reply chime ("Message sounds" on You). */
  soundsOn: boolean;
}

export interface NotificationsActions {
  addUnread: (companionId: string, count?: number) => void;
  clearUnread: (companionId: string) => void;
  /** After "Delete all my data". */
  clearAllUnread: () => void;
  setSoundsOn: (on: boolean) => void;
}

export type NotificationsState = NotificationsData & NotificationsActions;

export const NOTIFICATIONS_STORAGE_KEY = 'after-hours.notifications.v1';

/** Total unread across companions: the Chats tab badge. */
export const totalUnread = (unread: Record<string, number>) =>
  Object.values(unread).reduce((sum, n) => sum + n, 0);

/** Store factory; storage is injected so tests run without AsyncStorage. */
export function createNotificationsStore(storage: StateStorage) {
  return createStore<NotificationsState>()(
    persist(
      (set) => ({
        unread: {},
        soundsOn: true,
        addUnread: (companionId, count = 1) =>
          set((s) => ({
            unread: { ...s.unread, [companionId]: (s.unread[companionId] ?? 0) + count },
          })),
        clearUnread: (companionId) =>
          set((s) => {
            if (!s.unread[companionId]) return {};
            const { [companionId]: _cleared, ...rest } = s.unread;
            return { unread: rest };
          }),
        clearAllUnread: () => set({ unread: {} }),
        setSoundsOn: (soundsOn) => set({ soundsOn }),
      }),
      {
        name: NOTIFICATIONS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (s): NotificationsData => ({ unread: s.unread, soundsOn: s.soundsOn }),
      },
    ),
  );
}
