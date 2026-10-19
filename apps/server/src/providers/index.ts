import type { ChatConfig } from '../config';

import { createAnthropicChatModel } from './anthropic';
import type { ChatModel } from './types';

/** Picks the chat implementation named by `CHAT_PRIMARY_PROVIDER`. */
export function createChatModel(config: ChatConfig): ChatModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicChatModel(config);
  }
}
