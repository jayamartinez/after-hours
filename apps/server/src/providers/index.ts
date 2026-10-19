import type { ChatConfig } from '../config';

import { createAnthropicChatModel, createAnthropicStructuredModel } from './anthropic';
import type { ChatModel, StructuredModel } from './types';

/** Picks the chat implementation named by `CHAT_PRIMARY_PROVIDER`. */
export function createChatModel(config: ChatConfig): ChatModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicChatModel(config);
  }
}

/** The cheap structured model (`MEMORY_MODEL`) used for memory extraction. */
export function createMemoryModel(config: ChatConfig): StructuredModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicStructuredModel(config.memoryModel);
  }
}
