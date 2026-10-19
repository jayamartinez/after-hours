import type { CharacterConfig } from '@after-hours/contracts';

import type { Db } from '../db/client';
import { addMemory, listMemories } from '../db/memories';
import type { ChatTurn, StructuredModel } from '../providers/types';

import { extractMemories } from './memory-extract';

/**
 * Runs memory extraction for one delivered exchange and stores what it finds, linked to
 * the user message it came from. Returns how many new memories were saved.
 */
export async function rememberFromExchange(
  db: Db,
  model: StructuredModel,
  character: CharacterConfig,
  exchange: {
    userId: string;
    userMessageId: string;
    turns: readonly ChatTurn[];
    timeZone?: string;
  },
): Promise<number> {
  const existing = await listMemories(db, exchange.userId, character.id);
  const candidates = await extractMemories(model, character, {
    turns: exchange.turns,
    existing,
    timeZone: exchange.timeZone,
  });
  let saved = 0;
  for (const candidate of candidates) {
    const { created } = await addMemory(db, exchange.userId, character.id, {
      ...candidate,
      sourceMessageId: exchange.userMessageId,
    });
    if (created) saved += 1;
  }
  return saved;
}
