import {
  FREE_MAX_MESSAGE_CHARS,
  SendMessageRequestSchema,
  type ApiError,
  type CharacterConfig,
  type ChatStreamEvent,
  type ConversationsResponse,
  type MessagesResponse,
  type StartersResponse,
} from '@after-hours/contracts';
import { Hono } from 'hono';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';

import { requireUser, type AuthEnv } from '../auth/session';
import type { CharacterStore } from '../characters/store';
import { HISTORY_MESSAGES, toHistoryTurns } from '../chat/history';
import { streamReply } from '../chat/reply';
import { runPhotoCalls, type PhotoOutcome, type SendPhotoInput } from '../chat/photo-tool';
import { rememberFromExchange } from '../chat/remember';
import { prefsFromProfile } from '../chat/profile';
import { buildChatRequest } from '../chat/request';
import {
  createStarterCache,
  generateStarters,
  startersFingerprint,
  type StarterInput,
} from '../chat/starters';
import { validTimeZone } from '../chat/time-zone';
import {
  runShareImageCalls,
  SHARE_IMAGE,
  webLimitsFor,
  type ShareImageOutcome,
} from '../chat/web-tools';
import type { Db } from '../db/client';
import { spendCredit } from '../db/credits';
import {
  countUserMessages,
  deleteConversation,
  findUserMessage,
  getOrCreateConversation,
  insertAssistantBubble,
  insertAssistantPhoto,
  insertAssistantWebImage,
  insertUserMessage,
  listConversationSummaries,
  listMessages,
  listReplies,
  setMessageStatus,
  toMessageDto,
} from '../db/conversations';
import { listMemories } from '../db/memories';
import { addSpend, spendMessage } from '../db/message-allowance';
import { replyCostMicroUsd } from '../chat/costs';
import type { MessageRow } from '../db/schema';
import { getProfile, isPlus } from '../db/users';
import { addWebLookups, remainingWebLookups } from '../db/web-usage';
import { createRateLimiter } from '../limits/rate-limit';
import {
  ChatModelError,
  type ChatModel,
  type StructuredModel,
  type ToolCall,
} from '../providers/types';

export interface ConversationRoutesOptions {
  db: Db;
  store: CharacterStore;
  /** Plus subscribers' chat model. */
  model: ChatModel;
  /** Free users' chat model (D-040). Default: `model`. */
  freeModel?: ChatModel;
  sessionSecret: string;
  killSwitch: boolean;
  rateLimitPerMin: number;
  /**
   * Extracts memories after each delivered reply and writes per-user starters. Unset: no
   * automatic memories, and starters are the companion's defaults.
   */
  memoryModel?: StructuredModel;
  /**
   * Receives background work (memory extraction) that outlives the response. Default:
   * run detached. Tests pass a collector to await it.
   */
  waitUntil?: (task: Promise<void>) => void;
  log?: (message: string) => void;
  /** Web search, link reading, and found pictures (D-038). Off by default. */
  webAccess?: boolean;
  /** Finds a page's preview picture (tests inject a fake; default `findPageImage`). */
  findPageImage?: (pageUrl: string) => Promise<{ url: string; pageUrl: string; title: string }>;
}

const apiError = (code: ApiError['code'], message: string, retryable: boolean): ApiError => ({
  code,
  message,
  retryable,
});

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
  const waitUntil = options.waitUntil ?? ((task: Promise<void>) => void task);
  const limiter = createRateLimiter(options.rateLimitPerMin);
  /** `conversationId:clientId` of replies being generated right now. */
  const inFlight = new Set<string>();
  const starterModel = options.killSwitch ? undefined : options.memoryModel;
  const starterLimiter = createRateLimiter(options.rateLimitPerMin);
  const starterCache = createStarterCache();

  /**
   * Starters written for this user (D-032), cached until their profile or memories change.
   * The companion's default starters stand in when the model is off, busy, or fails.
   */
  const startersFor = async (character: CharacterConfig, userId: string): Promise<string[]> => {
    const fallback = character.publicProfile.starters;
    if (!starterModel) return fallback;
    const input: StarterInput = {
      profile: await getProfile(db, userId),
      memories: character.memory.enabled ? await listMemories(db, userId, character.id) : [],
    };
    const key = `${userId}:${character.id}`;
    const fingerprint = startersFingerprint(input);
    const cached = starterCache.get(key, fingerprint);
    if (cached) return cached;
    if (!starterLimiter.take(userId)) return fallback;
    try {
      const starters = await generateStarters(starterModel, character, input);
      if (starters.length === 0) return fallback;
      starterCache.set(key, fingerprint, starters);
      return starters;
    } catch (error) {
      log(
        `[starters] generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  };

  const companionFor = (id: string): CharacterConfig | undefined => store.get(id);

  return (
    new Hono<AuthEnv>()
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

      .get('/conversations/:companionId/starters', async (c) => {
        const character = companionFor(c.req.param('companionId'));
        if (!character) return c.json(apiError('not_found', 'No such companion.', false), 404);
        const body: StartersResponse = {
          companionId: character.id,
          starters: await startersFor(character, c.var.userId),
        };
        return c.json(body);
      })

      .get('/conversations/:companionId/messages', async (c) => {
        const character = companionFor(c.req.param('companionId'));
        if (!character) return c.json(apiError('not_found', 'No such companion.', false), 404);
        const conversationId = await getOrCreateConversation(db, c.var.userId, character.id);
        const rows = await listMessages(db, conversationId, { limit: 200 });
        const body: MessagesResponse = {
          companionId: character.id,
          messages: rows.map(toMessageDto),
        };
        return c.json(body);
      })

      /** Clears the thread (messages only; memories have their own controls). */
      .delete('/conversations/:companionId', async (c) => {
        const character = companionFor(c.req.param('companionId'));
        if (!character) return c.json(apiError('not_found', 'No such companion.', false), 404);
        await deleteConversation(db, c.var.userId, character.id);
        return c.body(null, 204);
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
        const plus = await isPlus(db, userId);
        if (!plus && text.length > FREE_MAX_MESSAGE_CHARS) {
          return c.json(
            apiError(
              'message_too_long',
              `Free messages can be up to ${FREE_MAX_MESSAGE_CHARS} characters. Shorten it, or get Plus for longer ones.`,
              false,
            ),
            400,
          );
        }
        const replyModel = plus ? model : (options.freeModel ?? model);

        if (!limiter.take(userId)) {
          return c.json(
            apiError('rate_limited', 'Slow down a little. Try again in a minute.', true),
            429,
          );
        }

        const conversationId = await getOrCreateConversation(db, userId, character.id);
        const key = `${conversationId}:${clientId}`;
        if (inFlight.has(key)) {
          return c.json(apiError('conflict', 'Already sending that message.', true), 409);
        }
        inFlight.add(key);

        let userRow: MessageRow;
        let replay: MessageRow[] = [];
        try {
          // A new message spends one from the allowance (D-036); a resend of a stored one
          // (retry, idempotent replay) was paid for already.
          if (!(await findUserMessage(db, conversationId, clientId))) {
            if (!(await spendMessage(db, userId))) {
              inFlight.delete(key);
              return c.json(
                apiError(
                  'messages_required',
                  'You’re out of free messages for today. Get more to keep talking.',
                  true,
                ),
                402,
              );
            }
          }
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
            const [rows, memories, userMessages, profile, webLeft] = await Promise.all([
              listMessages(db, conversationId, { limit: HISTORY_MESSAGES, uptoSeq: userRow.seq }),
              listMemories(db, userId, character.id),
              countUserMessages(db, conversationId, userRow.seq),
              getProfile(db, userId),
              options.webAccess ? remainingWebLookups(db, userId) : Promise.resolve(0),
            ]);
            const request = buildChatRequest(character, {
              history: toHistoryTurns(rows, userRow.id),
              memories,
              userMessages,
              prefs: prefsFromProfile(profile),
              web: webLimitsFor(webLeft),
              timeZone: validTimeZone(parsed.data.timeZone),
              photos: true,
            });

            const saved: string[] = [];
            const replyText: string[] = [];
            /** Sends the photo if the user has a credit (D-026). */
            const sendPhoto = async (
              input: SendPhotoInput,
              call: ToolCall,
            ): Promise<PhotoOutcome> => {
              const balance = await spendCredit(db, userId, `${userRow.id}:${call.id}`);
              if (balance === null) {
                await send({ type: 'credits_required' });
                return { kind: 'noCredits' };
              }
              const row = await insertAssistantPhoto(db, conversationId, userRow.id, {
                caption: input.caption,
                description: input.moment,
              });
              saved.push(row.id);
              await send({ type: 'bubble', message: toMessageDto(row) });
              await send({ type: 'credits', balance });
              return { kind: 'sent' };
            };
            /** Shows a picture found on the web (D-038). */
            let picturesShared = 0;
            const shareImage = async (image: {
              url: string;
              pageUrl: string;
              title: string;
              caption: string;
            }): Promise<ShareImageOutcome> => {
              const row = await insertAssistantWebImage(db, conversationId, userRow.id, image);
              saved.push(row.id);
              picturesShared += 1;
              await send({ type: 'bubble', message: toMessageDto(row) });
              return { kind: 'sent' };
            };
            let webRequests = 0;
            let replyCost = 0;
            /** One photo and one picture per reply, across tool rounds. */
            const replyTools = { photoAttempted: false, pictureShared: false };
            try {
              const { result } = await streamReply(replyModel, request, {
                onDelta: (delta) => void send({ type: 'delta', text: delta }),
                onBubble: async (bubbleText) => {
                  const row = await insertAssistantBubble(
                    db,
                    conversationId,
                    userRow.id,
                    bubbleText,
                  );
                  saved.push(row.id);
                  replyText.push(bubbleText);
                  await send({ type: 'bubble', message: toMessageDto(row) });
                },
                onToolCalls: async (calls) => [
                  ...(await runPhotoCalls(
                    calls.filter((call) => call.name !== SHARE_IMAGE),
                    sendPhoto,
                    replyTools,
                  )),
                  ...(await runShareImageCalls(
                    calls.filter((call) => call.name === SHARE_IMAGE),
                    shareImage,
                    options.findPageImage,
                    replyTools,
                  )),
                ],
              });
              webRequests = result.webRequests ?? 0;
              replyCost = replyCostMicroUsd(result.model, result.usage, webRequests);
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

            await addWebLookups(db, userId, webRequests + picturesShared);
            await addSpend(db, userId, replyCost);
            await setMessageStatus(db, conversationId, [userRow.id], 'read');
            await send({ type: 'done', userMessageId: userRow.id, messageIds: saved });

            if (options.memoryModel) {
              const turns = [
                ...request.messages,
                { role: 'assistant' as const, content: replyText.join('\n\n') },
              ];
              waitUntil(
                rememberFromExchange(db, options.memoryModel, character, {
                  userId,
                  userMessageId: userRow.id,
                  turns,
                  timeZone: validTimeZone(parsed.data.timeZone),
                }).then(
                  () => {},
                  (error: unknown) =>
                    log(
                      `[memory] extraction failed: ${
                        error instanceof Error ? error.message : String(error)
                      }`,
                    ),
                ),
              );
            }
          } finally {
            inFlight.delete(key);
          }
        });
      })
  );
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
