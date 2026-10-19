import { describe, expect, it } from 'vitest';

import { createSseParser, toChatEvent } from './sse';

const ack = {
  type: 'ack',
  message: {
    id: 'm1',
    role: 'user',
    kind: 'text',
    content: 'hi',
    status: 'sent',
    createdAt: '2026-10-16T22:00:00.000Z',
    reactions: [],
    clientId: 'client-123',
    image: null,
  },
};

describe('createSseParser', () => {
  const stream = `event: ack\ndata: ${JSON.stringify(ack)}\n\n: keep-alive\n\nevent: typing\ndata: {"type":"typing"}\n\nevent: done\ndata: {"type":"done","userMessageId":"m1","messageIds":[]}\n\n`;

  it('parses frames regardless of chunk boundaries', () => {
    for (const size of [1, 2, 7, 64, stream.length]) {
      const parser = createSseParser();
      const frames = [];
      for (let i = 0; i < stream.length; i += size)
        frames.push(...parser.feed(stream.slice(i, i + size)));
      expect(frames.map((f) => f.event)).toEqual(['ack', 'typing', 'done']);
    }
  });

  it('handles CRLF, multi-line data, and holds an incomplete frame', () => {
    const parser = createSseParser();
    expect(parser.feed('event: x\r\ndata: a\r\ndata: b\r\n\r\nevent: y\ndata: c')).toEqual([
      { event: 'x', data: 'a\nb' },
    ]);
    expect(parser.feed('\n\n')).toEqual([{ event: 'y', data: 'c' }]);
  });
});

describe('toChatEvent', () => {
  it('validates against the contract and the frame name', () => {
    expect(toChatEvent({ event: 'ack', data: JSON.stringify(ack) })).toEqual(ack);
    expect(toChatEvent({ event: 'typing', data: JSON.stringify(ack) })).toBeNull();
    expect(toChatEvent({ event: 'ack', data: '{"type":"ack"}' })).toBeNull();
    expect(toChatEvent({ event: 'ack', data: 'not json' })).toBeNull();
  });
});
