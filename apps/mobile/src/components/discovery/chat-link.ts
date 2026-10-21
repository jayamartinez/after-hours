import { router, type Href } from 'expo-router';

/**
 * Opens the chat thread for a companion. Clears any Companions-side screens first (the
 * preview sheet, a profile) so the chat is the only thing on the stack, full screen.
 * `/chat/[id]` is owned by the chat UI; the `Href` cast keeps this compiling while that route
 * is missing from the generated route types.
 */
export function openChat(companionId: string) {
  dismissAll();
  router.push(`/chat/${encodeURIComponent(companionId)}` as Href);
}

/** Leaves a chat for the Chats tab, never back into Companions. */
export function closeChat() {
  dismissAll();
  router.replace('/chats');
}

/** `dismissAll` with nothing stacked throws (POP_TO_TOP not handled), e.g. from a tab root. */
function dismissAll() {
  if (router.canDismiss()) router.dismissAll();
}
