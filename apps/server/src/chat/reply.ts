import type { ChatModel, ChatRequest, ChatResult } from '../providers/types';
import { ChatModelError } from '../providers/types';

import { createBubbleSplitter } from './bubbles';

export interface StreamReplyHandlers {
  /** Raw streamed text. */
  onDelta?: (text: string) => void;
  /** A finished bubble; awaited in order before the next one is delivered. */
  onBubble: (text: string, index: number) => Promise<void>;
}

export interface StreamReplyResult {
  bubbles: string[];
  result: ChatResult;
}

/**
 * Streams one reply and delivers it bubble by bubble as each completes. A retryable
 * provider failure before the first token is retried once; after the first token,
 * failures propagate (bubbles already delivered stay delivered).
 */
export async function streamReply(
  model: ChatModel,
  request: ChatRequest,
  handlers: StreamReplyHandlers,
): Promise<StreamReplyResult> {
  const bubbles: string[] = [];
  let chain: Promise<void> = Promise.resolve();
  const deliver = (texts: string[]) => {
    for (const text of texts) {
      const index = bubbles.push(text) - 1;
      chain = chain.then(() => handlers.onBubble(text, index));
    }
  };

  const attempt = async (): Promise<ChatResult> => {
    let received = false;
    const splitter = createBubbleSplitter();
    try {
      const result = await model.stream(request, (delta) => {
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

  let result: ChatResult;
  try {
    result = await attempt();
  } catch (error) {
    if (!(error instanceof RetryBeforeFirstToken)) {
      await chain.catch(() => {});
      throw error;
    }
    try {
      result = await attempt();
    } catch (second) {
      await chain.catch(() => {});
      throw second instanceof RetryBeforeFirstToken ? second.original : second;
    }
  }
  await chain;
  return { bubbles, result };
}

class RetryBeforeFirstToken extends Error {
  constructor(readonly original: ChatModelError) {
    super(original.message);
  }
}
