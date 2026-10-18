import type { MessageRow } from '../db/schema';
import type { ChatTurn } from '../providers/types';

/** Messages loaded from the database per model request (the newest ones). */
export const HISTORY_MESSAGES = 30;

/**
 * Stored messages → model turns. Undelivered user messages (other than the one being
 * answered) are dropped, and consecutive messages from one side are merged with a blank
 * line: that is how the model wrote multi-bubble replies in the first place.
 */
export function toHistoryTurns(rows: readonly MessageRow[], currentId: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const row of rows) {
    if (row.kind !== 'text' || !row.content.trim()) continue;
    if (row.status === 'failed' && row.id !== currentId) continue;
    const last = turns.at(-1);
    if (last?.role === row.role) last.content = `${last.content}\n\n${row.content}`;
    else turns.push({ role: row.role, content: row.content });
  }
  return turns;
}
