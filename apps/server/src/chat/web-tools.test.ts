import { describe, expect, it } from 'vitest';

import { PageImageFailure } from './page-image';
import { runShareImageCalls, SHARE_IMAGE, SHARE_IMAGE_RESULTS, webLimitsFor } from './web-tools';

const call = (id: string, input: unknown) => ({ id, name: SHARE_IMAGE, input });
const found = { url: 'https://cdn.x/a.jpg', pageUrl: 'https://x/a', title: 'A' };

describe('runShareImageCalls', () => {
  it('shares one picture per reply and answers every call', async () => {
    const shared: unknown[] = [];
    const results = await runShareImageCalls(
      [
        call('1', { pageUrl: 'https://x/a', caption: 'this one' }),
        call('2', { pageUrl: 'https://x/b', caption: '' }),
      ],
      async (image) => {
        shared.push(image);
        return { kind: 'sent' };
      },
      async () => found,
    );
    expect(shared).toEqual([{ ...found, caption: 'this one' }]);
    expect(results).toEqual([
      { callId: '1', content: SHARE_IMAGE_RESULTS.sent },
      { callId: '2', content: SHARE_IMAGE_RESULTS.oncePerReply, isError: true },
    ]);
  });

  it('reports why a page failed so the model can try another', async () => {
    const results = await runShareImageCalls(
      [call('1', { pageUrl: 'https://x/a', caption: '' }), call('2', { nope: true })],
      async () => ({ kind: 'sent' }),
      async () => {
        throw new PageImageFailure('no_image');
      },
    );
    expect(results).toEqual([
      { callId: '1', content: SHARE_IMAGE_RESULTS.failed.no_image, isError: true },
      { callId: '2', content: SHARE_IMAGE_RESULTS.invalid, isError: true },
    ]);
  });
});

describe('webLimitsFor', () => {
  it('caps each tool per reply and turns web off when the day is used up', () => {
    expect(webLimitsFor(20)).toEqual({ searches: 2, fetches: 2, images: 1 });
    expect(webLimitsFor(1)).toEqual({ searches: 1, fetches: 1, images: 1 });
    expect(webLimitsFor(0)).toBeNull();
  });
});
