import { presets, toPublicCharacter } from '@after-hours/companions';
import type { ChatMessageDto, ChatStreamEvent } from '@after-hours/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CreditSignal } from '@/api/credits';

import { createApiConversationSource, type ApiResponse, type ApiTransport } from './api-source';
import { createDemoConversationSource } from './demo-source';

const roy = toPublicCharacter(presets[0]!);

const dto = (fields: Partial<ChatMessageDto>): ChatMessageDto => ({
  id: 'id',
  role: 'assistant',
  kind: 'text',
  content: '',
  status: 'sent',
  createdAt: '2026-10-16T22:00:00.000Z',
  reactions: [],
  clientId: null,
  image: null,
  ...fields,
});

function json(body: unknown, status = 200): ApiResponse {
  return { ok: status < 400, status, json: async () => body, body: null };
}

function sse(events: ChatStreamEvent[]): ApiResponse {
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    json: async () => null,
    // Split mid-frame to exercise the parser.
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 37));
        controller.enqueue(bytes.slice(37));
        controller.close();
      },
    }),
  };
}

function setup(transport: Partial<ApiTransport>, onCredits?: (signal: CreditSignal) => void) {
  const source = createApiConversationSource({
    transport: {
      get: async () => json({ companionId: 'roy', messages: [] }),
      postStream: async () => json({}, 500),
      ...transport,
    },
    fallback: createDemoConversationSource({
      timing: { sent: 0, read: 0, typingStart: 0, typingBase: 0, typingPerChar: 0, typingMax: 0 },
    }),
    timing: { readDelay: 0, bubbleGap: () => 0 },
    makeClientId: () => 'client-1',
    timeZone: () => 'UTC',
    onCredits,
  });
  /** Lets queued fetches, stream reads, and zero-delay pacing steps run. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  return { source, settle };
}

describe('createApiConversationSource', () => {
  it('loads history, then streams a reply bubble by bubble', async () => {
    const posted: unknown[] = [];
    const { source, settle } = setup({
      get: async () =>
        json({ companionId: 'roy', messages: [dto({ id: 'o1', content: 'opener' })] }),
      postStream: async (_path, body) => {
        posted.push(body);
        return sse([
          {
            type: 'ack',
            message: dto({ id: 'u1', role: 'user', content: 'hi', clientId: 'client-1' }),
          },
          { type: 'typing' },
          { type: 'delta', text: 'hey' },
          { type: 'bubble', message: dto({ id: 'b1', content: 'hey' }) },
          { type: 'bubble', message: dto({ id: 'b2', content: 'you' }) },
          { type: 'done', userMessageId: 'u1', messageIds: ['b1', 'b2'] },
        ]);
      },
    });
    source.load(roy);
    await settle();
    expect(source.getSnapshot('roy').messages.map((m) => m.content)).toEqual(['opener']);

    source.send(roy, '  hi ');
    expect(source.getSnapshot('roy').messages.at(-1)).toMatchObject({
      id: 'client-1',
      status: 'sending',
    });
    await settle();
    const state = source.getSnapshot('roy');
    expect(posted).toEqual([{ text: 'hi', clientId: 'client-1', timeZone: 'UTC' }]);
    expect(state.messages.map((m) => [m.id, m.content, m.status])).toEqual([
      ['o1', 'opener', 'sent'],
      ['u1', 'hi', 'read'],
      ['b1', 'hey', 'sent'],
      ['b2', 'you', 'sent'],
    ]);
    expect(state.typing).toBe(false);
    expect(source.isDemo).toBe(false);
  });

  it('shows a photo as a labeled placeholder and reports credits after it', async () => {
    const signals: CreditSignal[] = [];
    const { source, settle } = setup(
      {
        postStream: async () =>
          sse([
            { type: 'ack', message: dto({ id: 'u1', role: 'user', content: 'pic?' }) },
            { type: 'typing' },
            {
              type: 'bubble',
              message: dto({
                id: 'p1',
                kind: 'image',
                content: 'desk',
                image: { kind: 'placeholder', description: 'desk lamp, late' },
              }),
            },
            { type: 'credits', balance: 2 },
            { type: 'credits_required' },
            { type: 'done', userMessageId: 'u1', messageIds: ['p1'] },
          ]),
      },
      (signal) => signals.push(signal),
    );
    source.load(roy);
    await settle();
    source.send(roy, 'pic?');
    await settle();
    expect(source.getSnapshot('roy').messages.at(-1)).toMatchObject({
      kind: 'image',
      content: 'desk',
      image: { source: 'placeholder', description: 'desk lamp, late' },
    });
    expect(signals).toEqual([
      { type: 'credits', balance: 2, companionId: 'roy' },
      { type: 'credits_required', companionId: 'roy' },
      { type: 'message_sent', companionId: 'roy' },
    ]);
  });

  it('out of messages: keeps the message as undelivered and asks for more', async () => {
    const signals: CreditSignal[] = [];
    const { source, settle } = setup(
      {
        postStream: async () =>
          json({ code: 'messages_required', message: 'Out of messages.', retryable: true }, 402),
      },
      (signal) => signals.push(signal),
    );
    source.load(roy);
    await settle();
    source.send(roy, 'one more');
    await settle();
    const state = source.getSnapshot('roy');
    expect(state.messages.at(-1)).toMatchObject({ role: 'user', status: 'failed' });
    // No toast: the "More messages" sheet explains it.
    expect(state.notice).toBeNull();
    expect(signals).toEqual([{ type: 'messages_required', companionId: 'roy' }]);
  });

  it('marks a send failed on a retryable error and retries with the same clientId', async () => {
    const bodies: unknown[] = [];
    let attempt = 0;
    const { source, settle } = setup({
      postStream: async (_path, body) => {
        bodies.push(body);
        attempt += 1;
        if (attempt === 1) {
          return sse([
            {
              type: 'ack',
              message: dto({ id: 'u1', role: 'user', content: 'yo', clientId: 'client-1' }),
            },
            { type: 'typing' },
            {
              type: 'error',
              error: { code: 'provider', message: 'Roy can’t reply', retryable: true },
            },
          ]);
        }
        return sse([
          {
            type: 'ack',
            message: dto({ id: 'u1', role: 'user', content: 'yo', clientId: 'client-1' }),
          },
          { type: 'bubble', message: dto({ id: 'b1', content: 'back' }) },
          { type: 'done', userMessageId: 'u1', messageIds: ['b1'] },
        ]);
      },
    });
    source.load(roy);
    await settle();
    source.send(roy, 'yo');
    await settle();
    expect(source.getSnapshot('roy').messages.at(-1)).toMatchObject({ id: 'u1', status: 'failed' });
    expect(source.getSnapshot('roy').notice?.text).toBe('Roy can’t reply');

    source.retry(roy, 'u1');
    expect(source.getSnapshot('roy').messages.at(-1)?.status).toBe('sending');
    await settle();
    expect(bodies.map((b) => (b as { clientId: string }).clientId)).toEqual([
      'client-1',
      'client-1',
    ]);
    expect(source.getSnapshot('roy').messages.map((m) => [m.id, m.status])).toEqual([
      ['u1', 'read'],
      ['b1', 'sent'],
    ]);
  });

  it('a dropped connection leaves the message failed', async () => {
    const { source, settle } = setup({
      postStream: async () => {
        throw new TypeError('Network request failed');
      },
    });
    source.load(roy);
    await settle();
    source.send(roy, 'hello');
    await settle();
    expect(source.getSnapshot('roy').messages.at(-1)).toMatchObject({ status: 'failed' });
    expect(source.isDemo).toBe(false);
  });

  it('falls back to labeled demo conversations when the API is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { source, settle } = setup({
      get: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const listener = vi.fn();
    source.subscribe('roy', listener);
    source.load(roy);
    await settle();
    expect(source.isDemo).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(source.getSnapshot('roy').messages.length).toBeGreaterThan(0);
    expect(await source.fetchSummaries()).toBeNull();
    warn.mockRestore();
  });

  it('start reveals the opener of a new thread; a thread with replies loads as is', async () => {
    const opener = [dto({ id: 'o1', content: 'one' }), dto({ id: 'o2', content: 'two' })];
    const fresh = setup({ get: async () => json({ companionId: 'roy', messages: opener }) });
    const seen: number[] = [];
    fresh.source.subscribe('roy', () => seen.push(fresh.source.getSnapshot('roy').messages.length));
    fresh.source.start(roy);
    await fresh.settle();
    expect(fresh.source.getSnapshot('roy').messages.map((m) => m.id)).toEqual(['o1', 'o2']);
    expect(seen).toContain(1);

    const history = [...opener, dto({ id: 'u1', role: 'user', content: 'hi' })];
    const old = setup({ get: async () => json({ companionId: 'roy', messages: history }) });
    const counts: number[] = [];
    old.source.subscribe('roy', () => counts.push(old.source.getSnapshot('roy').messages.length));
    old.source.start(roy);
    await old.settle();
    expect(counts[0]).toBe(3);
  });

  it('a send during the opener shows the remaining lines first', async () => {
    const opener = [dto({ id: 'o1', content: 'one' }), dto({ id: 'o2', content: 'two' })];
    const source = createApiConversationSource({
      transport: {
        get: async () => json({ companionId: 'roy', messages: opener }),
        postStream: async () => json({}, 500),
      },
      fallback: createDemoConversationSource(),
      timing: { readDelay: 0, bubbleGap: () => 50 },
      makeClientId: () => 'client-1',
    });
    source.start(roy);
    await new Promise((resolve) => setTimeout(resolve, 10));
    source.send(roy, 'hey');
    expect(source.getSnapshot('roy').messages.map((m) => m.id)).toEqual(['o1', 'o2', 'client-1']);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(source.getSnapshot('roy').messages.filter((m) => m.id === 'o2')).toHaveLength(1);
  });
});
