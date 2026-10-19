import { ChatStreamEventSchema, type ChatStreamEvent } from '@after-hours/contracts';

export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser (WHATWG event-stream format): feed decoded text in
 * any chunking; complete frames come out. Comments and `id`/`retry` fields are ignored.
 */
export function createSseParser() {
  let buffer = '';
  return {
    feed(text: string): SseFrame[] {
      buffer = (buffer + text).replace(/\r\n?/g, '\n');
      const frames: SseFrame[] = [];
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          let value = colon === -1 ? '' : line.slice(colon + 1);
          if (value.startsWith(' ')) value = value.slice(1);
          if (field === 'event') event = value;
          else if (field === 'data') data.push(value);
        }
        if (data.length > 0) frames.push({ event, data: data.join('\n') });
      }
      return frames;
    },
  };
}

/** A frame as a typed chat event, or null when it is not one (unknown or invalid). */
export function toChatEvent(frame: SseFrame): ChatStreamEvent | null {
  try {
    const parsed = ChatStreamEventSchema.safeParse(JSON.parse(frame.data));
    return parsed.success && parsed.data.type === frame.event ? parsed.data : null;
  } catch {
    return null;
  }
}
