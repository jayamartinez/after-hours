import { presets } from '@after-hours/companions';
import type { Memory } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import { toAnthropicParams } from '../providers/anthropic';

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

  it('reaches the Anthropic request: cached character prompt, context after it, effort set', () => {
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
      { type: 'text', text: request.system.context },
    ]);
    expect(params.messages).toEqual([{ role: 'user', content: 'hi' }]);
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
