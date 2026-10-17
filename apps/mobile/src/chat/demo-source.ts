import type { PublicCharacter } from '@after-hours/contracts';

import { buildDemoThread, demoReply } from './demo-data';
import { conversationReducer, type ConversationAction } from './reducer';
import type { ConversationSource } from './source';
import { EMPTY_CONVERSATION, type ChatMessage, type ConversationState } from './types';

/** Delays (ms) that make the demo feel like a conversation without pretending to be one. */
export interface DemoTiming {
  sent: number;
  read: number;
  typingStart: number;
  /** Typing time before the reply: base + perChar × reply length, capped at max. */
  typingBase: number;
  typingPerChar: number;
  typingMax: number;
}

export const DEFAULT_DEMO_TIMING: DemoTiming = {
  sent: 250,
  read: 900,
  typingStart: 1200,
  typingBase: 900,
  typingPerChar: 30,
  typingMax: 2600,
};

interface DemoSourceOptions {
  timing?: DemoTiming;
  now?: () => number;
}

interface Conversation {
  state: ConversationState;
  listeners: Set<() => void>;
  /** Pending timers for the current reply cycle; a new send restarts the cycle. */
  replyTimers: ReturnType<typeof setTimeout>[];
  turns: number;
  /** When `start`'s opening lines finish; replies wait until then. */
  openingEndsAt: number;
}

/**
 * In-memory demo conversations (one per companion, lost on reload). Sends go
 * sending → sent → read, then the companion "types" and answers with a canned line from
 * its config. Several quick sends get one reply, like a real burst.
 */
export function createDemoConversationSource(options: DemoSourceOptions = {}): ConversationSource {
  const timing = options.timing ?? DEFAULT_DEMO_TIMING;
  const now = options.now ?? Date.now;
  const conversations = new Map<string, Conversation>();
  let idCounter = 0;

  const conversation = (companionId: string): Conversation => {
    let entry = conversations.get(companionId);
    if (!entry) {
      entry = {
        state: EMPTY_CONVERSATION,
        listeners: new Set(),
        replyTimers: [],
        turns: 0,
        openingEndsAt: 0,
      };
      conversations.set(companionId, entry);
    }
    return entry;
  };

  const dispatch = (companionId: string, action: ConversationAction) => {
    const entry = conversation(companionId);
    const next = conversationReducer(entry.state, action);
    if (next === entry.state) return;
    entry.state = next;
    entry.listeners.forEach((listener) => listener());
  };

  const makeMessage = (
    companionId: string,
    fields: Pick<ChatMessage, 'role' | 'content' | 'status'>,
  ): ChatMessage => ({
    id: `demo-${companionId}-${now()}-${++idCounter}`,
    kind: 'text',
    createdAt: new Date(now()).toISOString(),
    reactions: [],
    ...fields,
  });

  const scheduleReply = (companion: PublicCharacter, sentId: string) => {
    const entry = conversation(companion.id);
    entry.replyTimers.forEach(clearTimeout);
    const reply = demoReply(companion, entry.turns);
    const typingFor = typingTime(reply);
    const at = (delay: number, run: () => void) => entry.replyTimers.push(setTimeout(run, delay));
    const wait = Math.max(0, entry.openingEndsAt - now());

    at(timing.sent, () => dispatch(companion.id, { type: 'status', id: sentId, status: 'sent' }));
    at(wait + timing.read, () => dispatch(companion.id, { type: 'readAll' }));
    at(wait + timing.typingStart, () => dispatch(companion.id, { type: 'typing', typing: true }));
    at(wait + timing.typingStart + typingFor, () => {
      entry.turns += 1;
      entry.replyTimers = [];
      dispatch(companion.id, {
        type: 'receive',
        message: makeMessage(companion.id, { role: 'assistant', content: reply, status: 'sent' }),
      });
    });
  };

  const typingTime = (text: string) =>
    Math.min(timing.typingMax, timing.typingBase + timing.typingPerChar * text.length);

  const load = (companion: PublicCharacter) => {
    if (conversation(companion.id).state.loaded) return;
    dispatch(companion.id, { type: 'loaded', messages: buildDemoThread(companion, now()) });
  };

  return {
    isDemo: true,

    getSnapshot: (companionId) => conversations.get(companionId)?.state ?? EMPTY_CONVERSATION,

    subscribe(companionId, listener) {
      const { listeners } = conversation(companionId);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load,

    start(companion) {
      const entry = conversation(companion.id);
      if (entry.state.loaded) return;
      dispatch(companion.id, { type: 'loaded', messages: [] });
      // Not reply timers: an early send must not cancel the opening lines.
      let at = timing.typingStart;
      for (const content of companion.copy.firstMessage) {
        setTimeout(() => dispatch(companion.id, { type: 'typing', typing: true }), at);
        at += typingTime(content);
        setTimeout(
          () =>
            dispatch(companion.id, {
              type: 'receive',
              message: makeMessage(companion.id, { role: 'assistant', content, status: 'sent' }),
            }),
          at,
        );
        at += timing.read;
      }
      entry.openingEndsAt = now() + at - timing.read;
    },

    send(companion, text) {
      const content = text.trim();
      if (!content) return;
      load(companion);
      const message = makeMessage(companion.id, { role: 'user', content, status: 'sending' });
      dispatch(companion.id, { type: 'send', message });
      scheduleReply(companion, message.id);
    },

    toggleReaction(companionId, messageId, reaction) {
      dispatch(companionId, { type: 'toggleReaction', id: messageId, reaction });
    },
  };
}
