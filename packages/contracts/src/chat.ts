import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * Chat API wire shapes (docs/architecture.md, "Chat pipeline"). Rows of the `messages`
 * table map 1:1 to `ChatMessageDto`.
 */

/** Longest message a user may send, in characters. */
export const MAX_MESSAGE_CHARS = 2000;

export const MessageRoleSchema = z.enum(['user', 'assistant']);
export const MessageKindSchema = z.enum(['text', 'image', 'voice']);
/** Server-side statuses. `sending` and `delivered` exist only on the client. */
export const StoredMessageStatusSchema = z.enum(['sent', 'read', 'failed']);
export const ReactionSchema = z.enum(['heart', 'ha', 'wow', 'question', 'like']);

export const ChatMessageDtoSchema = z.object({
  id: z.string().min(1),
  role: MessageRoleSchema,
  kind: MessageKindSchema,
  content: z.string(),
  status: StoredMessageStatusSchema,
  /** ISO 8601. */
  createdAt: z.iso.datetime({ offset: true }),
  reactions: z.array(ReactionSchema),
  /** Client idempotency key of a user message. */
  clientId: z.string().nullable(),
});

export const SessionResponseSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1),
});

export const ConversationSummarySchema = z.object({
  companionId: CompanionIdSchema,
  lastMessage: ChatMessageDtoSchema.nullable(),
});

export const ConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
});

export const MessagesResponseSchema = z.object({
  companionId: CompanionIdSchema,
  /** Oldest first. */
  messages: z.array(ChatMessageDtoSchema),
});

export const SendMessageRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  /** Client-generated idempotency key; resending the same key never duplicates a message. */
  clientId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  /** IANA time zone of the device, e.g. "America/New_York" (prompt context only). */
  timeZone: z.string().max(64).optional(),
});

export const ChatErrorCodeSchema = z.enum([
  'bad_request',
  'unauthorized',
  'not_found',
  'conflict',
  'rate_limited',
  'unavailable',
  'refusal',
  'provider',
]);

/** Error body for non-streaming responses, and the payload of the SSE `error` event. */
export const ApiErrorSchema = z.object({
  code: ChatErrorCodeSchema,
  /** Short, user-facing text. */
  message: z.string(),
  /** Sending the same message again may succeed. */
  retryable: z.boolean(),
});

/**
 * Server-sent events of `POST /conversations/:companionId/messages`. Each SSE frame has
 * `event: <type>` and `data: <JSON of the whole event>`. Order:
 * `ack` → `typing` → (`delta`* `bubble`)+ → `done`, or `error` at any point after `ack`.
 */
export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  /** The user message is persisted. */
  z.object({ type: z.literal('ack'), message: ChatMessageDtoSchema }),
  /** The companion is composing a reply. */
  z.object({ type: z.literal('typing') }),
  /** Raw text of the bubble in progress (optional to render). */
  z.object({ type: z.literal('delta'), text: z.string() }),
  /** One finished, persisted reply bubble. */
  z.object({ type: z.literal('bubble'), message: ChatMessageDtoSchema }),
  z.object({
    type: z.literal('done'),
    userMessageId: z.string(),
    messageIds: z.array(z.string()),
  }),
  z.object({ type: z.literal('error'), error: ApiErrorSchema }),
]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type MessageKind = z.infer<typeof MessageKindSchema>;
export type StoredMessageStatus = z.infer<typeof StoredMessageStatusSchema>;
export type ReactionId = z.infer<typeof ReactionSchema>;
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationsResponse = z.infer<typeof ConversationsResponseSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type ChatErrorCode = z.infer<typeof ChatErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
