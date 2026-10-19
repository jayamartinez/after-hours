/**
 * UI-facing chat model. The wire shape is `ChatMessageDto` in packages/contracts; the API
 * source maps it 1:1 (`api-source.ts`). `sending` and `delivered` exist only here.
 */

export type MessageRole = 'user' | 'assistant';
export type MessageKind = 'text' | 'image' | 'voice';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Long-press reaction row, left to right (Paper: Chat A · long-press). */
export const REACTIONS = ['heart', 'ha', 'wow', 'question', 'like'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Where an image bubble's picture comes from. */
export type ImageRef =
  /**
   * No image yet: a labeled placeholder card describing the shot (D-026). Never shows a
   * real or configured image.
   */
  | { source: 'placeholder'; description: string }
  /** A stored media asset (M4: signed URL from the server). */
  | { source: 'uri'; uri: string };

export interface VoiceRef {
  durationSec: number;
  /** Playable audio (M4+). Absent: the bubble is UI only. */
  uri?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  /** Text body; for image and voice messages, an optional caption or transcript. */
  content: string;
  status: MessageStatus;
  /** ISO 8601. */
  createdAt: string;
  /** Reactions the user put on this message. */
  reactions: Reaction[];
  image?: ImageRef;
  voice?: VoiceRef;
  /** Idempotency key of a user message; a retry resends it. */
  clientId?: string | null;
}

/** A short message for the toast (errors that have no inline place). */
export interface ChatNotice {
  id: number;
  text: string;
}

export interface ConversationState {
  /** Oldest first. */
  messages: ChatMessage[];
  /** The companion is composing a reply. */
  typing: boolean;
  /** Initial history has been loaded (or seeded). */
  loaded: boolean;
  notice: ChatNotice | null;
}

export const EMPTY_CONVERSATION: ConversationState = {
  messages: [],
  typing: false,
  loaded: false,
  notice: null,
};
