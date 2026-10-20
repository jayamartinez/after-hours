import type { MessageRow } from '../db/schema';
import type { ChatTurn } from '../providers/types';

/** Messages loaded from the database per model request (the newest ones). */
export const HISTORY_MESSAGES = 30;

/** Longest web page title shown to the model. */
const MAX_TITLE_IN_HISTORY = 80;

/**
 * A web page title as quoted data: it comes from a third-party page, so control
 * characters, quotes, and brackets are dropped, whitespace collapsed, and the length capped
 * (exported for tests).
 */
export function quotedTitle(title: string): string {
  const clean = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/["[\]\u201c\u201d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const capped =
    clean.length > MAX_TITLE_IN_HISTORY
      ? `${clean.slice(0, MAX_TITLE_IN_HISTORY - 3).trimEnd()}...`
      : clean;
  return `"${capped}"`;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/**
 * A photo the companion sent reads as `[photo]` plus its caption (see `PHOTO_RULES`); a
 * picture found on the web as `[shared picture titled "..."]` (see `WEB_RULES`).
 */
function turnText(row: MessageRow): string {
  const text = row.content.trim();
  if (row.kind === 'image' && row.role === 'assistant') {
    const tag =
      row.media?.kind === 'web'
        ? row.media.title
          ? `[shared picture titled ${quotedTitle(row.media.title)}]`
          : `[shared picture from ${quotedTitle(hostOf(row.media.pageUrl))}]`
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
