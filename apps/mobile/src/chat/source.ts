import type { PublicCharacter } from '@after-hours/contracts';

import type { ConversationState, Reaction } from './types';

/**
 * Where conversations come from. The UI talks only to this interface through
 * `useConversation`; M3 replaces the demo implementation with one backed by the server
 * (history fetch + SSE stream) without touching components.
 */
export interface ConversationSource {
  /** True while replies are canned demo lines, not the AI. The UI shows "DEMO DATA". */
  readonly isDemo: boolean;
  getSnapshot(companionId: string): ConversationState;
  subscribe(companionId: string, listener: () => void): () => void;
  /** Load history once (idempotent). */
  load(companion: PublicCharacter): void;
  /**
   * Open a brand-new conversation: the companion types its opening lines. No-op when
   * history is already loaded, so a later `load` keeps what was said here.
   */
  start(companion: PublicCharacter): void;
  send(companion: PublicCharacter, text: string): void;
  toggleReaction(companionId: string, messageId: string, reaction: Reaction): void;
}
