import { presets } from '@after-hours/companions';
import type { UserProfile } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import { adaptationLines, describeProfile, prefsFromProfile } from './profile';
import { buildSystemPrompt } from './prompt';

const [roy] = presets;
if (!roy) throw new Error('expected Roy preset');

const neutral: UserProfile = {
  lookingFor: [],
  values: [],
  dynamic: { x: 0, y: 0 },
  textingLength: 2,
};

describe('adaptationLines', () => {
  it('turns each answer into behavior, values first', () => {
    const lines = adaptationLines({
      lookingFor: ['banter', 'curious'],
      values: ['challenges', 'laugh'],
      dynamic: { x: 0.8, y: 0.8 },
      textingLength: 4,
    });
    expect(lines[0]).toContain('Push back on their takes');
    expect(lines[1]).toContain('Lean into humor');
    expect(lines.join('\n')).toContain('volley back');
    expect(lines.join('\n')).toContain('Tease them readily');
    expect(lines.join('\n')).toContain('what is underneath');
    expect(lines.join('\n')).toContain('Longer, more thoughtful');
  });

  it('neutral answers change nothing', () => {
    expect(adaptationLines(neutral)).toEqual([]);
    expect(buildSystemPrompt(roy, prefsFromProfile(neutral))).not.toContain('# Tuned to them');
  });
});

describe('prefsFromProfile', () => {
  it('a gentle vibe lowers the roast level; nothing raises it', () => {
    expect(prefsFromProfile({ ...neutral, dynamic: { x: -0.9, y: 0 } }).roastCap).toBe(1);
    expect(prefsFromProfile({ ...neutral, dynamic: { x: 0.9, y: 0 } }).roastCap).toBeUndefined();
    expect(prefsFromProfile(null)).toEqual({});
  });

  it('two users with different answers get different prompts for the same character', () => {
    const calm = buildSystemPrompt(
      roy,
      prefsFromProfile({ ...neutral, values: ['calm'], dynamic: { x: -0.9, y: -0.9 } }),
    );
    const spicy = buildSystemPrompt(
      roy,
      prefsFromProfile({ ...neutral, values: ['challenges'], dynamic: { x: 0.9, y: 0.9 } }),
    );
    expect(calm).toContain('Stay steady and unhurried');
    expect(calm).toContain('Tease gently');
    expect(spicy).toContain('Push back on their takes');
    expect(spicy).not.toContain('Tease gently');
  });
});

describe('describeProfile', () => {
  it('handles skipped questions', () => {
    const text = describeProfile(neutral);
    expect(text).not.toContain('Looking for');
    expect(text).toContain('between gentle and teasing');
    expect(text).toContain('medium length');
  });
});
