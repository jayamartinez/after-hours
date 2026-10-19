import type { z } from 'zod';

/**
 * Provider interfaces. Implementations live next to this file and are the only modules
 * allowed to import provider SDKs (AGENTS.md boundaries).
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  /**
   * `stable` is the character prompt: byte-identical across turns so providers can cache it.
   * `context` is volatile per-turn context (memories, current time); it goes after the
   * cached part.
   */
  system: { stable: string; context?: string };
  /** Conversation history, oldest first, ending with the user's latest message. */
  messages: ChatTurn[];
  maxTokens?: number;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ChatResult {
  text: string;
  usage: ChatUsage;
  stopReason: string | null;
  /** The model that actually served the reply (may differ after a server-side fallback). */
  model: string;
}

export type ChatErrorKind = 'rate_limit' | 'connection' | 'refusal' | 'auth' | 'api';

/** Typed provider failure. `retryable` drives the "retry" action in the UI. */
export class ChatModelError extends Error {
  constructor(
    readonly kind: ChatErrorKind,
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ChatModelError';
  }
}

export interface ChatModel {
  readonly provider: string;
  readonly model: string;
  /** Streams text deltas to `onText` and resolves with the full reply. */
  stream(
    request: ChatRequest,
    onText?: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult>;
}

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  /** Validates the model's JSON; its JSON Schema also constrains generation when supported. */
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/** One-shot JSON generation with a cheap model (memory extraction, eval grading). */
export interface StructuredModel {
  readonly provider: string;
  readonly model: string;
  generate<T>(request: StructuredRequest<T>): Promise<{ value: T; usage: ChatUsage }>;
}
