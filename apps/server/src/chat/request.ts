import type { CharacterConfig } from '@after-hours/contracts';

import type { ChatRequest, ChatTurn } from '../providers/types';

import { buildTurnContext, type TurnContext } from './context';
import { SEND_PHOTO_TOOL } from './photo-tool';
import { buildSystemPrompt, type UserPrefs } from './prompt';

/** Turns of history sent with each request. Older context reaches the model as memories. */
export const HISTORY_WINDOW = 40;

const OPENED_MARKER: ChatTurn = { role: 'user', content: '[opened the chat]' };

export interface ChatRequestInput extends TurnContext {
  /** Prior turns plus the user's latest message, oldest first. */
  history: readonly ChatTurn[];
  prefs?: UserPrefs;
  /** Offer the `send_photo` tool (and its prompt rules). */
  photos?: boolean;
}

/**
 * The single path from character config to a model request:
 * config → `buildSystemPrompt` (stable, cached) + `buildTurnContext` (memories, time) +
 * recent history (+ the photo tool) → `ChatModel.stream`.
 */
export function buildChatRequest(character: CharacterConfig, input: ChatRequestInput): ChatRequest {
  const history = input.history.slice(-HISTORY_WINDOW);
  // The API requires the first message to come from the user; a thread the companion
  // opened (publicProfile.copy.firstMessage) gets a neutral marker in front instead of losing the opener.
  const messages: ChatTurn[] =
    history[0]?.role === 'assistant' ? [OPENED_MARKER, ...history] : [...history];
  return {
    system: {
      stable: buildSystemPrompt(character, input.prefs, { photos: input.photos }),
      context: buildTurnContext(character, input),
    },
    messages,
    ...(input.photos ? { tools: [SEND_PHOTO_TOOL] } : {}),
  };
}
