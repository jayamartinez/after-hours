import { router, type Href } from 'expo-router';

/**
 * Opens the chat thread for a companion. `/chat/[id]` is owned by the chat UI; the `Href` cast
 * keeps this compiling while that route is missing from the generated route types.
 */
export function openChat(companionId: string) {
  router.push(`/chat/${encodeURIComponent(companionId)}` as Href);
}
