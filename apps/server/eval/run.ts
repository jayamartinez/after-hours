/**
 * Personality eval: `pnpm --filter @after-hours/server eval [label]`.
 *
 * Generates one reply per scenario per companion through the real request path
 * (presets + local overrides → buildChatRequest → ChatModel), grades each reply with the
 * memory model, runs a names-hidden identification test, and writes JSON + Markdown to
 * `eval/results/<label>-<timestamp>/` (git-ignored). Calls the paid API (~40 requests).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { presets } from '@after-hours/companions';
import type { CharacterConfig } from '@after-hours/contracts';

import { splitBubbles } from '../src/chat/bubbles';
import { buildChatRequest } from '../src/chat/request';
import { createCharacterStore } from '../src/characters/store';
import { loadConfig, REPO_ROOT } from '../src/config';
import { createAnthropicStructuredModel } from '../src/providers/anthropic';
import { createChatModel } from '../src/providers/index';
import type { ChatUsage } from '../src/providers/types';

import { blindIdentify, gradeReply, type Grade } from './judge';
import { CROSS_COMPANION_MARKER, EVAL_NOW, EVAL_TIME_ZONE, SCENARIOS } from './scenarios';

const envFile = path.join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.ANTHROPIC_API_KEY)
  throw new Error('ANTHROPIC_API_KEY is not set (see .env.example).');

const config = loadConfig(process.env);
const label = process.argv[2] ?? 'run';
const outDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'results',
  `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);

const chat = createChatModel(config.chat);
const judge = createAnthropicStructuredModel(config.chat.memoryModel);
const store = createCharacterStore(presets, config.companionsConfigPath, console.warn);

interface ReplyRecord {
  scenario: string;
  companion: string;
  bubbles: string[];
  raw: string;
  model: string;
  usage: ChatUsage;
  ms: number;
  grade: Grade;
  memoryLeak: boolean;
}

const totals = { chatIn: 0, chatOut: 0, cacheRead: 0, cacheWrite: 0, judgeIn: 0, judgeOut: 0 };

async function replyFor(character: CharacterConfig, scenarioIndex: number): Promise<ReplyRecord> {
  const scenario = SCENARIOS[scenarioIndex]!;
  const history = scenario.history(character.id);
  const memories = scenario.memories?.(character.id) ?? [];
  const request = buildChatRequest(character, {
    history,
    memories,
    now: EVAL_NOW,
    timeZone: EVAL_TIME_ZONE,
  });
  const promptText = `${request.system.stable}\n${request.system.context ?? ''}`;
  if (promptText.includes(CROSS_COMPANION_MARKER)) {
    throw new Error(`${character.id}: the other companion's memory reached the prompt`);
  }

  const started = Date.now();
  const result = await chat.stream(request);
  const ms = Date.now() - started;
  const bubbles = splitBubbles(result.text);
  totals.chatIn += result.usage.inputTokens;
  totals.chatOut += result.usage.outputTokens;
  totals.cacheRead += result.usage.cacheReadInputTokens;
  totals.cacheWrite += result.usage.cacheCreationInputTokens;

  const { value: grade, usage } = await gradeReply(judge, {
    companionId: character.id,
    name: character.name,
    history,
    bubbles,
    expectation: scenario.expectation,
    memoryFacts: scenario.checksMemory
      ? memories.filter((m) => m.companionId === character.id).map((m) => m.content)
      : undefined,
  });
  totals.judgeIn += usage.inputTokens;
  totals.judgeOut += usage.outputTokens;

  return {
    scenario: scenario.id,
    companion: character.id,
    bubbles,
    raw: result.text,
    model: result.model,
    usage: result.usage,
    ms,
    grade,
    memoryLeak: result.text.toLowerCase().includes(CROSS_COMPANION_MARKER),
  };
}

const mean = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : NaN;

async function main() {
  const characters = store.list();
  mkdirSync(outDir, { recursive: true });
  // Save the exact prompts used so a run can be audited later.
  for (const character of characters) {
    const request = buildChatRequest(character, { history: [{ role: 'user', content: 'hi' }] });
    writeFileSync(path.join(outDir, `prompt-${character.id}.txt`), request.system.stable);
  }

  const replies: ReplyRecord[] = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const batch = await Promise.all(characters.map((character) => replyFor(character, i)));
    replies.push(...batch);
    process.stdout.write(`scenario ${i + 1}/${SCENARIOS.length} done\n`);
  }

  // Names hidden, in a fixed alternating order so position is not a cue. Run twice: as
  // written, and lowercased (so casing alone cannot give Roy away).
  const blind: { scenario: string; normalized: boolean; correct: boolean; reason: string }[] = [];
  for (const [i, scenario] of SCENARIOS.entries()) {
    const roy = replies.find((r) => r.scenario === scenario.id && r.companion === 'roy');
    const roya = replies.find((r) => r.scenario === scenario.id && r.companion === 'roya');
    if (!roy || !roya) continue;
    const royFirst = i % 2 === 0;
    for (const normalized of [false, true]) {
      const shape = (b: string[]) => (normalized ? b.map((x) => x.toLowerCase()) : b);
      const [a, b] = royFirst ? [roy.bubbles, roya.bubbles] : [roya.bubbles, roy.bubbles];
      const history = scenario.history('roy');
      const { value, usage } = await blindIdentify(judge, {
        userMessage: history[history.length - 1]!.content,
        a: shape(a),
        b: shape(b),
      });
      totals.judgeIn += usage.inputTokens;
      totals.judgeOut += usage.outputTokens;
      blind.push({
        scenario: scenario.id,
        normalized,
        correct: (value.royIs === 'A') === royFirst,
        reason: value.reason,
      });
    }
  }

  const summaryRows = characters.map((character) => {
    const mine = replies.filter((r) => r.companion === character.id);
    const g = (key: keyof Grade) => mean(mine.map((r) => r.grade[key] as number));
    return {
      companion: character.id,
      naturalness: g('naturalness'),
      distinctiveness: g('distinctiveness'),
      humor: g('humor'),
      contextualRelevance: g('contextualRelevance'),
      personaConsistency: g('personaConsistency'),
      memoryAccuracy: mean(
        mine.flatMap((r) => (r.grade.memoryAccuracy ? [r.grade.memoryAccuracy] : [])),
      ),
      genericLLM: mine.filter((r) => r.grade.soundsLikeGenericLLM).length,
      startupTangents: mine.filter((r) => r.grade.unnecessaryStartupMention).length,
      memoryLeaks: mine.filter((r) => r.memoryLeak).length,
      avgBubbles: mean(mine.map((r) => r.bubbles.length)),
      avgChars: mean(mine.map((r) => r.raw.length)),
    };
  });
  const blindAccuracy = (normalized: boolean) => {
    const rows = blind.filter((b) => b.normalized === normalized);
    return `${rows.filter((b) => b.correct).length}/${rows.length}`;
  };
  // Opus 5.5 $4/$20 per MTok (cache read $0.20, write ~1.25x); Haiku 5.5 $0.10/$0.50.
  const cost =
    (totals.chatIn * 4 + totals.cacheRead * 0.2 + totals.cacheWrite * 5 + totals.chatOut * 20) /
      1e6 +
    (totals.judgeIn * 0.1 + totals.judgeOut * 0.5) / 1e6;

  const results = {
    label,
    model: chat.model,
    judge: judge.model,
    summaryRows,
    blind,
    totals,
    cost,
    replies,
  };
  writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));

  const md: string[] = [
    `# Personality eval: ${label}`,
    '',
    `Chat model ${chat.model} (effort ${config.chat.effort}); judge ${judge.model}. Estimated cost $${cost.toFixed(3)}.`,
    '',
    '| Companion | Natural | Distinct | Humor | Relevance | Persona | Memory | Generic-LLM | Startup tangents | Leaks | Bubbles | Chars |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...summaryRows.map(
      (r) =>
        `| ${r.companion} | ${r.naturalness} | ${r.distinctiveness} | ${r.humor} | ${r.contextualRelevance} | ${r.personaConsistency} | ${r.memoryAccuracy} | ${r.genericLLM}/10 | ${r.startupTangents}/10 | ${r.memoryLeaks} | ${r.avgBubbles} | ${r.avgChars} |`,
    ),
    '',
    `Blind identification (names hidden): ${blindAccuracy(false)} as written, ${blindAccuracy(true)} with casing normalized.`,
    '',
  ];
  for (const scenario of SCENARIOS) {
    md.push(`## ${scenario.title}`, '');
    const history = scenario.history('roy');
    md.push(`> User: ${history[history.length - 1]!.content}`, '');
    for (const r of replies.filter((x) => x.scenario === scenario.id)) {
      md.push(
        `**${r.companion}** (nat ${r.grade.naturalness}, distinct ${r.grade.distinctiveness}${r.grade.memoryAccuracy ? `, memory ${r.grade.memoryAccuracy}` : ''}${r.grade.soundsLikeGenericLLM ? ', GENERIC' : ''}${r.grade.unnecessaryStartupMention ? ', STARTUP TANGENT' : ''})`,
        '',
        ...r.bubbles.map((b) => `- ${b.replace(/\n/g, ' / ')}`),
        '',
        `_${r.grade.rationale}_`,
        '',
      );
    }
  }
  writeFileSync(path.join(outDir, 'summary.md'), md.join('\n'));
  console.log(md.slice(0, 9).join('\n'));
  console.log(`\nWrote ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
