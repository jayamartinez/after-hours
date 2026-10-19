import { presets, toPublicCharacter } from '@after-hours/companions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDemoThread, demoLines, demoReply } from './demo-data';
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
    const config = [...demoLines(roy), ...roy.publicProfile.starters, ''];
    for (const message of thread) expect(config).toContain(message.content);
    expect(thread[0]?.content).toBe(roy.publicProfile.copy.firstMessage[0]);
  });

  it('shows every bubble type and keeps chronological order', () => {
    const thread = buildDemoThread(roya, NOW);
    expect(new Set(thread.map((m) => m.kind))).toEqual(new Set(['text', 'voice', 'image']));
    const times = thread.map((m) => Date.parse(m.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(thread.filter((m) => m.role === 'user').every((m) => m.status === 'read')).toBe(true);
  });

  it('cycles canned replies through the public demo lines', () => {
    const lines = demoLines(roy);
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

  it('start opens a fresh thread with only the opening lines, typed one by one', () => {
    const { source, state } = setup();
    source.start(roy);
    expect(state()).toMatchObject({ loaded: true, messages: [], typing: false });

    vi.advanceTimersByTime(TIMING.typingStart);
    expect(state().typing).toBe(true);

    vi.runAllTimers();
    expect(state().typing).toBe(false);
    expect(state().messages.map((m) => [m.role, m.content])).toEqual(
      roy.publicProfile.copy.firstMessage.map((line) => ['assistant', line]),
    );
  });

  it('start keeps existing history, and a later load keeps the started thread', () => {
    const { source, state } = setup();
    source.load(roy);
    const seeded = state();
    source.start(roy);
    expect(state()).toBe(seeded);

    source.start(roya);
    vi.runAllTimers();
    const started = source.getSnapshot(roya.id);
    source.load(roya);
    expect(source.getSnapshot(roya.id)).toBe(started);
  });

  it('a send during the opening lines does not cancel them', () => {
    const { source, state } = setup();
    source.start(roy);
    source.send(roy, 'hey');
    vi.runAllTimers();
    const assistant = state().messages.filter((m) => m.role === 'assistant');
    expect(assistant.map((m) => m.content)).toEqual([
      ...roy.publicProfile.copy.firstMessage,
      demoReply(roy, 0),
    ]);
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
