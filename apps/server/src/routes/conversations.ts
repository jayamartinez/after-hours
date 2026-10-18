import {
  SendMessageRequestSchema,
  type ApiError,
  type CharacterConfig,
  type ChatStreamEvent,
  type ConversationsResponse,
  type MessagesResponse,
} from '@after-hours/contracts';
import { Hono } from 'hono';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';

import { requireUser, type AuthEnv } from '../auth/session';
import type { CharacterStore } from '../characters/store';
import { HISTORY_MESSAGES, toHistoryTurns } from '../chat/history';
import { streamReply } from '../chat/reply';
import { buildChatRequest } from '../chat/request';
import type { Db } from '../db/client';
import {
  getOrCreateConversation,
  insertAssistantBubble,
  insertUserMessage,
  listConversationSummaries,
  listMessages,
  listReplies,
  setMessageStatus,
  toMessageDto,
} from '../db/conversations';
import { listMemories } from '../db/memories';
import type { MessageRow } from '../db/schema';
import { createRateLimiter } from '../limits/rate-limit';
import { ChatModelError, type ChatModel } from '../providers/types';

export interface ConversationRoutesOptions {
  db: Db;
  store: CharacterStore;
  model: ChatModel;
  sessionSecret: string;
  killSwitch: boolean;
  rateLimitPerMin: number;
  log?: (message: string) => void;
}

const apiError = (code: ApiError['code'], message: string, retryable: boolean): ApiError => ({
  code,
  message,
  retryable,
});

function validTimeZone(zone: string | undefined): string | undefined {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

/** User-facing error for a failed reply. Message content is never logged. */
function replyError(error: unknown, name: string, partial: boolean): ApiError {
  if (partial) {
    return apiError('provider', `${name}'s reply got cut off. Send another message.`, false);
  }
  if (error instanceof ChatModelError && error.kind === 'refusal') {
    return apiError('refusal', `${name} won't answer that one. Try saying it another way.`, false);
  }
  return apiError('provider', `${name} can't reply right now. Tap retry in a moment.`, true);
}

/**
 * Chat API (D-023). Conversations are addressed by companion id and always resolved
 * through the authenticated user, so one user can never reach another user's thread.
 */
export function conversationRoutes(options: ConversationRoutesOptions) {
  const { db, store, model } = options;
  const log = options.log ?? ((message: string) => console.warn(message));
  const limiter = createRateLimiter(options.rateLimitPerMin);
  /** `conversationId:clientId` of replies being generated right now. */
  const inFlight = new Set<string>();

  const companionFor = (id: string): CharacterConfig | undefined => store.get(id);

  return new Hono<AuthEnv>()
    .use('/conversations', requireUser(db, options.sessionSecret))
    .use('/conversations/*', requireUser(db, options.sessionSecret))

    .get('/conversations', async (c) => {
      const known = new Set(store.list().map((character) => character.id));
      const summaries = await listConversationSummaries(db, c.var.userId);
      const body: ConversationsResponse = {
        conversations: summaries.filter((summary) => known.has(summary.companionId)),
      };
      return c.json(body);
    })

    .get('/conversations/:companionId/messages', async (c) => {
      const character = companionFor(c.req.param('companionId'));
      if (!character) return c.json(apiError('not_found', 'No such companion.', false), 404);
      const conversationId = await getOrCreateConversation(
        db,
        c.var.userId,
        character.id,
        character.publicProfile.copy.firstMessage,
      );
      const rows = await listMessages(db, conversationId, { limit: 200 });
      const body: MessagesResponse = {
        companionId: character.id,
        messages: rows.map(toMessageDto),
      };
      return c.json(body);
    })

    .post('/conversations/:companionId/messages', async (c) => {
      if (options.killSwitch) {
        return c.json(
          apiError('unavailable', 'Chat is paused right now. Check back later.', false),
          503,
        );
      }
      const character = companionFor(c.req.param('companionId'));
      if (!character) return c.json(apiError('not_found', 'No such companion.', false), 404);

      const parsed = SendMessageRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json(apiError('bad_request', 'That message could not be sent.', false), 400);
      }
      const { text, clientId } = parsed.data;
      const userId = c.var.userId;

      if (!limiter.take(userId)) {
        return c.json(
          apiError('rate_limited', 'Slow down a little. Try again in a minute.', true),
          429,
        );
      }

      const conversationId = await getOrCreateConversation(
        db,
        userId,
        character.id,
        character.publicProfile.copy.firstMessage,
      );
      const key = `${conversationId}:${clientId}`;
      if (inFlight.has(key)) {
        return c.json(apiError('conflict', 'Already sending that message.', true), 409);
      }
      inFlight.add(key);

      let userRow: MessageRow;
      let replay: MessageRow[] = [];
      try {
        const { row, created } = await insertUserMessage(db, conversationId, text, clientId);
        userRow = row;
        if (!created) replay = await listReplies(db, row.id);
        if (!created && replay.length === 0 && row.status === 'failed') {
          // Retry of an undelivered message: deliver it again.
          await setMessageStatus(db, conversationId, [row.id], 'sent');
          userRow = { ...row, status: 'sent' };
        }
      } catch (error) {
        inFlight.delete(key);
        throw error;
      }

      return streamSSE(c, async (stream) => {
        const send = (event: ChatStreamEvent) => writeEvent(stream, event);
        try {
          await send({ type: 'ack', message: toMessageDto(userRow) });

          if (replay.length > 0) {
            // Idempotent resend of a message that was already answered.
            for (const bubble of replay)
              await send({ type: 'bubble', message: toMessageDto(bubble) });
            await send({
              type: 'done',
              userMessageId: userRow.id,
              messageIds: replay.map((bubble) => bubble.id),
            });
            return;
          }

          await send({ type: 'typing' });
          const [rows, memories] = await Promise.all([
            listMessages(db, conversationId, { limit: HISTORY_MESSAGES, uptoSeq: userRow.seq }),
            listMemories(db, userId, character.id),
          ]);
          const request = buildChatRequest(character, {
            history: toHistoryTurns(rows, userRow.id),
            memories,
            timeZone: validTimeZone(parsed.data.timeZone),
          });

          const saved: string[] = [];
          try {
            await streamReply(model, request, {
              onDelta: (delta) => void send({ type: 'delta', text: delta }),
              onBubble: async (bubbleText) => {
                const row = await insertAssistantBubble(db, conversationId, userRow.id, bubbleText);
                saved.push(row.id);
                await send({ type: 'bubble', message: toMessageDto(row) });
              },
            });
            if (saved.length === 0) {
              throw new ChatModelError('api', 'The model returned an empty reply.', true);
            }
          } catch (error) {
            const failure = replyError(error, character.name, saved.length > 0);
            log(
              `[chat] reply failed (${error instanceof ChatModelError ? error.kind : 'internal'}): ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            await setMessageStatus(
              db,
              conversationId,
              [userRow.id],
              failure.retryable ? 'failed' : 'read',
            );
            await send({ type: 'error', error: failure });
            return;
          }

          await setMessageStatus(db, conversationId, [userRow.id], 'read');
          await send({ type: 'done', userMessageId: userRow.id, messageIds: saved });
        } finally {
          inFlight.delete(key);
        }
      });
    });
}

/** Writes one event; a closed connection is ignored so the reply still gets persisted. */
async function writeEvent(stream: SSEStreamingApi, event: ChatStreamEvent): Promise<void> {
  if (stream.aborted || stream.closed) return;
  try {
    await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
  } catch {
    // Client went away mid-stream.
  }
}
