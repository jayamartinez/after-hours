import type { ChatConfig } from '../config';

import { createAnthropicChatModel, createAnthropicStructuredModel } from './anthropic';
import type { ChatModel, StructuredModel } from './types';

/**
 * Picks the chat implementation named by `CHAT_PRIMARY_PROVIDER`. `tier` picks the model:
 * `plus` uses `CHAT_PRIMARY_MODEL`, `free` uses `CHAT_FREE_MODEL` (D-040).
 */
export function createChatModel(config: ChatConfig, tier: 'plus' | 'free' = 'plus'): ChatModel {
  const model = tier === 'plus' ? config.model : config.freeModel;
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicChatModel({ model, effort: config.effort });
  }
}

/** The cheap structured model (`MEMORY_MODEL`) used for memory extraction. */
export function createMemoryModel(config: ChatConfig): StructuredModel {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicStructuredModel(config.memoryModel);
  }
}
