import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useCompanion } from '@/api/companions';

import { createDemoConversationSource } from './demo-source';
import type { ConversationSource } from './source';
import type { Reaction } from './types';

/**
 * The single swap point: M3 replaces this with the server-backed source
 * (history via TanStack Query, replies over SSE).
 */
const source: ConversationSource = createDemoConversationSource();

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

  useEffect(() => {
    if (!companion) return;
    if (fresh) source.start(companion);
    else source.load(companion);
  }, [companion, fresh]);

  const subscribe = useCallback((listener: () => void) => source.subscribe(id, listener), [id]);
  const getSnapshot = useCallback(() => source.getSnapshot(id), [id]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const send = useCallback(
    (text: string) => {
      if (companion) source.send(companion, text);
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
    /** Replies are canned demo lines, not the AI. Show the "DEMO DATA" label. */
    isDemo: source.isDemo,
    send,
    toggleReaction,
  };
}
