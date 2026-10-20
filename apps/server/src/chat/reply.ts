import type { ChatModel, ChatRequest, ChatResult, ToolCall, ToolResult } from '../providers/types';
import { ChatModelError, remainingWeb } from '../providers/types';

import { createBubbleSplitter, isToolMarkup, withoutEmDashes } from './bubbles';

/**
 * Tool rounds per reply: a second round lets a failed picture be retried with another page.
 * The reply after the last round runs with tools off.
 */
export const MAX_TOOL_ROUNDS = 2;

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
 * If the reply ends in tool calls, they run and the model continues with their results,
 * for at most `MAX_TOOL_ROUNDS` rounds; the last continuation runs with tools disabled.
 * `request.web` is the whole reply's web allowance: each continuation gets what is left.
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
      if (isToolMarkup(raw)) continue;
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

    let history = request.messages;
    for (
      let round = 1;
      round <= MAX_TOOL_ROUNDS &&
      result.stopReason === 'tool_use' &&
      result.toolCalls.length > 0 &&
      handlers.onToolCalls;
      round++
    ) {
      await chain;
      const toolResults = await handlers.onToolCalls(result.toolCalls);
      const earlierWeb = result.webRequests ?? 0;
      const earlierUsed = {
        searches: result.webUsed?.searches ?? 0,
        fetches: result.webUsed?.fetches ?? 0,
      };
      history = [
        ...history,
        { role: 'assistant', content: result.text, raw: result.raw },
        { role: 'user', content: '', toolResults },
      ];
      // No retry here: part of the reply (and possibly a photo) is already delivered.
      const continued = await attempt({
        ...request,
        toolChoice: round < MAX_TOOL_ROUNDS ? 'auto' : 'none',
        messages: history,
        ...(request.web ? { web: remainingWeb(request.web, earlierUsed) } : {}),
      });
      result = {
        ...continued,
        webRequests: earlierWeb + (continued.webRequests ?? 0),
        webUsed: {
          searches: earlierUsed.searches + (continued.webUsed?.searches ?? 0),
          fetches: earlierUsed.fetches + (continued.webUsed?.fetches ?? 0),
        },
      };
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
