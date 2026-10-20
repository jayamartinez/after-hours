import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SEND_PHOTO_TOOL } from '../chat/photo-tool';
import { streamReply } from '../chat/reply';

import type Anthropic from '@anthropic-ai/sdk';

import { createAnthropicChatModel, joinText, toAnthropicParams, toOutputSchema } from './anthropic';

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
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'sent' }],
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

  type FakeTurn = { stop_reason: string; content: Record<string, unknown>[]; usage: unknown };
  const usage = (searches: number, fetches = 0) => ({
    input_tokens: 1,
    output_tokens: 1,
    server_tool_use: { web_search_requests: searches, web_fetch_requests: fetches },
  });
  /** Plays `turns` as streamed messages and records every request. */
  function fakeClient(turns: FakeTurn[]) {
    const requests: {
      messages: unknown[];
      tools?: { name: string; max_uses?: number }[];
      tool_choice?: unknown;
    }[] = [];
    const client = {
      beta: {
        messages: {
          stream(params: (typeof requests)[number]) {
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
    return { client, requests };
  }
  const web = { searches: 2, fetches: 2, blockedDomains: [] };

  it('resumes a paused reply and counts its lookups', async () => {
    const { client, requests } = fakeClient([
      {
        stop_reason: 'pause_turn',
        content: [
          { type: 'text', text: 'lemme check' },
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
        ],
        usage: usage(1),
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok so' }], usage: usage(1) },
    ]);
    const model = createAnthropicChatModel({ model: 'm', effort: 'low' }, client);
    let streamed = '';
    const result = await model.stream({ ...base, web }, (delta) => (streamed += delta));

    expect(result.text).toBe('lemme check\n\nok so');
    expect(streamed).toBe('lemme check\n\nok so');
    expect(result.webRequests).toBe(2);
    expect(result.webUsed).toEqual({ searches: 2, fetches: 0 });
    // The paused turn goes back as an assistant message, with no extra user message.
    expect(requests[1]?.messages.at(-1)).toMatchObject({ role: 'assistant' });
    expect(requests[1]?.messages).toHaveLength(2);
  });

  it('resumes with byte-identical tools while lookups are left', async () => {
    const { client, requests } = fakeClient([
      {
        stop_reason: 'pause_turn',
        content: [
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
          { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
          { type: 'server_tool_use', id: 'f1', name: 'web_fetch', input: {} },
          { type: 'web_fetch_tool_result', tool_use_id: 'f1', content: {} },
        ],
        usage: usage(1, 1),
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'found it' }], usage: usage(0) },
    ]);
    const model = createAnthropicChatModel({ model: 'm', effort: 'low' }, client);
    const result = await model.stream({ ...base, web });

    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]?.tools)).toBe(JSON.stringify(requests[0]?.tools));
    expect(result.webUsed).toEqual({ searches: 1, fetches: 1 });
  });

  it('does not resume once the reply has used up a lookup allowance', async () => {
    const paused = (searches: number) => ({
      stop_reason: 'pause_turn',
      content: [
        { type: 'text', text: 'one sec' },
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
      ],
      usage: usage(searches),
    });
    const spent = fakeClient([paused(2)]);
    const result = await createAnthropicChatModel(
      { model: 'm', effort: 'low' },
      spent.client,
    ).stream({ ...base, web });
    expect(spent.requests).toHaveLength(1);
    expect(result.text).toBe('one sec');
    expect(result.stopReason).toBe('pause_turn');

    // Lookups from earlier requests of the same reply count too.
    const earlier = fakeClient([paused(1)]);
    await createAnthropicChatModel({ model: 'm', effort: 'low' }, earlier.client).stream({
      ...base,
      web,
      webUsedBefore: { searches: 1, fetches: 0 },
    });
    expect(earlier.requests).toHaveLength(1);
  });

  it('sends byte-identical tools on every request of a multi-round reply', async () => {
    const { client, requests } = fakeClient([
      {
        stop_reason: 'pause_turn',
        content: [
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
          { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
        ],
        usage: usage(1),
      },
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't1', name: 'share_image', input: {} }],
        usage: usage(1),
      },
      {
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't2', name: 'share_image', input: {} }],
        usage: usage(0),
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'there' }], usage: usage(0) },
    ]);
    const model = createAnthropicChatModel({ model: 'm', effort: 'low' }, client);
    const tool = {
      name: 'share_image',
      description: 'd',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    };
    await streamReply(
      model,
      { ...base, tools: [tool], web: { ...web, blockedDomains: ['bad.example'] } },
      {
        onBubble: async () => {},
        onToolCalls: async (calls) => calls.map((c) => ({ callId: c.id, content: 'ok' })),
      },
    );

    expect(requests).toHaveLength(4);
    const tools = requests.map((request) => JSON.stringify(request.tools));
    expect(new Set(tools).size).toBe(1);
    // Tool rounds stay open until the last (picture retries); only the last is closed.
    expect(requests.map((request) => request.tool_choice)).toEqual([
      { type: 'auto' },
      { type: 'auto' },
      { type: 'auto' },
      { type: 'none' },
    ]);
  });
});
