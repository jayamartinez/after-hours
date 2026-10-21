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
  it('opens for the user to write first, with every free message available', () => {
    expect(firstChatPhase([], true, 0)).toEqual({ phase: 'open', left: FREE_MESSAGES });
    expect(firstChatPhase([them()], false, 0).phase).toBe('open');
  });

  it('counts down free messages as they are sent', () => {
    expect(firstChatPhase([you()], true, 1)).toEqual({ phase: 'open', left: 2 });
    expect(firstChatPhase([you(), them(), you(), them()], false, 2)).toEqual({
      phase: 'open',
      left: 1,
    });
  });

  it('waits for the reply to the last free message, then ends onboarding', () => {
    const used = [you(), them(), you(), them(), you()];
    expect(firstChatPhase(used, false, 3)).toEqual({ phase: 'waiting', left: 0 });
    expect(firstChatPhase([...used, them()], true, 3).phase).toBe('waiting');
    expect(firstChatPhase([...used, them()], false, 3)).toEqual({ phase: 'answered', left: 0 });
  });

  it('ignores older history in the thread (a replayed onboarding)', () => {
    const history = [you(), them(), you(), them(), you(), them()];
    expect(firstChatPhase(history, false, 0)).toEqual({ phase: 'open', left: FREE_MESSAGES });
    expect(firstChatPhase([...history, you(), them()], false, 1)).toEqual({
      phase: 'open',
      left: 2,
    });
  });
});
