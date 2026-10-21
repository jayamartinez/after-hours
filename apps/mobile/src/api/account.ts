import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CONVERSATIONS_QUERY_KEY, forgetConversations } from '@/chat/use-conversation';
import { notificationsStore } from '@/notifications/instance';
import { onboardingStore } from '@/onboarding/use-onboarding';

import { CREDITS_QUERY_KEY, GALLERY_QUERY_KEY } from './credits';
import { MEMORIES_QUERY_KEY } from './memories';
import { resetSession } from './session';
import { STARTERS_QUERY_KEY } from './starters';
import { apiRequest } from './transport';

/** Data deletion: clear one companion's chat history, or delete the whole account. */

/** Deletes the user's messages with one companion; memories stay. */
export function useClearConversation(companionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('DELETE', `/conversations/${companionId}`),
    onSuccess: async () => {
      forgetConversations(companionId);
      notificationsStore.getState().clearUnread(companionId);
      await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

/**
 * Deletes every conversation, message, memory, and onboarding answer of this device's user, then drops the
 * session; the next request starts a new anonymous one.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('DELETE', '/account'),
    onSuccess: async () => {
      // Demo Plus lives on the phone too; a deleted account starts on the free plan.
      onboardingStore.getState().resetDemoPurchase();
      await resetSession();
      forgetConversations();
      notificationsStore.getState().clearAllUnread();
      // Reset, not remove: a screen still showing one of these (the You tab's balance)
      // refetches for the new session instead of keeping a query that never loads.
      await Promise.all(
        [
          MEMORIES_QUERY_KEY,
          CREDITS_QUERY_KEY,
          GALLERY_QUERY_KEY,
          STARTERS_QUERY_KEY,
          CONVERSATIONS_QUERY_KEY,
        ].map((queryKey) => queryClient.resetQueries({ queryKey })),
      );
    },
  });
}
