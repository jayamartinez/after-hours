import type { MessageRow } from '../db/schema';
import type { ChatTurn } from '../providers/types';

/** Messages loaded from the database per model request (the newest ones). */
export const HISTORY_MESSAGES = 30;

/**
 * A photo the companion sent reads as `[photo]` plus its caption (see `PHOTO_RULES`); a
 * picture found on the web as `[shared picture: title]` (see `WEB_RULES`).
 */
function turnText(row: MessageRow): string {
  const text = row.content.trim();
  if (row.kind === 'image' && row.role === 'assistant') {
    const tag =
      row.media?.kind === 'web'
        ? `[shared picture: ${row.media.title || row.media.pageUrl}]`
        : '[photo]';
    return text ? `${tag} ${text}` : tag;
  }
  return row.kind === 'text' ? text : '';
}

/**
 * Stored messages → model turns. Undelivered user messages (other than the one being
 * answered) are dropped, and consecutive messages from one side are merged with a blank
 * line: that is how the model wrote multi-bubble replies in the first place.
 */
export function toHistoryTurns(rows: readonly MessageRow[], currentId: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const row of rows) {
    const content = turnText(row);
    if (!content) continue;
    if (row.status === 'failed' && row.id !== currentId) continue;
    const last = turns.at(-1);
    if (last?.role === row.role) last.content = `${last.content}\n\n${content}`;
    else turns.push({ role: row.role, content });
  }
  return turns;
}
