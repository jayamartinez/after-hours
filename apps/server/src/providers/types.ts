import type { z } from 'zod';

/**
 * Provider interfaces. Implementations live next to this file and are the only modules
 * allowed to import provider SDKs (AGENTS.md boundaries).
 */

export type ChatTurn =
  | {
      role: 'user';
      content: string;
      /** Results for the tool calls of the previous assistant turn. */
      toolResults?: ToolResult[];
    }
  | {
      role: 'assistant';
      content: string;
      /**
       * The provider's own record of this turn (e.g. content blocks with thinking and tool
       * calls), echoed back unchanged when continuing after a tool call.
       */
      raw?: unknown;
    };

/** A tool the model may call. `inputSchema` is JSON Schema; inputs are re-validated. */
export interface ChatTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Unvalidated model output; check it against the tool's schema before use. */
  input: unknown;
}

export interface ToolResult {
  callId: string;
  content: string;
  isError?: boolean;
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
  /** Tools the model may call this turn (allowlisted by the caller). */
  tools?: readonly ChatTool[];
  /** `none`: tools stay declared but may not be called (continuing after a call). */
  toolChoice?: 'auto' | 'none';
  /**
   * Provider-run web access (D-038): most searches and link reads in this reply, and
   * domains never read. Unset: no web access.
   */
  web?: WebAccess;
}

export interface WebAccess {
  searches: number;
  fetches: number;
  blockedDomains: readonly string[];
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
  /** Tool calls the reply ended with (`stopReason` is then `tool_use`). */
  toolCalls: ToolCall[];
  /** Web searches and link reads the provider ran for this reply. */
  webRequests?: number;
  /** This turn as the provider recorded it; pass back as `ChatTurn.raw` to continue. */
  raw: unknown;
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
