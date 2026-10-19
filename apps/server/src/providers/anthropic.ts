import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ChatConfig } from '../config';

import {
  ChatModelError,
  type ChatModel,
  type ChatRequest,
  type ChatResult,
  type ChatUsage,
  type StructuredModel,
} from './types';

/** Short texting replies; generous enough that thinking at low effort never truncates them. */
const DEFAULT_MAX_TOKENS = 4000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

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
  return {
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system,
    messages: request.messages.map((turn) => ({ role: turn.role, content: turn.content })),
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

/** Structured outputs accept a subset of JSON Schema; numeric bounds are checked by Zod instead. */
function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !['$schema', 'minimum', 'maximum'].includes(key))
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
        const stream = client.beta.messages.stream(
          toAnthropicParams(request, config.model, config.effort),
          { signal },
        );
        if (onText) stream.on('text', onText);
        const message = await stream.finalMessage();
        if (message.stop_reason === 'refusal') {
          throw new ChatModelError('refusal', 'The model declined to answer that.', false);
        }
        const text = message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join('');
        return {
          text,
          stopReason: message.stop_reason,
          model: message.model,
          usage: toUsage(message.usage),
        };
      } catch (error) {
        throw toChatError(error);
      }
    },
  };
}
