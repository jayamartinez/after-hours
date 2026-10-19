import { presets } from '@after-hours/companions';
import type { Memory } from '@after-hours/contracts';
import { describe, expect, it } from 'vitest';

import { scriptedStructuredModel } from '../test-chat';

import {
  buildExtractionPrompt,
  buildExtractionSystem,
  extractMemories,
  MAX_NEW_PER_EXCHANGE,
} from './memory-extract';

const [roy] = presets;
if (!roy) throw new Error('expected the Roy preset');

const turns = [
  { role: 'user' as const, content: 'my sister ines is visiting next week' },
  { role: 'assistant' as const, content: 'oh nice, first time in town?' },
];

const known = (content: string): Memory => ({
  id: 'm1',
  companionId: 'roy',
  content,
  category: 'relationship',
  createdAt: new Date().toISOString(),
  pinned: false,
});

const candidate = (content: string, confidence = 0.9, category = 'fact') => ({
  content,
  category,
  confidence,
});

describe('extractMemories', () => {
  it('keeps confident, new candidates and drops low-confidence ones', async () => {
    const { model, script } = scriptedStructuredModel();
    script.push({
      memories: [
        candidate('Has a sister named Ines', 0.95, 'relationship'),
        candidate('Ines visits next week', 0.8, 'event'),
        candidate('Seems tired', 0.3),
      ],
    });
    expect(await extractMemories(model, roy, { turns, existing: [] })).toEqual([
      { content: 'Has a sister named Ines', category: 'relationship' },
      { content: 'Ines visits next week', category: 'event' },
    ]);
  });

  it('drops what is already known (normalized) and repeats within one answer', async () => {
    const { model, script } = scriptedStructuredModel();
    script.push({
      memories: [
        candidate('has a sister named Ines!'),
        candidate('Ines visits next week'),
        candidate('Ines visits next week.'),
      ],
    });
    const result = await extractMemories(model, roy, {
      turns,
      existing: [known('Has a sister named Ines')],
    });
    expect(result.map((m) => m.content)).toEqual(['Ines visits next week']);
  });

  it(`caps new memories at ${MAX_NEW_PER_EXCHANGE} per exchange`, async () => {
    const { model, script } = scriptedStructuredModel();
    script.push({ memories: ['a', 'b', 'c', 'd', 'e'].map((x) => candidate(`Fact ${x}`)) });
    expect(await extractMemories(model, roy, { turns, existing: [] })).toHaveLength(
      MAX_NEW_PER_EXCHANGE,
    );
  });

  it('does not call the model when memory is disabled or the exchange has no user turn', async () => {
    const { model, requests } = scriptedStructuredModel();
    const disabled = { ...roy, memory: { ...roy.memory, enabled: false } };
    expect(await extractMemories(model, disabled, { turns, existing: [] })).toEqual([]);
    expect(
      await extractMemories(model, roy, {
        turns: [{ role: 'assistant', content: 'hey' }],
        existing: [],
      }),
    ).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('anchors the prompt to today in the user’s time zone', () => {
    const prompt = buildExtractionPrompt({
      turns,
      existing: [],
      now: new Date('2026-10-18T02:00:00Z'),
      timeZone: 'America/Los_Angeles',
    });
    expect(prompt).toContain('Today is Saturday, October 17, 2026.');
  });

  it('tells the model what this companion cares about and what never to store', () => {
    const system = buildExtractionSystem(roy);
    for (const focus of roy.memory.focus) expect(system).toContain(focus);
    expect(system).toContain('Never store passwords');
    expect(system).toContain(`never extract what ${roy.name} said`);
  });
});
