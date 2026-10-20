import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ChatConfig } from '../config';

import {
  ChatModelError,
  type ChatModel,
  type ChatRequest,
  type ChatResult,
  type ChatTurn,
  type ChatUsage,
  remainingWeb,
  type StructuredModel,
  type WebAccess,
} from './types';

/** Short texting replies; generous enough that thinking at low effort never truncates them. */
const DEFAULT_MAX_TOKENS = 4000;
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

const SERVER_TOOL_ALLOWANCE = { web_search: 'searches', web_fetch: 'fetches' } as const;

/**
 * True when a paused turn ends in a web lookup that has not run yet and whose tool has no
 * uses left: resuming would need the tool, which is no longer declared (exported for tests).
 */
export function waitsOnSpentTool(
  content: readonly Anthropic.Beta.BetaContentBlock[],
  web: WebAccess | undefined,
): boolean {
  const answered = new Set(
    content.flatMap((block) =>
      'tool_use_id' in block && typeof block.tool_use_id === 'string' ? [block.tool_use_id] : [],
    ),
  );
  return content.some((block) => {
    if (block.type !== 'server_tool_use' || answered.has(block.id)) return false;
    const key = SERVER_TOOL_ALLOWANCE[block.name as keyof typeof SERVER_TOOL_ALLOWANCE];
    return key !== undefined && (web?.[key] ?? 0) <= 0;
  });
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
  if (request.system.context) system.push({ type: 'text', text: request.system.context });
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
    messages: request.messages.map(toMessageParam),
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
      try {
        const content: Anthropic.Beta.BetaContentBlock[] = [];
        let message: Anthropic.Beta.BetaMessage | undefined;
        const webUsed = { searches: 0, fetches: 0 };
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
        // turn back (no extra user message). `max_uses` counts per request, so every resume
        // declares only what is left of the reply's allowance.
        for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
          const web = request.web && remainingWeb(request.web, webUsed);
          if (attempt > 0 && waitsOnSpentTool(content, web)) break;
          const params = toAnthropicParams({ ...request, web }, config.model, config.effort);
          const messages: Anthropic.Beta.BetaMessageParam[] = content.length
            ? [...params.messages, { role: 'assistant', content: [...content] }]
            : params.messages;
          const stream = client.beta.messages.stream({ ...params, messages }, { signal });
          stream.on('text', emit);
          stream.on('streamEvent', (event) => {
            if (event.type === 'content_block_start' && event.content_block.type !== 'text') {
              afterTool = true;
            }
          });
          message = await stream.finalMessage();
          content.push(...message.content);
          const server = message.usage.server_tool_use;
          webUsed.searches += server?.web_search_requests ?? 0;
          webUsed.fetches += server?.web_fetch_requests ?? 0;
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
          usage: toUsage(message.usage),
          toolCalls,
          webRequests: webUsed.searches + webUsed.fetches,
          webUsed,
          raw: content,
        };
      } catch (error) {
        throw toChatError(error);
      }
    },
  };
}
