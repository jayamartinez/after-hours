import {
  ChatStreamEventSchema,
  SessionResponseSchema,
  type ChatStreamEvent,
} from '@after-hours/contracts';
import { expect } from 'vitest';

import type {
  ChatModel,
  ChatModelError,
  ChatRequest,
  StructuredModel,
  StructuredRequest,
  ToolCall,
} from './providers/types';

/** Test doubles and HTTP helpers shared by the chat route tests. */

export const USAGE = {
  inputTokens: 1,
  outputTokens: 1,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
};

/**
 * One scripted model turn: streamed chunks, optionally followed by a failure, or ending in
 * tool calls (`stopReason: 'tool_use'`).
 */
export type Turn = {
  chunks: string[];
  error?: ChatModelError;
  toolCalls?: ToolCall[];
  /** Web searches and link reads this turn reports (D-038). */
  webRequests?: number;
};

/** ChatModel double: plays scripted turns and records every request. */
export function scriptedModel() {
  const script: Turn[] = [];
  const requests: ChatRequest[] = [];
  const model: ChatModel = {
    provider: 'test',
    model: 'test-model',
    async stream(request, onText) {
      // Snapshot: callers may extend the same message list for a continuation.
      requests.push({ ...request, messages: [...request.messages] });
      const turn = script.shift() ?? { chunks: ['ok'] };
      for (const chunk of turn.chunks) onText?.(chunk);
      if (turn.error) throw turn.error;
      const toolCalls = turn.toolCalls ?? [];
      return {
        text: turn.chunks.join(''),
        stopReason: toolCalls.length ? 'tool_use' : 'end_turn',
        model: 'test-model',
        usage: USAGE,
        toolCalls,
        webRequests: turn.webRequests ?? 0,
        raw: { scripted: turn.chunks, toolCalls },
      };
    },
  };
  return { model, script, requests };
}

/** StructuredModel double: returns scripted values (validated by the request schema). */
export function scriptedStructuredModel() {
  const script: (unknown | Error)[] = [];
  const requests: StructuredRequest<unknown>[] = [];
  const model: StructuredModel = {
    provider: 'test',
    model: 'test-memory-model',
    async generate<T>(request: StructuredRequest<T>) {
      requests.push(request as StructuredRequest<unknown>);
      const next = script.shift() ?? { memories: [] };
      if (next instanceof Error) throw next;
      return { value: request.schema.parse(next), usage: USAGE };
    },
  };
  return { model, script, requests };
}

/** Minimal surface of a Hono app used by the helpers. */
interface TestApp {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export async function newSession(app: TestApp): Promise<string> {
  const res = await app.request('/session', { method: 'POST' });
  expect(res.status).toBe(201);
  return SessionResponseSchema.parse(await res.json()).token;
}

/** JSON request with the session token. */
export function call(app: TestApp, token: string, method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: { ...auth(token), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let clientCounter = 0;
export const nextClientId = () => `client-${Date.now()}-${++clientCounter}`;

export function postMessage(app: TestApp, token: string, companionId: string, text: string) {
  return call(app, token, 'POST', `/conversations/${companionId}/messages`, {
    text,
    clientId: nextClientId(),
  });
}

/** Parses an SSE body into validated events. */
export async function events(res: Response): Promise<ChatStreamEvent[]> {
  expect(res.status).toBe(200);
  const frames = (await res.text()).split(/\n\n/).filter((frame) => frame.trim());
  return frames.map((frame) =>
    ChatStreamEventSchema.parse(JSON.parse(/^data: (.+)$/m.exec(frame)?.[1] ?? '')),
  );
}
