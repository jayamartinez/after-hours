import type { ChatModel, ChatRequest, ChatResult, ToolCall, ToolResult } from '../providers/types';
import { ChatModelError } from '../providers/types';

import { createBubbleSplitter, withoutEmDashes } from './bubbles';

export interface StreamReplyHandlers {
  /** Raw streamed text. */
  onDelta?: (text: string) => void;
  /** A finished bubble; awaited in order before the next one is delivered. */
  onBubble: (text: string, index: number) => Promise<void>;
  /**
   * Runs the tool calls a reply ended with, after every bubble before them is delivered.
   * Unset: tool calls are ignored and the reply ends there.
   */
  onToolCalls?: (calls: ToolCall[]) => Promise<ToolResult[]>;
}

export interface StreamReplyResult {
  bubbles: string[];
  result: ChatResult;
}

/**
 * Streams one reply and delivers it bubble by bubble as each completes. A retryable
 * provider failure before the first token is retried once; after the first token,
 * failures propagate (bubbles already delivered stay delivered).
 *
 * If the reply ends in tool calls, they run, and the model continues once with their
 * results and tools disabled, so one reply holds at most one round of tool use.
 */
export async function streamReply(
  model: ChatModel,
  request: ChatRequest,
  handlers: StreamReplyHandlers,
): Promise<StreamReplyResult> {
  const bubbles: string[] = [];
  let chain: Promise<void> = Promise.resolve();
  const deliver = (texts: string[]) => {
    for (const raw of texts) {
      const text = withoutEmDashes(raw);
      const index = bubbles.push(text) - 1;
      chain = chain.then(() => handlers.onBubble(text, index));
    }
  };

  const attempt = async (req: ChatRequest): Promise<ChatResult> => {
    let received = false;
    const splitter = createBubbleSplitter();
    try {
      const result = await model.stream(req, (delta) => {
        received = true;
        handlers.onDelta?.(delta);
        deliver(splitter.push(delta));
      });
      deliver(splitter.finish());
      return result;
    } catch (error) {
      if (!received && error instanceof ChatModelError && error.retryable) {
        throw new RetryBeforeFirstToken(error);
      }
      throw error;
    }
  };

  const unwrap = (error: unknown) =>
    error instanceof RetryBeforeFirstToken ? error.original : error;

  try {
    let result: ChatResult;
    try {
      result = await attempt(request);
    } catch (error) {
      if (!(error instanceof RetryBeforeFirstToken)) throw error;
      result = await attempt(request);
    }

    if (result.stopReason === 'tool_use' && result.toolCalls.length > 0 && handlers.onToolCalls) {
      await chain;
      const toolResults = await handlers.onToolCalls(result.toolCalls);
      // No retry here: part of the reply (and possibly a photo) is already delivered.
      result = await attempt({
        ...request,
        toolChoice: 'none',
        messages: [
          ...request.messages,
          { role: 'assistant', content: result.text, raw: result.raw },
          { role: 'user', content: '', toolResults },
        ],
      });
    }
    await chain;
    return { bubbles, result };
  } catch (error) {
    await chain.catch(() => {});
    throw unwrap(error);
  }
}

class RetryBeforeFirstToken extends Error {
  constructor(readonly original: ChatModelError) {
    super(original.message);
  }
}
