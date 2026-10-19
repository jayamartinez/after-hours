import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SEND_PHOTO_TOOL } from '../chat/photo-tool';

import { toAnthropicParams, toOutputSchema } from './anthropic';

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
