import { presets } from '@after-hours/companions';
import type { Memory } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import type Anthropic from '@anthropic-ai/sdk';

import { toAnthropicParams, TURN_CONTEXT_HEADER } from '../providers/anthropic';
import type { ChatTurn } from '../providers/types';

import { relativeAge, selectMemories } from './context';
import { buildChatRequest, HISTORY_WINDOW } from './request';
import { buildSystemPrompt } from './prompt';

const [roy, roya] = presets;
if (!roy || !roya) throw new Error('expected Roy and Roya presets');

const NOW = new Date('2026-10-16T19:30:00Z');
const memory = (companionId: string, content: string, daysAgo: number, pinned = false): Memory => ({
  id: `${companionId}-${content}`,
  companionId,
  content,
  category: 'fact',
  createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  pinned,
});

const MEMORIES = [
  memory('roy', 'Has a job interview on Thursday', 6),
  memory('roy', 'Hates cilantro', 30),
  memory('roya', 'Is learning to play the cello', 2, true),
];

describe('buildChatRequest', () => {
  it('puts the character prompt in the stable block and memories plus time in the context block', () => {
    const request = buildChatRequest(roy, {
      history: [{ role: 'user', content: 'hey' }],
      memories: MEMORIES,
      now: NOW,
      timeZone: 'America/New_York',
    });
    expect(request.system.stable).toBe(buildSystemPrompt(roy));
    expect(request.system.context).toContain(
      'For the user it is Friday, October 16 at 3:30 PM. Background only',
    );
    expect(request.system.context).toContain(
      '- Has a job interview on Thursday (told you 6 days ago)',
    );
    expect(request.system.context).toContain('- Hates cilantro (told you 4 weeks ago)');
  });

  it("never includes the other companion's memories", () => {
    const forRoy = buildChatRequest(roy, { history: [], memories: MEMORIES, now: NOW });
    const forRoya = buildChatRequest(roya, { history: [], memories: MEMORIES, now: NOW });
    expect(JSON.stringify(forRoy)).not.toContain('cello');
    expect(JSON.stringify(forRoya)).not.toContain('interview');
    expect(JSON.stringify(forRoya)).toContain('cello');
  });

  it('omits the memory section when the companion has none or memory is disabled', () => {
    const none = buildChatRequest(roy, { history: [], memories: [], now: NOW });
    expect(none.system.context).not.toContain('What they have told you before');
    const disabled = { ...roy, memory: { ...roy.memory, enabled: false } };
    expect(
      buildChatRequest(disabled, { history: [], memories: MEMORIES }).system.context,
    ).not.toContain('interview');
  });

  it('starts with a user turn even when the thread begins with a companion line', () => {
    const request = buildChatRequest(roy, {
      history: [
        { role: 'assistant', content: 'a line from before' },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(request.messages[0]?.role).toBe('user');
    expect(request.messages[1]).toEqual({ role: 'assistant', content: 'a line from before' });
  });

  it('caps history to the recent window', () => {
    const history = Array.from({ length: HISTORY_WINDOW + 10 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `m${i}`,
    }));
    const request = buildChatRequest(roy, { history });
    expect(request.messages.at(-1)?.content).toBe(`m${HISTORY_WINDOW + 9}`);
    expect(request.messages.some((m) => m.content === 'm0')).toBe(false);
  });

  it('reaches the Anthropic request: cached character prompt, context after the history, effort set', () => {
    const request = buildChatRequest(roya, {
      history: [{ role: 'user', content: 'hi' }],
      memories: MEMORIES,
      now: NOW,
    });
    const params = toAnthropicParams(request, 'claude-opus-5-5', 'low');
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.output_config).toEqual({ effort: 'low' });
    expect(params.system).toEqual([
      { type: 'text', text: buildSystemPrompt(roya), cache_control: { type: 'ephemeral' } },
    ]);
    // The latest message is the history cache breakpoint (D-041); the per-turn context is
    // a later block of the same user message, outside the cached prefix.
    expect(params.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `${TURN_CONTEXT_HEADER}\n${request.system.context}` },
        ],
      },
    ]);
    expect(JSON.stringify(params.system)).toContain(
      JSON.stringify(roya.persona.personality.modes.sincere).slice(1, -1),
    );
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('temperature');
  });
});

describe('memory selection', () => {
  it('orders pinned first, then newest, and caps at maxRetrieved', () => {
    const many = [
      ...Array.from({ length: 12 }, (_, i) => memory('roy', `fact ${i}`, i + 1)),
      memory('roy', 'pinned old fact', 300, true),
    ];
    const selected = selectMemories({ ...roy, memory: { ...roy.memory, maxRetrieved: 3 } }, many);
    expect(selected.map((m) => m.content)).toEqual(['pinned old fact', 'fact 0', 'fact 1']);
  });

  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [3, '3 days ago'],
    [9, 'last week'],
    [30, '4 weeks ago'],
    [90, '3 months ago'],
    [400, 'over a year ago'],
  ])('%i days ago renders as "%s"', (days, expected) => {
    const createdAt = new Date(NOW.getTime() - days * 86_400_000).toISOString();
    expect(relativeAge(createdAt, NOW)).toBe(expected);
  });
});

describe('prompt caching across turns', () => {
  const history: ChatTurn[] = [
    { role: 'user', content: 'hey' },
    { role: 'assistant', content: 'yo' },
    { role: 'user', content: 'what are you up to' },
  ];
  const paramsFor = (turns: ChatTurn[], now: Date, memories: readonly Memory[] = MEMORIES) =>
    toAnthropicParams(
      buildChatRequest(roy, { history: turns, memories, now, userMessages: 2 }),
      'claude-opus-5-5',
      'low',
    );
  /** Every content block in request order, with its role. */
  const blocksOf = (messages: Anthropic.Beta.BetaMessageParam[]) =>
    messages.flatMap((message) =>
      typeof message.content === 'string'
        ? [{ role: message.role, block: { type: 'text', text: message.content } as object }]
        : message.content.map((block) => ({ role: message.role, block: block as object })),
    );
  /** The serialized request up to and including the history cache breakpoint. */
  const cachedPrefix = (params: ReturnType<typeof paramsFor>) => {
    const blocks = blocksOf(params.messages);
    const breakpoint = blocks.findLastIndex(({ block }) => 'cache_control' in block);
    return JSON.stringify({ system: params.system, blocks: blocks.slice(0, breakpoint + 1) });
  };
  /** Rendered content only: cache markers do not change what the model reads. */
  const unmarked = (value: unknown) =>
    JSON.stringify(value).replaceAll(',"cache_control":{"type":"ephemeral"}', '');

  it('keeps the prefix byte-identical when only the time or the memories change', () => {
    const later = new Date(NOW.getTime() + 60_000);
    const first = cachedPrefix(paramsFor(history, NOW));
    expect(cachedPrefix(paramsFor(history, later))).toBe(first);
    expect(
      cachedPrefix(paramsFor(history, later, [...MEMORIES, memory('roy', 'Got the job', 0)])),
    ).toBe(first);
    expect(first).not.toContain('# Right now');
    expect(first).not.toContain(TURN_CONTEXT_HEADER);
  });

  it('puts the context after the cache-marked block of the answered user message', () => {
    const params = paramsFor(history, NOW);
    const last = params.messages.at(-1);
    if (!last || typeof last.content === 'string') throw new Error('expected content blocks');
    expect(last.role).toBe('user');
    expect(last.content).toEqual([
      { type: 'text', text: 'what are you up to', cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: expect.stringMatching(
          /^\[Context for this reply, from the app, not the user\]\n# Right now/,
        ),
      },
    ]);
  });

  it('sends the previous user message without its context next turn, so the cached prefix matches', () => {
    const turn = paramsFor(history, NOW);
    const next = paramsFor(
      [...history, { role: 'assistant', content: 'not much' }, { role: 'user', content: 'cool' }],
      new Date(NOW.getTime() + 120_000),
    );
    const previous = JSON.parse(cachedPrefix(turn)) as { blocks: unknown[] };
    const nextBlocks = blocksOf(next.messages).slice(0, previous.blocks.length);
    expect(unmarked(nextBlocks)).toBe(unmarked(previous.blocks));
    expect(JSON.stringify(next.messages.slice(0, -1))).not.toContain(TURN_CONTEXT_HEADER);
  });

  it('only appends through tool rounds: the context stays in the answered user message', () => {
    const request = buildChatRequest(roy, { history, now: NOW });
    const round1 = toAnthropicParams(request, 'claude-opus-5-5', 'low');
    const round2 = toAnthropicParams(
      {
        ...request,
        messages: [
          ...request.messages,
          { role: 'assistant', content: '', raw: [{ type: 'text', text: 'sec' }] },
          { role: 'user', content: '', toolResults: [{ callId: 't1', content: 'sent' }] },
        ],
      },
      'claude-opus-5-5',
      'low',
    );
    expect(round2.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ]);
    expect(unmarked(round2.messages.slice(0, round1.messages.length))).toBe(
      unmarked(round1.messages),
    );
    expect(JSON.stringify(round2.messages.at(-1))).toContain('"cache_control"');
    expect(JSON.stringify(round2.messages[2])).toContain(TURN_CONTEXT_HEADER);
    expect(JSON.stringify(round2.messages[2])).not.toContain('"cache_control"');
  });
});
