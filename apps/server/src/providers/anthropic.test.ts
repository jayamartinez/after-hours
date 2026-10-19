import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toOutputSchema } from './anthropic';

describe('toOutputSchema', () => {
  it('drops keywords structured outputs reject, keeping the shape', () => {
    const schema = z.object({
      items: z.array(z.object({ score: z.number().min(0).max(1) })).max(10),
    });
    const json = JSON.stringify(toOutputSchema(schema));
    for (const key of ['$schema', 'minimum', 'maximum', 'maxItems']) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).toContain('"score"');
    expect(json).toContain('"required"');
  });
});
