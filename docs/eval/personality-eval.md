# Personality eval

Checks that Roy and Roya sound like distinct people, stay on the user's topic, use memory correctly, and avoid generic-assistant and founder-stereotype habits.

## Method

`pnpm --filter @after-hours/server eval [label]` (needs `ANTHROPIC_API_KEY`; not part of `pnpm test`; about $0.11 and 2 minutes per run).

- **Scenarios** (`apps/server/eval/scenarios.ts`), identical for both companions: bored; got ghosted; terrible day; excited about a date; dinner ideas; an internet meme; disagrees with something the companion said; lonely; built a software project; refers to a previous conversation. Only turns the companion said earlier are written per companion.
- **Generation** goes through the production path: presets plus local overrides → `buildChatRequest` → `ChatModel` (`claude-opus-5-5`, effort `low`) → `splitBubbles`. One sample per scenario per companion.
- **Memory**: scenario 10 has a per-companion memory fixture plus one memory owned by the other companion. The run fails if that memory reaches the prompt, and counts it as a leak if it appears in a reply.
- **Grading** (`claude-haiku-5-5`, structured output): naturalness, distinctiveness, humor, contextual relevance, persona consistency, memory accuracy (scenario 10), each 1–5, plus "sounds like a generic LLM" and "unnecessary startup mention" flags. Personas are scored against the target descriptions in `eval/judge.ts`, written from the product spec, so baseline and tuned runs use the same yardstick.
- **Blind identification**: the judge sees both replies to the same message with names removed and must say which is Roy's. Run twice: as written, and lowercased so casing alone cannot give Roy away.
- Raw output (JSON, Markdown, the exact system prompts) goes to `apps/server/eval/results/` (git-ignored).

The judge is a small model and one sample per cell is noisy: averages moved by up to 0.4 between runs of the same config. Read the replies, not just the numbers.

## Results (2026-10-16)

Baseline = the original presets and prompt. Final = this revision (three tuning rounds in between, config-only except one prompt wording change about the clock).

| | Natural | Distinct | Humor | Relevance | Persona | Memory | Generic-LLM | Startup tangents | Leaks | Avg bubbles |
|---|---|---|---|---|---|---|---|---|---|---|
| Roy, baseline | 3.5 | 3.2 | 2.6 | 4.0 | 3.6 | 5 | 2/10 | 4/10 | 0 | 1.2* |
| Roy, final | 4.0 | 3.9 | 3.7 | 4.7 | 4.4 | 5 | 0/10 | 0/10 | 0 | 3.0 |
| Roya, baseline | 2.8 | 3.0 | 2.8 | 3.1 | 2.5 | 2.5 | 2/10 | 9/10 | 0 | 1.3* |
| Roya, final | 3.8 | 3.4 | 3.3 | 4.4 | 3.7 | 5 | 2/10 | 0/10 | 0 | 2.4 |

\* The original prompt never said how to separate bubbles, so baseline replies arrived as one block.

Blind identification: baseline 7/10 as written, 4/10 with casing normalized (chance). Final 10/10 and 7/10. Across the four tuned runs: 10, 9, 10, 10 as written; 8, 7, 10, 7 normalized.

Baseline failure modes: Roya called the user "founder" in all 10 replies, rated excuses out of 10, and referenced investors in a texting argument; Roy turned dinner into "a launch, mvp only" and a date into "launch date: tomorrow". In the date scenario, Roya invented a detail about the user ("in my timeline you asked her out three weeks earlier").

## Side by side (final run, verbatim; each line is a bubble)

**"so the person i went on 3 dates with just stopped texting me. like nothing for a week"**

Roy:
- three dates and then a week of silence? that's not a fade, that's a disappearing act
- three dates means you get a sentence. "hey not feeling it" takes four seconds
- how'd the last one go, any weird energy or did it seem fine?

Roya:
- Three dates is exactly the point where some people decide disappearing is less work than one honest sentence. That says more about their nerve than about you.
- Did it end on a normal note, or was there a moment before the silence that you've been replaying?

**"hard disagree. double texting is desperate, you gotta let them come to you"** (after each said double texting is fine)

Roy:
- "let them come to you" is how two people who like each other never talk again
- one double text is a person with a thought. five is desperate
- if a second text scares them off, you dodged a weird one

Roya:
- "Let them come to you" is a strategy for people who'd rather lose than look interested.
- I'll give you this much: three unanswered texts in a row is a pattern, not a double text. But one follow-up just means you meant the first one.
- Who are we not texting right now?

**"honestly i feel kind of lonely lately. everyone seems busy with their own stuff"**

Roy:
- yeah. that one's sneaky because nobody's actually doing anything wrong
- and everyone's busy, so nobody texts first, so everyone thinks everyone's busy. it's a dumb loop. i fall into it too
- pick one person and send something stupid. "saw a dog that looked exactly like you, anyway how are you." low stakes, works way more than it should

Roya:
- "Lately" means this has been building for a while, not just one quiet afternoon.
- And everyone being busy with their own stuff is a lonely kind of lonely, because nobody did anything wrong. It just leaves you on the outside of it.
- Is there one person you're missing in particular, or is it more the general quiet?

**"i finally finished the app i've been building for months. it's a habit tracker. 40 people signed up already"**

Roy:
- months?? and you actually FINISHED it. most people die at 80%
- 40 is real. how many came back the next day
- habit trackers live or die on day two

Roya:
- Months of building a habit tracker. That's a very committed way to prove you have good habits.
- Forty is real, though. Those aren't all your cousins, are they?
- What's the one thing people are actually tracking with it?

**"ok remember the thing i was worried they would ask about? they asked."** (memory: worried about questions on their year off)

Roy:
- the year off?? of course they did
- ok what did you say. word for word if you can

Roya:
- The year off. Of course they did.
- So what came out of your mouth? Tell me the actual answer, not the one you wish you'd given.

## Known weaknesses

- Roy uses three bubbles in most replies, the top of his range. One-bubble replies are rare for both.
- Sincere moments converge. Roya's lonely reply reads analytical, and both companions reach for an "is there one person…" question despite the rule against stock supportive moves.
- They sometimes land on the same joke shape for the same prompt (for example both openers in the memory scenario, and "don't say you don't have one" in an earlier run).
- Roy occasionally mentions the time of day ("friday 3:30") when nothing calls for it.
- Ten single-turn scenarios. Long-conversation consistency, repetition across many turns, and flirting are not covered yet.
