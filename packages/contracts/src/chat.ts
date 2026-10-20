import { z } from 'zod';

import { CompanionIdSchema } from './companion';

/**
 * Chat API wire shapes (docs/architecture.md, "Chat pipeline"). Rows of the `messages`
 * table map 1:1 to `ChatMessageDto`.
 */

/** Longest message a user may send, in characters. */
export const MAX_MESSAGE_CHARS = 2000;
/** Longest message a free user can send; Plus gets `MAX_MESSAGE_CHARS` (D-040). */
export const FREE_MAX_MESSAGE_CHARS = 850;

export const MessageRoleSchema = z.enum(['user', 'assistant']);
export const MessageKindSchema = z.enum(['text', 'image', 'voice']);
/** Server-side statuses. `sending` and `delivered` exist only on the client. */
export const StoredMessageStatusSchema = z.enum(['sent', 'read', 'failed']);
export const ReactionSchema = z.enum(['heart', 'ha', 'wow', 'question', 'like']);

const HttpsUrlSchema = z.url({ protocol: /^https$/ }).max(2048);

/**
 * The picture of an image message.
 * - `placeholder`: a companion's own photo; no image yet, so the app draws a labeled card
 *   with `description` (what the photo would show) until image generation exists (D-026).
 * - `web`: a picture a companion found online for the user (D-038), shown with a link to
 *   the page it came from.
 */
export const MessageImageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('placeholder'),
    description: z.string().max(200).default(''),
  }),
  z.object({
    kind: z.literal('web'),
    url: HttpsUrlSchema,
    pageUrl: HttpsUrlSchema,
    title: z.string().max(200).default(''),
  }),
]);

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
  /** Set on `kind: 'image'` messages. */
  image: MessageImageSchema.nullable().default(null),
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
  /** Out of free and bonus messages (D-036): get Plus, a pack, or watch an ad. */
  'messages_required',
  /** Longer than a free user's limit (D-040). */
  'message_too_long',
  /** This network has used its share of the public demo (D-042). Not retryable. */
  'demo_limit_reached',
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
 * A photo arrives as an image `bubble` followed by `credits`; without credits, the photo
 * is not sent and `credits_required` tells the app to offer more.
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
  /** The photo credit balance after a photo was sent. */
  z.object({ type: z.literal('credits'), balance: z.number().int().min(0) }),
  /** The companion tried to send a photo but the user has no credits left. */
  z.object({ type: z.literal('credits_required') }),
]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type MessageKind = z.infer<typeof MessageKindSchema>;
export type StoredMessageStatus = z.infer<typeof StoredMessageStatusSchema>;
export type ReactionId = z.infer<typeof ReactionSchema>;
export type MessageImage = z.infer<typeof MessageImageSchema>;
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationsResponse = z.infer<typeof ConversationsResponseSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type ChatErrorCode = z.infer<typeof ChatErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
