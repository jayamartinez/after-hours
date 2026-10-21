import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';

import type { ChatMessage } from '@/chat/types';
import { onboardingStore } from '@/onboarding/use-onboarding';

import { notificationsStore } from './instance';
import { replyNotice } from './reply-notice';
import { playSound } from './sounds';
import { totalUnread, type NotificationsState } from './store';

export { notificationsStore };

export function useNotifications<T>(selector: (state: NotificationsState) => T): T {
  return useStore(notificationsStore, selector);
}

export const useTotalUnread = () => useNotifications((s) => totalUnread(s.unread));

/** The banner on screen: the latest message from one companion (a new one replaces it). */
export interface Banner {
  companionId: string;
  message: ChatMessage;
}

let activeChatId: string | null = null;
let currentPath = '/';
let banner: Banner | null = null;
const bannerListeners = new Set<() => void>();

const setBanner = (next: Banner | null) => {
  banner = next;
  bannerListeners.forEach((listener) => listener());
};

export const dismissBanner = () => setBanner(null);

export function useBanner(): Banner | null {
  return useSyncExternalStore(
    (listener) => {
      bannerListeners.add(listener);
      return () => bannerListeners.delete(listener);
    },
    () => banner,
    () => banner,
  );
}

/** Kept current by the banner host, which sits above every screen. */
export const setCurrentPath = (path: string) => {
  currentPath = path;
};

/**
 * Marks a companion's chat as the one on screen while it is focused: its messages are not
 * counted as unread, its unread count clears, and its banner goes away.
 */
export function useActiveChat(companionId: string | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (!companionId) return undefined;
      activeChatId = companionId;
      notificationsStore.getState().clearUnread(companionId);
      if (banner?.companionId === companionId) setBanner(null);
      return () => {
        if (activeChatId === companionId) activeChatId = null;
      };
    }, [companionId]),
  );
}

/**
 * A companion message arrived from a live reply. `first`: the reply's first message, which
 * plays the chime (once per reply, not per bubble).
 */
export function notifyReply(companionId: string, message: ChatMessage, first: boolean) {
  if (first) playSound('reply');
  const notice = replyNotice({
    companionId,
    activeChatId,
    path: currentPath,
    onboarded: onboardingStore.getState().completed,
  });
  if (notice.unread) notificationsStore.getState().addUnread(companionId);
  if (notice.banner) setBanner({ companionId, message });
}
