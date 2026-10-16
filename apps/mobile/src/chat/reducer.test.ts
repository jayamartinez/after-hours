import { describe, expect, it } from 'vitest';

import { conversationReducer } from './reducer';
import { EMPTY_CONVERSATION, type ChatMessage, type ConversationState } from './types';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  role: 'user',
  kind: 'text',
  content: 'hi',
  status: 'sending',
  createdAt: '2026-10-16T23:40:00.000Z',
  reactions: [],
  ...overrides,
});

const withMessages = (...messages: ChatMessage[]): ConversationState => ({
  messages,
  typing: false,
  loaded: true,
});

describe('conversationReducer', () => {
  it('loads history and marks the conversation loaded', () => {
    const state = conversationReducer(EMPTY_CONVERSATION, {
      type: 'loaded',
      messages: [message()],
    });
    expect(state).toEqual({ messages: [message()], typing: false, loaded: true });
  });

  it('appends a sent message once (idempotent by id)', () => {
    const once = conversationReducer(withMessages(), { type: 'send', message: message() });
    const twice = conversationReducer(once, { type: 'send', message: message() });
    expect(once.messages).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it('moves status forward and ignores late, older statuses', () => {
    let state = withMessages(message());
    state = conversationReducer(state, { type: 'status', id: 'm1', status: 'sent' });
    expect(state.messages[0]?.status).toBe('sent');
    state = conversationReducer(state, { type: 'status', id: 'm1', status: 'read' });
    const afterLateSent = conversationReducer(state, { type: 'status', id: 'm1', status: 'sent' });
    expect(afterLateSent).toBe(state);
    expect(afterLateSent.messages[0]?.status).toBe('read');
  });

  it('can fail a message and recover from failed', () => {
    let state = conversationReducer(withMessages(message({ status: 'sent' })), {
      type: 'status',
      id: 'm1',
      status: 'failed',
    });
    expect(state.messages[0]?.status).toBe('failed');
    state = conversationReducer(state, { type: 'status', id: 'm1', status: 'sending' });
    expect(state.messages[0]?.status).toBe('sending');
  });

  it('readAll marks pending user messages read, but not failed or assistant ones', () => {
    const state = conversationReducer(
      withMessages(
        message({ id: 'a', status: 'sent' }),
        message({ id: 'b', status: 'failed' }),
        message({ id: 'c', role: 'assistant', status: 'sent' }),
      ),
      { type: 'readAll' },
    );
    expect(state.messages.map((m) => m.status)).toEqual(['read', 'failed', 'sent']);
  });

  it('typing toggles, and receiving a message ends typing', () => {
    let state = conversationReducer(withMessages(), { type: 'typing', typing: true });
    expect(state.typing).toBe(true);
    expect(conversationReducer(state, { type: 'typing', typing: true })).toBe(state);
    state = conversationReducer(state, {
      type: 'receive',
      message: message({ id: 'r', role: 'assistant', status: 'sent' }),
    });
    expect(state.typing).toBe(false);
    expect(state.messages.map((m) => m.id)).toEqual(['r']);
  });

  it('toggles a reaction on and off', () => {
    let state = withMessages(message({ role: 'assistant' }));
    state = conversationReducer(state, { type: 'toggleReaction', id: 'm1', reaction: 'heart' });
    expect(state.messages[0]?.reactions).toEqual(['heart']);
    state = conversationReducer(state, { type: 'toggleReaction', id: 'm1', reaction: 'heart' });
    expect(state.messages[0]?.reactions).toEqual([]);
  });

  it('returns the same state for unknown ids', () => {
    const state = withMessages(message());
    expect(conversationReducer(state, { type: 'status', id: 'nope', status: 'read' })).toBe(state);
  });
});
