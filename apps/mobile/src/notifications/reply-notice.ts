/**
 * What a companion message that just arrived should do (D-046):
 * - in that companion's chat: nothing beyond the chime (the bubble is on screen);
 * - on the Chats tab: count it as unread (the row moves up with a dot), no banner;
 * - anywhere else after onboarding: count it as unread and show the banner.
 */
export interface ReplyContext {
  companionId: string;
  /** Companion whose chat is on screen, if any. */
  activeChatId: string | null;
  /** Current route path (`/chats`, `/you`, `/chat/roy`, …). */
  path: string;
  onboarded: boolean;
}

export interface ReplyNotice {
  unread: boolean;
  banner: boolean;
}

export const CHATS_PATH = '/chats';

export function replyNotice({
  companionId,
  activeChatId,
  path,
  onboarded,
}: ReplyContext): ReplyNotice {
  if (activeChatId === companionId) return { unread: false, banner: false };
  return { unread: true, banner: onboarded && path !== CHATS_PATH };
}
