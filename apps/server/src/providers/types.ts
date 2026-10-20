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
   * `context` is volatile per-turn context (memories, current time); providers place it
   * after the cached conversation, so it never invalidates the cached prefix.
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
   * domains never read. Unset: no web access. Every request of one reply must pass the
   * same value: the declared tools are part of the conversation that thinking blocks are
   * bound to, so they cannot change mid-reply.
   */
  web?: WebAccess;
  /** Web lookups earlier requests of this reply already ran (counts against `web`). */
  webUsedBefore?: WebUsage;
}

export interface WebAccess {
  searches: number;
  fetches: number;
  blockedDomains: readonly string[];
}

export interface WebUsage {
  searches: number;
  fetches: number;
}

/** True once `used` reaches the cap of any web tool `web` offers: no new lookups may start. */
export function webAllowanceUsedUp(web: WebAccess | undefined, used: WebUsage): boolean {
  if (!web) return false;
  return (
    (web.searches > 0 && used.searches >= web.searches) ||
    (web.fetches > 0 && used.fetches >= web.fetches)
  );
}

/** `a` plus `b`, tool by tool. */
export function addWebUsage(a: WebUsage | undefined, b: WebUsage | undefined): WebUsage {
  return {
    searches: (a?.searches ?? 0) + (b?.searches ?? 0),
    fetches: (a?.fetches ?? 0) + (b?.fetches ?? 0),
  };
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/** One billed provider request: the model that served it, its tokens, and its lookups. */
export interface BilledRequest {
  model: string;
  usage: ChatUsage;
  /** Web searches and link reads the provider ran in this request. */
  webRequests: number;
}

export interface ChatResult {
  text: string;
  /** Summed over every request of the reply. */
  usage: ChatUsage;
  stopReason: string | null;
  /** The model that actually served the reply (may differ after a server-side fallback). */
  model: string;
  /** Tool calls the reply ended with (`stopReason` is then `tool_use`). */
  toolCalls: ToolCall[];
  /** Web searches and link reads the provider ran for this reply. */
  webRequests?: number;
  /** The same, by tool: what a continuation subtracts from `ChatRequest.web`. */
  webUsed?: WebUsage;
  /** Every request this reply was billed for, each priced at its own model (D-041). */
  billed: BilledRequest[];
  /** This turn as the provider recorded it; pass back as `ChatTurn.raw` to continue. */
  raw: unknown;
}

export type ChatErrorKind = 'rate_limit' | 'connection' | 'refusal' | 'auth' | 'api';

/**
 * Typed provider failure. `retryable` drives the "retry" action in the UI. `billed` lists
 * the requests that were charged before the failure (a refusal after output, a stream that
 * broke mid-reply), so their cost still counts.
 */
export class ChatModelError extends Error {
  readonly billed: readonly BilledRequest[];

  constructor(
    readonly kind: ChatErrorKind,
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown; billed?: readonly BilledRequest[] },
  ) {
    super(message, options);
    this.name = 'ChatModelError';
    this.billed = options?.billed ?? [];
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
