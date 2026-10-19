import type { ChatMessage, ConversationState, MessageStatus, Reaction } from './types';

/**
 * Pure state transitions for one conversation. Both the demo adapter and the server
 * adapter (optimistic send, SSE `ack` / `typing` / `bubble` events) drive the UI through these.
 */
export type ConversationAction =
  | { type: 'loaded'; messages: ChatMessage[] }
  | { type: 'send'; message: ChatMessage }
  /** The server stored an optimistic message: swap in the stored copy (server id). */
  | { type: 'ack'; localId: string; message: ChatMessage }
  | { type: 'status'; id: string; status: MessageStatus }
  /** The companion read everything the user sent so far. */
  | { type: 'readAll' }
  | { type: 'typing'; typing: boolean }
  | { type: 'receive'; message: ChatMessage }
  | { type: 'toggleReaction'; id: string; reaction: Reaction }
  | { type: 'notice'; text: string };

const STATUS_ORDER: Record<MessageStatus, number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/** Status only moves forward (a late `sent` must not undo `read`), except into or out of `failed`. */
function nextStatus(current: MessageStatus, next: MessageStatus): MessageStatus {
  if (next === 'failed' || current === 'failed') return next;
  return STATUS_ORDER[next] > STATUS_ORDER[current] ? next : current;
}

function updateMessage(
  state: ConversationState,
  id: string,
  update: (message: ChatMessage) => ChatMessage,
): ConversationState {
  let changed = false;
  const messages = state.messages.map((message) => {
    if (message.id !== id) return message;
    const next = update(message);
    if (next !== message) changed = true;
    return next;
  });
  return changed ? { ...state, messages } : state;
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'loaded':
      return { ...state, messages: action.messages, typing: false, loaded: true };

    case 'send':
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return { ...state, messages: [...state.messages, action.message] };

    case 'ack': {
      const local = state.messages.find((m) => m.id === action.localId);
      const duplicate =
        action.message.id !== action.localId &&
        state.messages.some((m) => m.id === action.message.id);
      if (duplicate) {
        // Already present (a replayed send): drop the optimistic copy.
        return local
          ? { ...state, messages: state.messages.filter((m) => m.id !== action.localId) }
          : state;
      }
      if (!local) return { ...state, messages: [...state.messages, action.message] };
      const stored: ChatMessage = {
        ...action.message,
        reactions: local.reactions,
        status: nextStatus(local.status, action.message.status),
      };
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.localId ? stored : m)),
      };
    }

    case 'notice':
      return { ...state, notice: { id: (state.notice?.id ?? 0) + 1, text: action.text } };

    case 'status':
      return updateMessage(state, action.id, (message) => {
        const status = nextStatus(message.status, action.status);
        return status === message.status ? message : { ...message, status };
      });

    case 'readAll': {
      let changed = false;
      const messages = state.messages.map((message) => {
        if (message.role !== 'user' || message.status === 'failed' || message.status === 'read') {
          return message;
        }
        changed = true;
        return { ...message, status: 'read' as const };
      });
      return changed ? { ...state, messages } : state;
    }

    case 'typing':
      return state.typing === action.typing ? state : { ...state, typing: action.typing };

    case 'receive':
      // A final message always ends the typing indicator.
      if (state.messages.some((m) => m.id === action.message.id)) {
        return state.typing ? { ...state, typing: false } : state;
      }
      return { ...state, typing: false, messages: [...state.messages, action.message] };

    case 'toggleReaction':
      return updateMessage(state, action.id, (message) => {
        const has = message.reactions.includes(action.reaction);
        return {
          ...message,
          reactions: has
            ? message.reactions.filter((r) => r !== action.reaction)
            : [...message.reactions, action.reaction],
        };
      });
  }
}
