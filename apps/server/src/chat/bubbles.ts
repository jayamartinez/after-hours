/** Most bubbles one reply may become; anything past this is folded into the last bubble. */
export const MAX_BUBBLES = 4;

/**
 * Splits a model reply into chat bubbles. The prompt asks for a blank line between
 * separate texts, so blank lines are the only delimiter: single line breaks stay inside
 * a bubble (a short list, a two-line thought).
 */
export function splitBubbles(text: string, max = MAX_BUBBLES): string[] {
  const bubbles = text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (bubbles.length <= max) return bubbles;
  return [...bubbles.slice(0, max - 1), bubbles.slice(max - 1).join('\n')];
}

const SEPARATOR = /\n[ \t]*\n+/;

function parts(text: string): string[] {
  return text
    .split(SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface BubbleSplitter {
  /** Adds streamed text; returns bubbles completed by it (in order). */
  push(delta: string): string[];
  /** Ends the stream; returns the remaining bubble, if any. */
  finish(): string[];
}

/**
 * Incremental `splitBubbles`: emits each bubble as soon as the blank line after it
 * arrives, so the first text can be shown while the model is still writing the rest.
 * The concatenated output always equals `splitBubbles(fullText, max)`.
 */
export function createBubbleSplitter(max = MAX_BUBBLES): BubbleSplitter {
  let buffer = '';
  let emitted = 0;
  return {
    push(delta) {
      buffer = (buffer + delta).replace(/\r\n?/g, '\n');
      const done: string[] = [];
      while (emitted < max - 1) {
        const match = SEPARATOR.exec(buffer);
        if (!match) break;
        const bubble = buffer.slice(0, match.index).trim();
        buffer = buffer.slice(match.index + match[0].length);
        if (bubble) {
          done.push(bubble);
          emitted += 1;
        }
      }
      return done;
    },
    finish() {
      const rest = parts(buffer);
      buffer = '';
      if (rest.length === 0) return [];
      emitted += 1;
      return [rest.join('\n')];
    },
  };
}
