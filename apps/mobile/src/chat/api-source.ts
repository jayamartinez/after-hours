import {
  ApiErrorSchema,
  ConversationsResponseSchema,
  MessagesResponseSchema,
  type ApiError,
  type ChatMessageDto,
  type ChatStreamEvent,
  type ConversationSummary,
  type PublicCharacter,
} from '@after-hours/contracts';

import type { CreditSignal } from '@/api/credits';

import { conversationReducer, type ConversationAction } from './reducer';
import type { ConversationSource } from './source';
import { createSseParser, toChatEvent } from './sse';
import {
  EMPTY_CONVERSATION,
  type ChatMessage,
  type ConversationState,
  type ImageRef,
} from './types';

/** The parts of a fetch Response the source uses (global fetch and expo/fetch both fit). */
export interface ApiResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  body: ReadableStream<Uint8Array> | null;
}

/** Authenticated HTTP to apps/server. Throws only when the server is unreachable. */
export interface ApiTransport {
  get(path: string): Promise<ApiResponse>;
  /** POST with a streamed (SSE) response body. */
  postStream(path: string, body: unknown): Promise<ApiResponse>;
}

/** Pacing that makes a multi-bubble reply read like someone texting. */
export interface ApiTiming {
  /** "Read" receipt and typing indicator this long after the server takes the message. */
  readDelay: number;
  /**
   * How long typing a bubble takes, with the typing indicator showing (D-039). Bubbles
   * after the first wait this long; the first waits whatever is left of it since the
   * indicator appeared, so a long opening paragraph is not instant either.
   */
  bubbleGap: (text: string) => number;
}

/** A quick texter: about 22 characters a second, never under 0.9 s or over 7 s a bubble. */
export const DEFAULT_API_TIMING: ApiTiming = {
  readDelay: 600,
  bubbleGap: (text) => Math.min(7000, Math.max(900, 500 + text.length * 45)),
};

const NETWORK_ERROR: ApiError = {
  code: 'provider',
  message: 'Not delivered. Check your connection and retry.',
  retryable: true,
};

export interface ApiSourceOptions {
  transport: ApiTransport;
  /** Used for every companion once the API turns out to be unreachable. */
  fallback: ConversationSource;
  timing?: ApiTiming;
  now?: () => number;
  timeZone?: () => string | undefined;
  /** Client idempotency key generator. */
  makeClientId?: () => string;
  /** Photo credit events from reply streams (balance after a photo, or none left). */
  onCredits?: (signal: CreditSignal) => void;
  /** A message was stored on the server (the user's on ack, the reply on done). */
  onStored?: (companionId: string) => void;
}

export interface ApiConversationSource extends ConversationSource {
  /** Last message per conversation (Chats tab); null once in demo fallback. */
  fetchSummaries(): Promise<ConversationSummary[] | null>;
  /**
   * Drops the cached thread of one companion (or all) after its history was cleared or
   * the account deleted; the next `load` fetches it again.
   */
  forget(companionId?: string): void;
}

interface Conversation {
  state: ConversationState;
  listeners: Set<() => void>;
  /** Serializes visible updates so pacing delays apply in order. */
  chain: Promise<void>;
  loading: boolean;
  /** Opener lines `start` has yet to reveal; a send shows them at once. */
  unrevealed: ChatMessage[];
}

const wait = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

function toImageRef(image: NonNullable<ChatMessageDto['image']>): ImageRef {
  return image.kind === 'web'
    ? { source: 'web', uri: image.url, pageUrl: image.pageUrl, title: image.title }
    : { source: 'placeholder', description: image.description };
}

export const fromDto = (dto: ChatMessageDto): ChatMessage => ({
  id: dto.id,
  role: dto.role,
  kind: dto.kind,
  content: dto.content,
  status: dto.status,
  createdAt: dto.createdAt,
  reactions: dto.reactions,
  clientId: dto.clientId,
  ...(dto.image ? { image: toImageRef(dto.image) } : {}),
});

function defaultClientId(): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `c-${Date.now().toString(36)}-${random}`;
}

async function readError(res: ApiResponse): Promise<ApiError> {
  try {
    const parsed = ApiErrorSchema.safeParse(await res.json());
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON.
  }
  return { code: 'provider', message: 'Something went wrong. Try again.', retryable: true };
}

/**
 * Server-backed conversations: history over HTTP, replies over SSE. Sends are optimistic
 * (`sending` → `sent` on `ack` → `read` when the reply starts); reply bubbles arrive one by
 * one with a short typing pause between them. If the API cannot be reached at all, every
 * conversation switches to `fallback` (the labeled demo source).
 */
export function createApiConversationSource(options: ApiSourceOptions): ApiConversationSource {
  const { transport, fallback } = options;
  const timing = options.timing ?? DEFAULT_API_TIMING;
  const now = options.now ?? Date.now;
  const timeZone =
    options.timeZone ??
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return undefined;
      }
    });
  const makeClientId = options.makeClientId ?? defaultClientId;
  const { onCredits, onStored } = options;
  const conversations = new Map<string, Conversation>();
  let offline = false;

  const conversation = (companionId: string): Conversation => {
    let entry = conversations.get(companionId);
    if (!entry) {
      entry = {
        state: EMPTY_CONVERSATION,
        listeners: new Set(),
        chain: Promise.resolve(),
        loading: false,
        unrevealed: [],
      };
      conversations.set(companionId, entry);
    }
    return entry;
  };

  const notify = (entry: Conversation) => entry.listeners.forEach((listener) => listener());

  const dispatch = (companionId: string, action: ConversationAction) => {
    const entry = conversation(companionId);
    const next = conversationReducer(entry.state, action);
    if (next === entry.state) return;
    entry.state = next;
    notify(entry);
  };

  /** Runs `step` after every earlier visible update of this conversation. */
  const enqueue = (companionId: string, step: () => void | Promise<void>) => {
    const entry = conversation(companionId);
    entry.chain = entry.chain.then(step).catch(() => {});
  };

  const goOffline = (error: unknown) => {
    if (offline) return;
    console.warn('[chat] API unreachable; using demo conversations.', error);
    offline = true;
    conversations.forEach(notify);
  };

  /** Types out a new thread's opener one line at a time, like the companion writing it. */
  const reveal = (companionId: string, opener: ChatMessage[]) => {
    const entry = conversation(companionId);
    entry.unrevealed = [...opener];
    dispatch(companionId, { type: 'loaded', messages: [] });
    for (const message of opener) {
      enqueue(companionId, async () => {
        if (!entry.unrevealed.includes(message)) return;
        dispatch(companionId, { type: 'typing', typing: true });
        await wait(timing.bubbleGap(message.content));
        if (!entry.unrevealed.includes(message)) return;
        entry.unrevealed = entry.unrevealed.filter((m) => m !== message);
        dispatch(companionId, { type: 'receive', message });
      });
    }
  };

  const flushReveal = (companionId: string) => {
    const entry = conversation(companionId);
    const pending = entry.unrevealed;
    entry.unrevealed = [];
    pending.forEach((message) => dispatch(companionId, { type: 'receive', message }));
  };

  /** With `animateOpener`, a thread with no user messages yet reveals its opener lines. */
  const load = (companion: PublicCharacter, animateOpener = false) => {
    if (offline) {
      return animateOpener ? fallback.start(companion) : fallback.load(companion);
    }
    const entry = conversation(companion.id);
    if (entry.state.loaded || entry.loading) return;
    entry.loading = true;
    void (async () => {
      let res: ApiResponse;
      try {
        res = await transport.get(`/conversations/${companion.id}/messages`);
      } catch (error) {
        goOffline(error);
        if (animateOpener) fallback.start(companion);
        else fallback.load(companion);
        return;
      }
      if (!res.ok) {
        dispatch(companion.id, { type: 'loaded', messages: [] });
        dispatch(companion.id, { type: 'notice', text: (await readError(res)).message });
        return;
      }
      const parsed = MessagesResponseSchema.safeParse(await res.json().catch(() => null));
      const messages = parsed.success ? parsed.data.messages.map(fromDto) : [];
      if (animateOpener && messages.every((m) => m.role === 'assistant')) {
        reveal(companion.id, messages);
      } else {
        dispatch(companion.id, { type: 'loaded', messages });
      }
      if (!parsed.success) {
        dispatch(companion.id, { type: 'notice', text: 'Could not read this chat. Try again.' });
      }
    })().finally(() => {
      entry.loading = false;
    });
  };

  /** Streams one send. `localId` is the id the message currently has in state. */
  const stream = async (
    companion: PublicCharacter,
    localId: string,
    clientId: string,
    text: string,
  ) => {
    const id = companion.id;
    let messageId = localId;
    let finished = false;
    let bubbles = 0;
    /** When the typing indicator first showed for this reply. */
    let typingSince = 0;

    const fail = (error: ApiError, notice: boolean) =>
      enqueue(id, () => {
        dispatch(id, { type: 'typing', typing: false });
        if (error.retryable) dispatch(id, { type: 'status', id: messageId, status: 'failed' });
        else dispatch(id, { type: 'readAll' });
        if (notice || !error.retryable) dispatch(id, { type: 'notice', text: error.message });
      });

    const handle = (event: ChatStreamEvent) => {
      switch (event.type) {
        case 'ack': {
          const stored = fromDto(event.message);
          const from = messageId;
          messageId = stored.id;
          enqueue(id, () => dispatch(id, { type: 'ack', localId: from, message: stored }));
          onStored?.(id);
          return;
        }
        case 'typing':
          enqueue(id, async () => {
            await wait(timing.readDelay);
            dispatch(id, { type: 'readAll' });
            dispatch(id, { type: 'typing', typing: true });
            typingSince = Date.now();
          });
          return;
        case 'delta':
          return;
        case 'bubble': {
          const message = fromDto(event.message);
          const first = bubbles === 0;
          bubbles += 1;
          enqueue(id, async () => {
            if (first) {
              const typed = typingSince ? Date.now() - typingSince : 0;
              await wait(timing.bubbleGap(message.content) - typed);
            } else {
              dispatch(id, { type: 'typing', typing: true });
              await wait(timing.bubbleGap(message.content));
            }
            dispatch(id, { type: 'readAll' });
            dispatch(id, { type: 'receive', message });
          });
          return;
        }
        case 'done':
          finished = true;
          enqueue(id, () => {
            dispatch(id, { type: 'typing', typing: false });
            onCredits?.({ type: 'message_sent', companionId: id });
            onStored?.(id);
          });
          return;
        case 'error':
          finished = true;
          fail(event.error, true);
          return;
        case 'credits':
        case 'credits_required':
          // In step with the paced bubbles: the balance drops once the photo shows.
          enqueue(id, () =>
            onCredits?.(
              event.type === 'credits'
                ? { type: 'credits', balance: event.balance, companionId: id }
                : { type: 'credits_required', companionId: id },
            ),
          );
          return;
      }
    };

    try {
      const res = await transport.postStream(`/conversations/${id}/messages`, {
        text,
        clientId,
        timeZone: timeZone(),
      });
      if (!res.ok) {
        const error = await readError(res);
        if (error.code === 'messages_required') {
          // Kept as undelivered (retry once there are messages); the chat offers more.
          fail(error, false);
          onCredits?.({ type: 'messages_required', companionId: id });
          return;
        }
        if (error.code === 'message_too_long') {
          // Shown as not delivered (never as read), with the limit in the notice.
          fail({ ...error, retryable: true }, true);
          return;
        }
        fail(error, true);
        return;
      }
      if (!res.body) throw new Error('response has no body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of parser.feed(decoder.decode(value, { stream: true }))) {
          const event = toChatEvent(frame);
          if (event) handle(event);
        }
      }
      if (!finished) fail(NETWORK_ERROR, false);
    } catch {
      if (!finished) fail(NETWORK_ERROR, false);
    }
  };

  return {
    get isDemo() {
      return offline;
    },

    getSnapshot(companionId) {
      if (offline) return fallback.getSnapshot(companionId);
      return conversations.get(companionId)?.state ?? EMPTY_CONVERSATION;
    },

    subscribe(companionId, listener) {
      const { listeners } = conversation(companionId);
      listeners.add(listener);
      const unsubscribeFallback = fallback.subscribe(companionId, listener);
      return () => {
        listeners.delete(listener);
        unsubscribeFallback();
      };
    },

    load: (companion) => load(companion),

    start: (companion) => load(companion, true),

    send(companion, text) {
      if (offline) return fallback.send(companion, text);
      const content = text.trim();
      if (!content) return;
      flushReveal(companion.id);
      const clientId = makeClientId();
      dispatch(companion.id, {
        type: 'send',
        message: {
          id: clientId,
          clientId,
          role: 'user',
          kind: 'text',
          content,
          status: 'sending',
          createdAt: new Date(now()).toISOString(),
          reactions: [],
        },
      });
      void stream(companion, clientId, clientId, content);
    },

    retry(companion, messageId) {
      if (offline) return fallback.retry(companion, messageId);
      const message = conversation(companion.id).state.messages.find((m) => m.id === messageId);
      if (!message || message.role !== 'user' || message.status !== 'failed') return;
      dispatch(companion.id, { type: 'status', id: messageId, status: 'sending' });
      void stream(companion, messageId, message.clientId ?? messageId, message.content);
    },

    toggleReaction(companionId, messageId, reaction) {
      if (offline) return fallback.toggleReaction(companionId, messageId, reaction);
      // Local only for now; reactions are not persisted yet.
      dispatch(companionId, { type: 'toggleReaction', id: messageId, reaction });
    },

    async fetchSummaries() {
      if (offline) return null;
      try {
        const res = await transport.get('/conversations');
        if (!res.ok) return [];
        const parsed = ConversationsResponseSchema.safeParse(await res.json());
        return parsed.success ? parsed.data.conversations : [];
      } catch (error) {
        goOffline(error);
        return null;
      }
    },

    forget(companionId) {
      const ids = companionId ? [companionId] : [...conversations.keys()];
      for (const id of ids) {
        const entry = conversations.get(id);
        if (!entry) continue;
        entry.state = EMPTY_CONVERSATION;
        entry.unrevealed = [];
        entry.loading = false;
        notify(entry);
      }
    },
  };
}
