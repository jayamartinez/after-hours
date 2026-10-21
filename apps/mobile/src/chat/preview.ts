import type { ChatMessage } from './types';

/** One-line summary of a message: the Chats row and the reply banner. */
export function messagePreview(message: ChatMessage | undefined): string {
  if (!message) return '';
  const prefix = message.role === 'user' ? 'You: ' : '';
  switch (message.kind) {
    case 'image':
      return `${prefix}${message.image?.source === 'web' ? 'Picture' : 'Photo'}`;
    case 'voice':
      return `${prefix}Voice note`;
    case 'text':
      return `${prefix}${message.content}`;
  }
  return '';
}
