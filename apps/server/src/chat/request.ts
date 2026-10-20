import type { CharacterConfig } from '@after-hours/contracts';

import type { ChatRequest, ChatTurn } from '../providers/types';

import { buildTurnContext, type TurnContext } from './context';
import { SEND_PHOTO_TOOL } from './photo-tool';
import { buildSystemPrompt, type UserPrefs } from './prompt';
import { BLOCKED_DOMAINS, SHARE_IMAGE_TOOL, type webLimitsFor } from './web-tools';

/** Turns of history sent with each request. Older context reaches the model as memories. */
export const HISTORY_WINDOW = 40;

const OPENED_MARKER: ChatTurn = { role: 'user', content: '[opened the chat]' };

export interface ChatRequestInput extends TurnContext {
  /** Prior turns plus the user's latest message, oldest first. */
  history: readonly ChatTurn[];
  prefs?: UserPrefs;
  /** Offer the `send_photo` tool (and its prompt rules). */
  photos?: boolean;
  /** Per-reply web limits (D-038); null or unset: no web access this turn. */
  web?: ReturnType<typeof webLimitsFor>;
}

/**
 * The single path from character config to a model request:
 * config → `buildSystemPrompt` (stable, cached) + `buildTurnContext` (memories, time) +
 * recent history (+ the photo tool) → `ChatModel.stream`.
 */
export function buildChatRequest(character: CharacterConfig, input: ChatRequestInput): ChatRequest {
  const history = input.history.slice(-HISTORY_WINDOW);
  // The API requires the first message to come from the user. A thread that starts with a
  // companion line (e.g. one stored before openers were removed) gets a neutral marker in front.
  const messages: ChatTurn[] =
    history[0]?.role === 'assistant' ? [OPENED_MARKER, ...history] : [...history];
  const { web } = input;
  const tools = [
    ...(input.photos ? [SEND_PHOTO_TOOL] : []),
    ...(web && web.images > 0 ? [SHARE_IMAGE_TOOL] : []),
  ];
  return {
    system: {
      stable: buildSystemPrompt(character, input.prefs, { photos: input.photos, web: !!web }),
      context: buildTurnContext(character, input),
    },
    messages,
    ...(tools.length ? { tools } : {}),
    ...(web
      ? { web: { searches: web.searches, fetches: web.fetches, blockedDomains: BLOCKED_DOMAINS } }
      : {}),
  };
}
