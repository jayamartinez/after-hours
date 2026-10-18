import { describe, expect, it } from 'vitest';

import type { ChatMessage, MessageRole } from '@/chat/types';

import { FREE_MESSAGES, firstChatPhase } from './first-chat';

let n = 0;
const msg = (role: MessageRole): ChatMessage => ({
  id: `m${++n}`,
  role,
  kind: 'text',
  content: role,
  status: 'sent',
  createdAt: new Date(0).toISOString(),
  reactions: [],
});
const them = msg.bind(null, 'assistant');
const you = msg.bind(null, 'user');

describe('firstChatPhase', () => {
  it('waits for every opening line before offering replies', () => {
    expect(firstChatPhase([], true, 2)).toEqual({ phase: 'opening', left: FREE_MESSAGES });
    expect(firstChatPhase([them()], false, 2).phase).toBe('opening');
    expect(firstChatPhase([them(), them()], true, 2).phase).toBe('opening');
    expect(firstChatPhase([them(), them()], false, 2)).toEqual({ phase: 'open', left: 2 });
  });

  it('counts down free messages', () => {
    expect(firstChatPhase([them(), them(), you()], true, 2)).toEqual({ phase: 'open', left: 1 });
    expect(firstChatPhase([them(), them(), you(), them()], false, 2).left).toBe(1);
  });

  it('a send during the opening lines still counts and keeps the chat open', () => {
    expect(firstChatPhase([them(), you()], true, 2)).toEqual({ phase: 'open', left: 1 });
  });

  it('waits for the last reply, then hands off to the paywall', () => {
    const used = [them(), them(), you(), them(), you()];
    expect(firstChatPhase(used, false, 2)).toEqual({ phase: 'waiting', left: 0 });
    expect(firstChatPhase(used, true, 2).phase).toBe('waiting');
    expect(firstChatPhase([...used, them()], true, 2).phase).toBe('waiting');
    expect(firstChatPhase([...used, them()], false, 2)).toEqual({ phase: 'answered', left: 0 });
  });

  it('an existing conversation keeps its free messages and skips the opener', () => {
    const history = [them(), them(), you(), them(), you(), them()];
    expect(firstChatPhase(history, false, 2, 2)).toEqual({ phase: 'open', left: 2 });
    expect(firstChatPhase([...history, you()], true, 2, 2)).toEqual({ phase: 'open', left: 1 });
  });
});
