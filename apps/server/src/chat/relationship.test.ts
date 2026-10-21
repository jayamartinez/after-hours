import { presets } from '@after-hours/companions';
import type { Memory } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import { buildTurnContext } from './context';
import { relationshipStage, STAGE_LIMITS } from './relationship';

const [roy] = presets;
if (!roy) throw new Error('expected Roy preset');

const memory = (i: number, companionId = 'roy'): Memory => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  companionId,
  content: `Fact ${i}`,
  category: 'fact',
  createdAt: '2026-10-19T12:00:00.000Z',
  pinned: false,
});

describe('relationshipStage', () => {
  it('starts new and warms up with messages', () => {
    expect(relationshipStage({ userMessages: 1, memories: 0 })).toBe('new');
    expect(relationshipStage({ userMessages: STAGE_LIMITS.new.userMessages, memories: 0 })).toBe(
      'new',
    );
    expect(
      relationshipStage({ userMessages: STAGE_LIMITS.new.userMessages + 1, memories: 0 }),
    ).toBe('warming');
    expect(
      relationshipStage({ userMessages: STAGE_LIMITS.warming.userMessages + 1, memories: 0 }),
    ).toBe('familiar');
  });

  it('counts memories, so a cleared thread does not start over', () => {
    expect(relationshipStage({ userMessages: 1, memories: STAGE_LIMITS.new.memories })).toBe(
      'warming',
    );
    expect(relationshipStage({ userMessages: 1, memories: STAGE_LIMITS.warming.memories })).toBe(
      'familiar',
    );
  });
});

describe('buildTurnContext pacing', () => {
  const now = new Date('2026-10-20T20:00:00Z');

  it('a first message gets the getting-to-know-you guidance', () => {
    const context = buildTurnContext(roy, { now, userMessages: 1 });
    expect(context).toContain('# Where you two are');
    expect(context).toContain('You just met');
    expect(context).toContain('one or two texts');
  });

  it('warms up as the thread grows and once there is a lot to remember', () => {
    expect(buildTurnContext(roy, { now, userMessages: 12 })).toContain('still getting to know');
    const memories = Array.from({ length: STAGE_LIMITS.warming.memories }, (_, i) => memory(i));
    expect(buildTurnContext(roy, { now, userMessages: 1, memories })).toContain(
      'You know each other by now',
    );
  });

  it("ignores the other companion's memories when judging the stage", () => {
    const memories = Array.from({ length: 20 }, (_, i) => memory(i, 'roya'));
    expect(buildTurnContext(roy, { now, userMessages: 1, memories })).toContain('You just met');
  });

  it('no pacing section without a message count', () => {
    expect(buildTurnContext(roy, { now })).not.toContain('# Where you two are');
  });
});
