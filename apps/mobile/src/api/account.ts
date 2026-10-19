import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CONVERSATIONS_QUERY_KEY, forgetConversations } from '@/chat/use-conversation';

import { CREDITS_QUERY_KEY, GALLERY_QUERY_KEY } from './credits';
import { MEMORIES_QUERY_KEY } from './memories';
import { resetSession } from './session';
import { apiRequest } from './transport';

/** Data deletion: clear one companion's chat history, or delete the whole account. */

/** Deletes the user's messages with one companion; memories stay. */
export function useClearConversation(companionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('DELETE', `/conversations/${companionId}`),
    onSuccess: async () => {
      forgetConversations(companionId);
      await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

/**
 * Deletes every conversation, message, and memory of this device's user, then drops the
 * session; the next request starts a new anonymous one.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('DELETE', '/account'),
    onSuccess: async () => {
      await resetSession();
      forgetConversations();
      queryClient.removeQueries({ queryKey: MEMORIES_QUERY_KEY });
      queryClient.removeQueries({ queryKey: CREDITS_QUERY_KEY });
      queryClient.removeQueries({ queryKey: GALLERY_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
