import { z } from 'zod';

import type { ChatTool, ToolCall, ToolResult } from '../providers/types';

import { withoutEmDashes } from './bubbles';

/**
 * `send_photo` (D-026): the only tool chat offers. The companion decides to send a photo
 * when the user asks for one; each photo costs one credit and, until image generation
 * exists, shows a labeled placeholder card describing the shot (`moment`), never an image.
 */

export const SEND_PHOTO = 'send_photo';
/** Captions longer than this are cut. */
const MAX_CAPTION = 140;

export const SEND_PHOTO_TOOL: ChatTool = {
  name: SEND_PHOTO,
  description:
    'Send the user a photo of yourself right now. Only when they ask for a photo, a selfie, or to see what you are up to; never unprompted; at most once per reply.',
  inputSchema: {
    type: 'object',
    properties: {
      moment: {
        type: 'string',
        description: 'What the photo shows, in a few words (e.g. "late desk, cold coffee").',
      },
      caption: {
        type: 'string',
        description:
          'Optional short text sent with the photo, in your texting voice. Empty for none.',
      },
    },
    required: ['moment', 'caption'],
    additionalProperties: false,
  },
};

const SendPhotoInputSchema = z.object({
  moment: z.string().trim().min(1),
  caption: z.string().trim(),
});

/** Longest stored photo description (the placeholder card shows it). */
const MAX_MOMENT = 200;

export type SendPhotoInput = z.infer<typeof SendPhotoInputSchema>;

/** Prompt rules added to the system prompt whenever the tool is offered. */
export const PHOTO_RULES: readonly string[] = [
  `You can send the user a photo of yourself with the ${SEND_PHOTO} tool. Use it only when they ask to see you or what you are doing; never offer or tease photos unprompted.`,
  'At most one photo per reply. A short line before or after it is enough; do not describe the photo in detail.',
  'When they ask for a photo, send it. Never ration photos, call one the last, or refuse because they asked often; the app handles limits.',
  'Photos you sent earlier appear in the history as [photo]. Never type [photo] yourself or pretend to send a photo without the tool.',
  'Photos stay PG-13: casual, clothed, nothing suggestive. Decline anything else in character.',
];

export const PHOTO_RESULTS = {
  sent: 'Photo sent; the user can see it now.',
  noCredits:
    'Not sent: the user has no photo credits left, and the app is showing them how to get more. Do not mention credits, prices, or the app. In one short text, say the photo will have to wait.',
  oncePerReply: 'Not sent: one photo per reply.',
  invalid: 'Not sent: the tool input was invalid.',
  unknownTool: 'Unknown tool.',
} as const;

export type PhotoOutcome =
  | { kind: 'sent' }
  | { kind: 'noCredits' }
  /** The photo could not be stored; the model is told it was not sent. */
  | { kind: 'failed' };

/**
 * Runs the tool calls of one reply: validates input, sends at most one photo through
 * `send`, and answers every call (the API needs a result for each).
 */
export async function runPhotoCalls(
  calls: readonly ToolCall[],
  send: (input: SendPhotoInput, call: ToolCall) => Promise<PhotoOutcome>,
  /** Shared across a reply's tool rounds so one reply never sends two photos. */
  reply: { photoAttempted: boolean } = { photoAttempted: false },
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    if (call.name !== SEND_PHOTO) {
      results.push({ callId: call.id, content: PHOTO_RESULTS.unknownTool, isError: true });
      continue;
    }
    const parsed = SendPhotoInputSchema.safeParse(call.input);
    if (!parsed.success) {
      results.push({ callId: call.id, content: PHOTO_RESULTS.invalid, isError: true });
      continue;
    }
    if (reply.photoAttempted) {
      results.push({ callId: call.id, content: PHOTO_RESULTS.oncePerReply, isError: true });
      continue;
    }
    reply.photoAttempted = true;
    const input = {
      moment: parsed.data.moment.slice(0, MAX_MOMENT),
      caption: withoutEmDashes(parsed.data.caption).trim().slice(0, MAX_CAPTION),
    };
    const outcome = await send(input, call);
    results.push(
      outcome.kind === 'sent'
        ? { callId: call.id, content: PHOTO_RESULTS.sent }
        : outcome.kind === 'noCredits'
          ? { callId: call.id, content: PHOTO_RESULTS.noCredits }
          : { callId: call.id, content: 'Not sent: something went wrong.', isError: true },
    );
  }
  return results;
}
