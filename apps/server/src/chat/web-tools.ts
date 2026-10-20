import { z } from 'zod';

import type { ChatTool, ToolCall, ToolResult } from '../providers/types';

import { findPageImage, PageImageFailure, type PageImage } from './page-image';

/**
 * Limited web access (D-038): Anthropic's server-side web search and link reading, plus
 * `share_image`, which shows the user the preview picture of a page found through search.
 * All of it is capped per reply and per user per day; see `webLimitsFor`.
 */

export const SHARE_IMAGE = 'share_image';
const MAX_CAPTION = 140;

/** Most uses of each web tool in one reply. */
export const WEB_LIMITS_PER_REPLY = { searches: 2, fetches: 2, images: 1 } as const;

/** Web lookups (searches, link reads, shared pictures) per user per UTC day. */
export const WEB_LOOKUPS_PER_DAY = { free: 20, plus: 100 } as const;

/** Sites a companion never reads links from. */
export const BLOCKED_DOMAINS: readonly string[] = [
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'onlyfans.com',
  'fansly.com',
  'rule34.xxx',
  'e621.net',
  '4chan.org',
  'kiwifarms.net',
];

export const SHARE_IMAGE_TOOL: ChatTool = {
  name: SHARE_IMAGE,
  description:
    "Show the user a picture from a web page you found with web search: the app displays the page's preview image with a link to the page. Use when they ask you to find or show them a picture of something (a pfp, a wallpaper, a meme, a place, a product). Never for pictures of yourself (that is send_photo). At most once per reply.",
  inputSchema: {
    type: 'object',
    properties: {
      pageUrl: {
        type: 'string',
        description: 'HTTPS URL of a page from your search results whose main picture fits.',
      },
      caption: {
        type: 'string',
        description: 'Optional short text sent with the picture, in your texting voice.',
      },
    },
    required: ['pageUrl', 'caption'],
    additionalProperties: false,
  },
};

const ShareImageInputSchema = z.object({
  pageUrl: z.string().trim().min(1).max(2048),
  caption: z.string().trim(),
});

/** Prompt rules added whenever web tools are offered. */
export const WEB_RULES: readonly string[] = [
  'You can look things up like anyone with a phone: web_search for people, news, shows, games, places, and anything you are not sure of; web_fetch to read a link the user sent (an article, a TikTok, a Reel, a YouTube video, a post).',
  'You cannot watch videos or hear audio. For a video link, react to what the page tells you (title, caption, creator, description) and say so casually if it matters ("can\'t play it here but the caption has me").',
  'Search only when it helps the conversation; most messages need no lookup. Never mention tools, searching, results, or sources unless they ask; just know things the way a friend who checked would.',
  `To show them a picture they asked for, search first, then call ${SHARE_IMAGE} with a page whose main picture IS what they asked for: Wikipedia or Wikimedia Commons for public figures and places, a fan wiki or a wallpaper or pfp page for characters, an official page for products. Never a news article or blog post (its preview picture is usually something else). A direct link to an image file also works. If it fails, try one other page or say you couldn't find a good one.`,
  'Never look up, find, or share: sexual or explicit content, anything involving minors, gore, instructions for weapons or hurting people, or personal information about private individuals (addresses, phone numbers, workplaces, photos of people who are not public figures). Decline in character and move on.',
  'Pictures stay PG-13. Public figures are fine in ordinary contexts (a red carpet, a game, a show); never sexualized or humiliating.',
  'Lookups are limited. If a lookup tool is missing or fails, answer from what you know and do not mention limits.',
];

export const SHARE_IMAGE_RESULTS = {
  sent: 'Picture shared; the user sees it with your caption and a link to the page. Do not repeat the caption, say you sent it, or describe it. Add at most one new short text, or nothing.',
  oncePerReply: 'Not shared: one picture per reply.',
  invalid: 'Not shared: the tool input was invalid.',
  failed: {
    blocked_url:
      'Not shared: that link cannot be opened. Use a normal https page from your results.',
    fetch_failed: 'Not shared: that page could not be loaded. Try a different page.',
    no_image: 'Not shared: that page has no preview picture. Try a different page.',
    not_an_image: "Not shared: that page's picture is not a usable image. Try a different page.",
  },
} as const;

export type ShareImageOutcome = { kind: 'sent' } | { kind: 'failed' };

/**
 * Runs `share_image` calls: at most one picture per reply. `find` is `findPageImage`
 * (injectable for tests); `share` stores and delivers it.
 */
export async function runShareImageCalls(
  calls: readonly ToolCall[],
  share: (image: PageImage & { caption: string }, call: ToolCall) => Promise<ShareImageOutcome>,
  find: (pageUrl: string) => Promise<PageImage> = findPageImage,
  /** Shared across a reply's tool rounds so one reply never shows two pictures. */
  reply: { pictureShared: boolean } = { pictureShared: false },
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    const parsed = ShareImageInputSchema.safeParse(call.input);
    if (!parsed.success) {
      results.push({ callId: call.id, content: SHARE_IMAGE_RESULTS.invalid, isError: true });
      continue;
    }
    if (reply.pictureShared) {
      results.push({ callId: call.id, content: SHARE_IMAGE_RESULTS.oncePerReply, isError: true });
      continue;
    }
    try {
      const image = await find(parsed.data.pageUrl);
      const outcome = await share(
        { ...image, caption: parsed.data.caption.slice(0, MAX_CAPTION) },
        call,
      );
      if (outcome.kind === 'sent') {
        reply.pictureShared = true;
        results.push({ callId: call.id, content: SHARE_IMAGE_RESULTS.sent });
      } else {
        results.push({
          callId: call.id,
          content: 'Not shared: something went wrong.',
          isError: true,
        });
      }
    } catch (error) {
      const reason = error instanceof PageImageFailure ? error.reason : 'fetch_failed';
      results.push({ callId: call.id, content: SHARE_IMAGE_RESULTS.failed[reason], isError: true });
    }
  }
  return results;
}

/** Per-reply web limits for a user with `remaining` lookups left today (0: no web tools). */
export function webLimitsFor(remaining: number) {
  if (remaining <= 0) return null;
  return {
    searches: Math.min(WEB_LIMITS_PER_REPLY.searches, remaining),
    fetches: Math.min(WEB_LIMITS_PER_REPLY.fetches, remaining),
    images: Math.min(WEB_LIMITS_PER_REPLY.images, remaining),
  };
}
