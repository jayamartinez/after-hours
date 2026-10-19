import type { PublicCharacter } from '@after-hours/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useCompanion } from '@/api/companions';
import { emitCreditSignal } from '@/api/credits';
import { apiTransport } from '@/api/transport';

import { createApiConversationSource, fromDto } from './api-source';
import { createDemoConversationSource } from './demo-source';
import type { ChatMessage, Reaction } from './types';

/**
 * The app's one conversation source: the server (history + SSE replies), falling back to
 * labeled demo conversations only when the API is unreachable.
 */
const source = createApiConversationSource({
  transport: apiTransport,
  fallback: createDemoConversationSource(),
  onCredits: emitCreditSignal,
});

export const CONVERSATIONS_QUERY_KEY = ['conversations'] as const;

/** Drops cached threads (one companion, or all) so screens reload them from the server. */
export function forgetConversations(companionId?: string): void {
  source.forget(companionId);
}

function useSourceState(companionId: string) {
  const subscribe = useCallback(
    (listener: () => void) => source.subscribe(companionId, listener),
    [companionId],
  );
  const getSnapshot = useCallback(() => source.getSnapshot(companionId), [companionId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

interface ConversationOptions {
  /** Begin a new conversation with only the companion's opening lines (onboarding). */
  fresh?: boolean;
}

/** One conversation with a companion: messages (oldest first), status flags, and actions. */
export function useConversation(
  companionId: string | undefined,
  { fresh = false }: ConversationOptions = {},
) {
  const { companion, isPending: companionPending } = useCompanion(companionId);
  const id = companion?.id ?? '';

  const state = useSourceState(id);

  // Loads again after `forgetConversations` (history cleared while this screen was open).
  const loaded = state.loaded;
  useEffect(() => {
    if (!companion || loaded) return;
    if (fresh) source.start(companion);
    else source.load(companion);
  }, [companion, fresh, loaded]);

  const send = useCallback(
    (text: string) => {
      if (companion) source.send(companion, text);
    },
    [companion],
  );
  const retry = useCallback(
    (messageId: string) => {
      if (companion) source.retry(companion, messageId);
    },
    [companion],
  );
  const toggleReaction = useCallback(
    (messageId: string, reaction: Reaction) => source.toggleReaction(id, messageId, reaction),
    [id],
  );

  return {
    companion,
    messages: state.messages,
    isTyping: state.typing,
    isLoading: companionPending || (!!companion && !state.loaded),
    /** Replies are canned demo lines, not the AI (the API is unreachable). Show "DEMO DATA". */
    isDemo: source.isDemo,
    /** Latest error text without an inline place (shown as a toast). */
    notice: state.notice,
    send,
    retry,
    toggleReaction,
  };
}

/** Whether conversations are the labeled demo fallback (re-renders when that changes). */
export function useIsDemoConversations() {
  // Switching to the fallback notifies every subscribed conversation, this key included.
  useSourceState('__mode__');
  return source.isDemo;
}

/**
 * Chats tab row: the live thread once it is loaded in this session, otherwise the last
 * stored message from `GET /conversations` (or the companion's opener for a new thread).
 */
export function useConversationPreview(companion: PublicCharacter) {
  const state = useSourceState(companion.id);
  const summaries = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: () => source.fetchSummaries(),
    staleTime: 0,
  });

  const isDemo = source.isDemo;
  useEffect(() => {
    // Demo fallback: seed the canned thread so the row has something to show.
    if (isDemo) source.load(companion);
  }, [companion, isDemo]);

  let last: ChatMessage | undefined;
  if (state.loaded) {
    last = state.messages.at(-1);
  } else {
    const stored = summaries.data?.find((s) => s.companionId === companion.id)?.lastMessage;
    if (stored) last = fromDto(stored);
  }
  const opener = companion.publicProfile.copy.firstMessage.at(-1);
  return { last, opener, isTyping: state.typing, isDemo };
}
