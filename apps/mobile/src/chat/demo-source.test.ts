import { presets, toPublicCharacter } from '@after-hours/companions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDemoThread, demoReply } from './demo-data';
import { createDemoConversationSource, type DemoTiming } from './demo-source';

const companions = presets.map((preset) => toPublicCharacter(preset));
const roy = companions[0]!;
const roya = companions[1]!;

const TIMING: DemoTiming = {
  sent: 100,
  read: 200,
  typingStart: 300,
  typingBase: 500,
  typingPerChar: 0,
  typingMax: 500,
};
const NOW = new Date('2026-10-16T23:52:00').getTime();

describe('demo thread', () => {
  it('is built only from the companion config', () => {
    const thread = buildDemoThread(roy, NOW);
    const config = [
      ...roy.copy.firstMessage,
      ...roy.examples.starters,
      ...roy.examples.signatureLines,
      '',
    ];
    for (const message of thread) expect(config).toContain(message.content);
    expect(thread[0]?.content).toBe(roy.copy.firstMessage[0]);
  });

  it('shows every bubble type and keeps chronological order', () => {
    const thread = buildDemoThread(roya, NOW);
    expect(new Set(thread.map((m) => m.kind))).toEqual(new Set(['text', 'voice', 'image']));
    const times = thread.map((m) => Date.parse(m.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(thread.filter((m) => m.role === 'user').every((m) => m.status === 'read')).toBe(true);
  });

  it('cycles canned replies through signature lines', () => {
    const lines = roy.examples.signatureLines;
    expect(demoReply(roy, 0)).toBe(lines[2 % lines.length]);
    expect(demoReply(roy, lines.length)).toBe(demoReply(roy, 0));
  });
});

describe('demo conversation source', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const source = createDemoConversationSource({ timing: TIMING, now: () => Date.now() });
    const listener = vi.fn();
    source.subscribe(roy.id, listener);
    return { source, listener, state: () => source.getSnapshot(roy.id) };
  };

  it('starts empty and seeds once on load', () => {
    const { source, state, listener } = setup();
    expect(state().loaded).toBe(false);
    source.load(roy);
    const seeded = state();
    expect(seeded.loaded).toBe(true);
    expect(seeded.messages.length).toBeGreaterThan(0);
    source.load(roy);
    expect(state()).toBe(seeded);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps conversations independent per companion', () => {
    const { source } = setup();
    source.load(roy);
    expect(source.getSnapshot(roya.id).messages).toEqual([]);
  });

  it('runs send → sent → read → typing → canned reply', () => {
    const { source, state } = setup();
    source.send(roy, '  ship it  ');
    const sent = state().messages.at(-1)!;
    expect(sent).toMatchObject({ role: 'user', content: 'ship it', status: 'sending' });

    vi.advanceTimersByTime(TIMING.sent);
    expect(state().messages.at(-1)?.status).toBe('sent');

    vi.advanceTimersByTime(TIMING.read - TIMING.sent);
    expect(state().messages.at(-1)?.status).toBe('read');
    expect(state().typing).toBe(false);

    vi.advanceTimersByTime(TIMING.typingStart - TIMING.read);
    expect(state().typing).toBe(true);

    vi.advanceTimersByTime(TIMING.typingBase);
    const reply = state().messages.at(-1)!;
    expect(state().typing).toBe(false);
    expect(reply).toMatchObject({ role: 'assistant', kind: 'text', content: demoReply(roy, 0) });
  });

  it('answers a quick burst of sends with one reply', () => {
    const { source, state } = setup();
    source.send(roy, 'one');
    vi.advanceTimersByTime(150);
    source.send(roy, 'two');
    vi.runAllTimers();
    const tail = state().messages.slice(-3);
    expect(tail.map((m) => [m.role, m.content])).toEqual([
      ['user', 'one'],
      ['user', 'two'],
      ['assistant', demoReply(roy, 0)],
    ]);
    expect(tail.slice(0, 2).every((m) => m.status === 'read')).toBe(true);
  });

  it('ignores blank messages', () => {
    const { source, state } = setup();
    source.load(roy);
    const before = state();
    source.send(roy, '   ');
    expect(state()).toBe(before);
  });

  it('toggles reactions', () => {
    const { source, state } = setup();
    source.load(roy);
    const target = state().messages[0]!;
    source.toggleReaction(roy.id, target.id, 'ha');
    expect(state().messages[0]?.reactions).toContain('ha');
  });
});
