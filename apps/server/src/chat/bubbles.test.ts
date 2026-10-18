import { describe, expect, it } from 'vitest';

import { createBubbleSplitter, MAX_BUBBLES, splitBubbles } from './bubbles';

describe('splitBubbles', () => {
  it.each([
    ['one line', 'ok fair', ['ok fair']],
    ['blank-line separated texts', 'wait\n\nwho said that', ['wait', 'who said that']],
    ['extra blank lines and whitespace', '  one \n\n\n \n two  ', ['one', 'two']],
    ['CRLF line endings', 'one\r\n\r\ntwo', ['one', 'two']],
    [
      'a single newline stays inside a bubble',
      'eggs + toast\nor a quesadilla',
      ['eggs + toast\nor a quesadilla'],
    ],
    ['empty reply', '   \n\n ', []],
  ])('%s', (_case, text, expected) => {
    expect(splitBubbles(text)).toEqual(expected);
  });

  it(`folds anything past ${MAX_BUBBLES} bubbles into the last one`, () => {
    expect(splitBubbles('a\n\nb\n\nc\n\nd\n\ne\n\nf')).toEqual(['a', 'b', 'c', 'd\ne\nf']);
  });
});

describe('createBubbleSplitter', () => {
  const texts = [
    'ok fair',
    'wait\n\nwho said that',
    '  one \n\n\n \n two  ',
    'one\r\n\r\ntwo',
    'eggs + toast\nor a quesadilla\n\nfinal answer',
    'a\n\nb\n\nc\n\nd\n\ne\n\nf',
    '   \n\n ',
    '\n\nleading blank\n\n\n\ntrailing\n\n',
  ];

  /** Deterministic pseudo-random chunk sizes. */
  function chunk(text: string, seed: number): string[] {
    const out: string[] = [];
    let i = 0;
    let s = seed;
    while (i < text.length) {
      s = (s * 9301 + 49297) % 233280;
      const size = 1 + (s % 5);
      out.push(text.slice(i, i + size));
      i += size;
    }
    return out;
  }

  it.each(texts)('matches splitBubbles for any chunking: %j', (text) => {
    for (let seed = 1; seed <= 25; seed++) {
      const splitter = createBubbleSplitter();
      const bubbles = chunk(text, seed).flatMap((piece) => splitter.push(piece));
      bubbles.push(...splitter.finish());
      expect(bubbles).toEqual(splitBubbles(text));
    }
  });

  it('emits a bubble before the reply is finished', () => {
    const splitter = createBubbleSplitter();
    expect(splitter.push('first text')).toEqual([]);
    expect(splitter.push('\n\nsecond')).toEqual(['first text']);
    expect(splitter.finish()).toEqual(['second']);
  });
});
