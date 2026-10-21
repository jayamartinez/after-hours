import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';

import { CHATS_PATH, replyNotice } from './reply-notice';
import { createNotificationsStore, NOTIFICATIONS_STORAGE_KEY, totalUnread } from './store';

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: StateStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { storage, data };
}

describe('replyNotice', () => {
  const base = { companionId: 'roya', activeChatId: null, path: '/you', onboarded: true };

  it('says nothing more while that chat is on screen', () => {
    expect(replyNotice({ ...base, activeChatId: 'roya', path: '/chat/roya' })).toEqual({
      unread: false,
      banner: false,
    });
  });

  it('banners and counts a reply from another companion’s chat', () => {
    expect(replyNotice({ ...base, activeChatId: 'roy', path: '/chat/roy' })).toEqual({
      unread: true,
      banner: true,
    });
  });

  it('counts but does not banner on the Chats tab', () => {
    expect(replyNotice({ ...base, path: CHATS_PATH })).toEqual({ unread: true, banner: false });
  });

  it('never banners during onboarding', () => {
    expect(replyNotice({ ...base, onboarded: false }).banner).toBe(false);
  });
});

describe('notifications store', () => {
  it('counts unread per companion and clears one at a time', () => {
    const store = createNotificationsStore(memoryStorage().storage);
    const s = () => store.getState();
    s().addUnread('roya');
    s().addUnread('roya');
    s().addUnread('roy');
    expect(totalUnread(s().unread)).toBe(3);
    s().clearUnread('roya');
    expect(s().unread).toEqual({ roy: 1 });
    s().clearAllUnread();
    expect(totalUnread(s().unread)).toBe(0);
  });

  it('keeps sounds on by default and saves the setting and counts', () => {
    const { storage, data } = memoryStorage();
    const store = createNotificationsStore(storage);
    expect(store.getState().soundsOn).toBe(true);
    store.getState().setSoundsOn(false);
    store.getState().addUnread('roy', 2);
    const saved = JSON.parse(data.get(NOTIFICATIONS_STORAGE_KEY) ?? '{}').state;
    expect(saved).toEqual({ unread: { roy: 2 }, soundsOn: false });
  });
});
