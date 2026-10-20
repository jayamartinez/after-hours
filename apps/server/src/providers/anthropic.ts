import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { addUsage } from '../chat/costs';
import type { ChatConfig } from '../config';

import {
  ChatModelError,
  type BilledRequest,
  type ChatModel,
  type ChatRequest,
  type ChatResult,
  type ChatTurn,
  type ChatUsage,
  type StructuredModel,
} from './types';

/**
 * Texting replies are short. The cap bounds what one reply can cost (D-041) while leaving
 * room for low-effort thinking, so a normal reply is never cut off.
 */
const DEFAULT_MAX_TOKENS = 2000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
/** A reply that pauses mid server-side lookup is resumed at most this many times. */
const MAX_CONTINUATIONS = 3;
/** Longest page text a link read hands the model. */
const MAX_FETCH_TOKENS = 6000;

/**
 * One turn as a Messages API message. An assistant turn that ended in a tool call is
 * echoed back as its original content blocks (thinking included, unchanged), and tool
 * results go first in the next user turn.
 */
function toMessageParam(turn: ChatTurn): Anthropic.Beta.BetaMessageParam {
  if (turn.role === 'assistant') {
    return {
      role: 'assistant',
      content: turn.raw ? (turn.raw as Anthropic.Beta.BetaContentBlockParam[]) : turn.content,
    };
  }
  if (!turn.toolResults?.length) return { role: 'user', content: turn.content };
  const content: Anthropic.Beta.BetaContentBlockParam[] = turn.toolResults.map((result) => ({
    type: 'tool_result',
    tool_use_id: result.callId,
    content: result.content,
    ...(result.isError ? { is_error: true } : {}),
  }));
  if (turn.content) content.push({ type: 'text', text: turn.content });
  return { role: 'user', content };
}

/** Reply text; text blocks separated by a tool block become separate bubbles. */
export function joinText(content: readonly Anthropic.Beta.BetaContentBlock[]): string {
  let text = '';
  let afterTool = false;
  for (const block of content) {
    if (block.type !== 'text') {
      afterTool = true;
      continue;
    }
    text += (afterTool && text ? '\n\n' : '') + block.text;
    afterTool = false;
  }
  return text;
}

/**
 * Marks the latest message as a cache breakpoint (D-041), so the next turn reads the whole
 * conversation so far from the cache instead of paying full price for it again. The
 * character prompt is the other breakpoint.
 */
export function withHistoryCache(
  messages: Anthropic.Beta.BetaMessageParam[],
): Anthropic.Beta.BetaMessageParam[] {
  const last = messages.at(-1);
  if (!last) return messages;
  const blocks: Anthropic.Beta.BetaContentBlockParam[] =
    typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content];
  const tail = blocks.at(-1);
  if (!tail || tail.type === 'thinking' || tail.type === 'redacted_thinking') return messages;
  blocks[blocks.length - 1] = { ...tail, cache_control: { type: 'ephemeral' } } as typeof tail;
  return [...messages.slice(0, -1), { ...last, content: blocks }];
}

/**
 * Places the volatile per-turn context (time, memories, relationship stage) as a
 * mid-conversation system message right after the user turn being answered, the last user
 * turn that is not tool results. It sits after the history breakpoint of that turn, so a
 * new minute or memory never invalidates the cached conversation; within a reply (tool
 * rounds, pause continuations) it stays in place, so requests only ever append.
 */
export function withTurnContext(
  messages: Anthropic.Beta.BetaMessageParam[],
  turns: readonly ChatTurn[],
  context: string | undefined,
): Anthropic.Beta.BetaMessageParam[] {
  if (!context) return messages;
  const at = turns.findLastIndex((turn) => turn.role === 'user' && !turn.toolResults?.length);
  if (at < 0) return messages;
  return [
    ...messages.slice(0, at + 1),
    { role: 'system', content: context },
    ...messages.slice(at + 1),
  ];
}

/** Builds the Messages API params for one chat turn (exported for tests). */
export function toAnthropicParams(
  request: ChatRequest,
  model: string,
  effort: ChatConfig['effort'],
): Anthropic.Beta.MessageCreateParamsStreaming {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: request.system.stable, cache_control: { type: 'ephemeral' } },
  ];
  const declared: Anthropic.Beta.BetaToolUnion[] = (request.tools ?? []).map((tool) => ({
    // Strict: inputs always match the schema (they are tiny, so no eager streaming).
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    strict: true,
  }));
  const { web } = request;
  if (web && web.searches > 0) {
    declared.push({
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: web.searches,
      blocked_domains: [...web.blockedDomains],
    });
  }
  if (web && web.fetches > 0) {
    declared.push({
      type: 'web_fetch_20260209',
      name: 'web_fetch',
      max_uses: web.fetches,
      blocked_domains: [...web.blockedDomains],
      max_content_tokens: MAX_FETCH_TOKENS,
    });
  }
  const tools = declared.length
    ? { tools: declared, tool_choice: { type: request.toolChoice ?? 'auto' } as const }
    : {};
  return {
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system,
    messages: withTurnContext(
      withHistoryCache(request.messages.map(toMessageParam)),
      request.messages,
      request.system.context,
    ),
    ...tools,
    output_config: { effort },
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    stream: true,
  };
}

function toChatError(error: unknown): ChatModelError {
  if (error instanceof ChatModelError) return error;
  if (error instanceof Anthropic.RateLimitError) {
    return new ChatModelError('rate_limit', 'The model is busy. Try again shortly.', true, {
      cause: error,
    });
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ChatModelError('auth', 'Chat provider credentials are invalid.', false, {
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ChatModelError('connection', 'Could not reach the chat provider.', true, {
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIError) {
    const retryable = typeof error.status === 'number' && error.status >= 500;
    return new ChatModelError(
      'api',
      `Chat provider error (${error.status ?? 'unknown'}).`,
      retryable,
      {
        cause: error,
      },
    );
  }
  return new ChatModelError('api', 'Unexpected chat provider failure.', false, { cause: error });
}

/** The same failure, carrying the requests billed before it. */
function withBilled(error: ChatModelError, billed: readonly BilledRequest[]): ChatModelError {
  if (billed.length === 0) return error;
  return new ChatModelError(error.kind, error.message, error.retryable, {
    cause: error.cause,
    billed: [...error.billed, ...billed],
  });
}

/** One request's bill: priced at the model that served it, with its lookups. */
function toBilled(message: Anthropic.Beta.BetaMessage): BilledRequest {
  const server = message.usage.server_tool_use;
  return {
    model: message.model,
    usage: toUsage(message.usage),
    webRequests: (server?.web_search_requests ?? 0) + (server?.web_fetch_requests ?? 0),
  };
}

function toUsage(usage: Anthropic.Beta.BetaUsage | Anthropic.Usage): ChatUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** JSON Schema keywords structured outputs reject; Zod re-checks them on the result. */
const UNSUPPORTED_SCHEMA_KEYS = ['$schema', 'minimum', 'maximum', 'maxItems'];

/** Structured outputs accept a subset of JSON Schema (exported for tests). */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.includes(key))
        .map(([key, value]) => [key, strip(value)]),
    );
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

/** JSON generation with structured outputs; the result is re-validated with Zod. */
export function createAnthropicStructuredModel(
  model: string,
  client: Anthropic = new Anthropic(),
): StructuredModel {
  return {
    provider: 'anthropic',
    model,
    async generate(request) {
      try {
        const message = await client.messages.create({
          model,
          max_tokens: request.maxTokens ?? 4000,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: toOutputSchema(request.schema) },
          },
        });
        if (message.stop_reason === 'refusal') {
          throw new ChatModelError('refusal', 'The model declined to answer that.', false);
        }
        const text = message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join('');
        const value = request.schema.parse(JSON.parse(text));
        return { value, usage: toUsage(message.usage) };
      } catch (error) {
        throw toChatError(error);
      }
    },
  };
}

/** Claude chat model. The SDK reads `ANTHROPIC_API_KEY` from the environment. */
export function createAnthropicChatModel(
  config: Pick<ChatConfig, 'model' | 'effort'>,
  client: Anthropic = new Anthropic(),
): ChatModel {
  return {
    provider: 'anthropic',
    model: config.model,
    async stream(request, onText, signal): Promise<ChatResult> {
      const billed: BilledRequest[] = [];
      /** The request in flight; its partial usage is billed if it fails. */
      let open: ReturnType<typeof client.beta.messages.stream> | undefined;
      try {
        const params = toAnthropicParams(request, config.model, config.effort);
        const content: Anthropic.Beta.BetaContentBlock[] = [];
        let message: Anthropic.Beta.BetaMessage | undefined;
        // Text that resumes after a tool block (a lookup, a picture) starts a new bubble.
        let wroteText = false;
        let afterTool = false;
        const emit = (delta: string) => {
          if (afterTool && wroteText) onText?.('\n\n');
          afterTool = false;
          wroteText = true;
          onText?.(delta);
        };
        // A long server-side lookup can pause the reply; resume it by sending the paused
        // turn back (no extra user message).
        for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
          const messages: Anthropic.Beta.BetaMessageParam[] = content.length
            ? [...params.messages, { role: 'assistant', content: [...content] }]
            : params.messages;
          const stream = client.beta.messages.stream({ ...params, messages }, { signal });
          open = stream;
          stream.on('text', emit);
          stream.on('streamEvent', (event) => {
            if (event.type === 'content_block_start' && event.content_block.type !== 'text') {
              afterTool = true;
            }
          });
          message = await stream.finalMessage();
          open = undefined;
          billed.push(toBilled(message));
          content.push(...message.content);
          if (message.stop_reason !== 'pause_turn') break;
        }
        if (!message) throw new ChatModelError('api', 'No reply from the model.', true);
        if (message.stop_reason === 'refusal') {
          throw new ChatModelError('refusal', 'The model declined to answer that.', false);
        }
        const text = joinText(content);
        const toolCalls = content.flatMap((block) =>
          block.type === 'tool_use' ? [{ id: block.id, name: block.name, input: block.input }] : [],
        );
        return {
          text,
          stopReason: message.stop_reason,
          model: message.model,
          usage: billed.map((b) => b.usage).reduce(addUsage),
          toolCalls,
          webRequests: billed.reduce((sum, b) => sum + b.webRequests, 0),
          billed,
          raw: content,
        };
      } catch (error) {
        // A request that broke mid-stream was still billed for what it read and wrote.
        const partial = open?.currentMessage;
        if (partial) billed.push(toBilled(partial));
        throw withBilled(toChatError(error), billed);
      }
    },
  };
}
