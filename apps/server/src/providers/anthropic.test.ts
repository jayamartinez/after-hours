import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SEND_PHOTO_TOOL } from '../chat/photo-tool';

import type Anthropic from '@anthropic-ai/sdk';

import {
  createAnthropicChatModel,
  joinText,
  toAnthropicParams,
  toOutputSchema,
  withHistoryCache,
} from './anthropic';

describe('toOutputSchema', () => {
  it('drops keywords structured outputs reject, keeping the shape', () => {
    const schema = z.object({
      items: z.array(z.object({ score: z.number().min(0).max(1) })).max(10),
    });
    const json = JSON.stringify(toOutputSchema(schema));
    for (const key of ['$schema', 'minimum', 'maximum', 'maxItems']) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).toContain('"score"');
    expect(json).toContain('"required"');
  });
});

describe('toAnthropicParams with tools', () => {
  const base = { system: { stable: 'You are Roy.' } };

  it('declares tools strictly and leaves them out when none are offered', () => {
    const plain = toAnthropicParams(
      { ...base, messages: [{ role: 'user', content: 'hi' }] },
      'm',
      'low',
    );
    expect(plain).not.toHaveProperty('tools');

    const params = toAnthropicParams(
      {
        ...base,
        messages: [{ role: 'user', content: 'pic?' }],
        tools: [SEND_PHOTO_TOOL],
        toolChoice: 'none',
      },
      'm',
      'low',
    );
    expect(params.tools).toEqual([expect.objectContaining({ name: 'send_photo', strict: true })]);
    expect(params.tool_choice).toEqual({ type: 'none' });
  });

  it('echoes the raw assistant turn and sends tool results first', () => {
    const raw = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'toolu_1', name: 'send_photo', input: { moment: 'x', caption: '' } },
    ];
    const params = toAnthropicParams(
      {
        ...base,
        messages: [
          { role: 'user', content: 'pic?' },
          { role: 'assistant', content: '', raw },
          { role: 'user', content: '', toolResults: [{ callId: 'toolu_1', content: 'sent' }] },
        ],
      },
      'm',
      'low',
    );
    expect(params.messages[1]).toEqual({ role: 'assistant', content: raw });
    expect(params.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: 'sent',
          cache_control: { type: 'ephemeral' },
        },
      ],
    });
  });
});

describe('web access', () => {
  const base = {
    system: { stable: 'You are Roy.' },
    messages: [{ role: 'user' as const, content: 'hi' }],
  };

  it('declares web search and link reading with per-reply caps and blocked domains', () => {
    const params = toAnthropicParams(
      { ...base, web: { searches: 2, fetches: 1, blockedDomains: ['bad.example'] } },
      'm',
      'low',
    );
    expect(params.tools).toEqual([
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: 2,
        blocked_domains: ['bad.example'],
      },
      expect.objectContaining({
        type: 'web_fetch_20260209',
        name: 'web_fetch',
        max_uses: 1,
        blocked_domains: ['bad.example'],
      }),
    ]);
    const searchOnly = toAnthropicParams(
      { ...base, web: { searches: 1, fetches: 0, blockedDomains: [] } },
      'm',
      'low',
    );
    expect(searchOnly.tools?.map((tool) => ('name' in tool ? tool.name : ''))).toEqual([
      'web_search',
    ]);
  });

  it('separates text before and after a lookup into bubbles', () => {
    const content = [
      { type: 'text', text: 'lemme check' },
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
      { type: 'text', text: 'ok so' },
      { type: 'text', text: ' he did' },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(joinText(content)).toBe('lemme check\n\nok so he did');
  });

  it('resumes a paused reply and counts its lookups', async () => {
    const usage = (searches: number) => ({
      input_tokens: 1,
      output_tokens: 1,
      server_tool_use: { web_search_requests: searches, web_fetch_requests: 0 },
    });
    const turns = [
      {
        stop_reason: 'pause_turn',
        content: [
          { type: 'text', text: 'lemme check' },
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
        ],
        usage: usage(1),
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok so' }], usage: usage(1) },
    ];
    const requests: { messages: unknown[] }[] = [];
    const client = {
      beta: {
        messages: {
          stream(params: { messages: unknown[] }) {
            requests.push(params);
            const turn = turns.shift()!;
            const handlers: Record<string, ((arg: never) => void)[]> = {};
            return {
              on(event: string, fn: (arg: never) => void) {
                (handlers[event] ??= []).push(fn);
                return this;
              },
              async finalMessage() {
                for (const block of turn.content) {
                  if (block.type === 'text')
                    handlers.text?.forEach((fn) => fn(block.text as never));
                  else
                    handlers.streamEvent?.forEach((fn) =>
                      fn({ type: 'content_block_start', content_block: block } as never),
                    );
                }
                return { ...turn, model: 'm' };
              },
            };
          },
        },
      },
    } as unknown as Anthropic;
    const model = createAnthropicChatModel({ model: 'm', effort: 'low' }, client);
    let streamed = '';
    const result = await model.stream({ ...base }, (delta) => (streamed += delta));

    expect(result.text).toBe('lemme check\n\nok so');
    expect(streamed).toBe('lemme check\n\nok so');
    expect(result.webRequests).toBe(2);
    // The paused turn goes back as an assistant message, with no extra user message.
    expect(requests[1]?.messages.at(-1)).toMatchObject({ role: 'assistant' });
    expect(requests[1]?.messages).toHaveLength(2);
  });
});

describe('withHistoryCache', () => {
  it('marks the latest message so the next turn reads the conversation from cache', () => {
    const messages = withHistoryCache([
      { role: 'user', content: 'hey' },
      { role: 'assistant', content: 'yo' },
      { role: 'user', content: 'what now' },
    ]);
    expect(messages[0]).toEqual({ role: 'user', content: 'hey' });
    expect(messages[2]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'what now', cache_control: { type: 'ephemeral' } }],
    });
    const params = toAnthropicParams(
      { system: { stable: 'You are Roy.' }, messages: [{ role: 'user', content: 'hi' }] },
      'm',
      'low',
    );
    expect(JSON.stringify(params.messages)).toContain('"cache_control"');
    expect(params.max_tokens).toBeLessThanOrEqual(2000);
  });
});
