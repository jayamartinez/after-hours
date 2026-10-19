import { describe, expect, it } from 'vitest';

import { CreateMemoryRequestSchema, MAX_MEMORY_CHARS, UpdateMemoryRequestSchema } from './memory';

describe('memory requests', () => {
  it('trims content and defaults the category to fact', () => {
    expect(CreateMemoryRequestSchema.parse({ content: '  Has a dog named Pixel ' })).toEqual({
      content: 'Has a dog named Pixel',
      category: 'fact',
    });
  });

  it('accepts a chat message id for "Remember this"', () => {
    expect(CreateMemoryRequestSchema.parse({ messageId: 'abc' })).toEqual({ messageId: 'abc' });
  });

  it('rejects empty and overlong content', () => {
    expect(CreateMemoryRequestSchema.safeParse({ content: '   ' }).success).toBe(false);
    const long = 'x'.repeat(MAX_MEMORY_CHARS + 1);
    expect(CreateMemoryRequestSchema.safeParse({ content: long }).success).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(UpdateMemoryRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateMemoryRequestSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(UpdateMemoryRequestSchema.safeParse({ content: 'Moved to Lisbon' }).success).toBe(true);
  });
});
