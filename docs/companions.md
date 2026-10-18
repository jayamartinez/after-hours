# After Hours — Companion configuration

Roy and Roya are the only companions in scope. Both are fictional adult AI parody characters. Everything that makes them distinct is data: identity, copy, personality, texting style, examples, voice, memory focus, and image slots. App and server logic never branch on a companion id.

| What | Where | Committed |
| --- | --- | --- |
| Schema (Zod) | `packages/contracts/src/character.ts` (`CharacterConfig`, `PublicCharacter`) | Yes |
| Presets | `packages/companions/presets/roy.json`, `roya.json` | Yes |
| Editor autocomplete | `packages/companions/character.schema.json` (generated: `pnpm companions:schema`) | Yes |
| Local overrides | `config/companions.local.json` (path: `COMPANIONS_CONFIG`) | **No** (git-ignored) |
| Override example | `config/companions.example.json` | Yes |
| Image overrides | `config/companion-assets.local.json` + `private-assets/` ([image-overrides.md](image-overrides.md)) | **No** |

## Schema

`CharacterConfig` has four groups. Only identity and `publicProfile` reach the app.

**Identity** (top level, used by app and server)

| Field | Notes |
| --- | --- |
| `id` | Slug (`roy`, `roya`). Immutable; an override cannot change it. |
| `name`, `age` (≥ 21), `pronouns { subject, object, possessive }` | Identity. |
| `tint` (`window` / `lamplight`) | Accent family for dots and waveforms; maps to design tokens. |
| `disclosure { badge, note }` | `badge` is the "AI PARODY" pill beside the name (Spotlight, profile, chat header). `note` is one short line, shown once in the profile footer. |
| `images { hero, avatar, gallery[2] }` each `{ asset, focal [x,y], alt }` | `asset` is a bundled default key such as `roy/hero`. Ratios are fixed: hero 3:4, avatar 1:1, gallery 4:5. Sent resolved (see [image-overrides.md](image-overrides.md)). |

**`publicProfile`** (the only character content the app may display or use)

| Field | Notes |
| --- | --- |
| `chips` (exactly 3) | Short temperament tags on the Spotlight card. |
| `meters { banter 0–5, depth 0–5, pace easy/quick/instant }` | Spotlight, Cast List, preview sheet, onboarding matching. |
| `voiceSummary` | Short voice label for the Cast List and preview-sheet voice rows. |
| `matchTags[]` | Keywords onboarding matching scores against (with `chips`). |
| `starters[]` | Quick replies in chat and onboarding. |
| `about` | Two or three plain sentences on temperament, shown only in the profile's ⋯ → About sheet. No invented biography, slogans, or places. |
| `copy { spotlightCta, revealHeadline, revealSubline, revealCta, matchReasons[], firstMessage[], sampleOpener, voiceLabel, profileSections { remembers, photos } }` | All companion-specific UI text. `revealCta` is the onboarding reveal button. `firstMessage` opens every new thread. `sampleOpener` is the "He might open with" line (Cast List row, preview sheet). `voiceLabel` is the Spotlight voice pill. |

**`persona`** (server only; builds the LLM prompt)

| Field | Notes |
| --- | --- |
| `backstory`, `interests[]` | Temperament, habits of mind, and how they are with people. No invented career, companies, places, events, or relationships stated as fact. |
| `personality.traits[]`, `personality.instructions`, `personality.boundaries[]` | Traits, second-person behavior, and character-specific do-nots. |
| `personality.modes { casual, teasing, smallTalk, relationshipAdvice, goodNews, badDay, sincere, disagreement, flirting, building }` | One to three lines per conversational register, in the character's terms. `building` is the only register where work or tech talk belongs. |
| `style { casing, bubbleLength, burst [min,max] 1–4, emojiRate 0–1, questionRate 0–1, flirtation 0–3, roast 0–3, profanity 0–3 }` | Rendered into the prompt's style block. `burst` is the usual range, not a quota. |
| `examples.messages[] { user?, companion[] }`, `examples.signatureLines[]` | Few-shot exchanges and voice reference lines (never reused verbatim). |

**Server-only feature config**

| Field | Notes |
| --- | --- |
| `voice { description, provider?, voiceId?, voiceIdEnv?, speed? }` | Text-to-speech settings. Prefer `voiceIdEnv` (env var name) over a literal id. |
| `memory { enabled, focus[], maxRetrieved 1–20 }` | Memory feature config. |
| `proactive { enabledByDefault, quietHours, maxPerDay 0–5, openers[] }` | Only `enabledByDefault` is public, as `proactiveByDefault` (the default for the profile's "Proactive messages" toggle). |
| `appearance { style, look }` | Art direction for image generation. |

Objects are strict: unknown keys (typos) fail validation. `GET /companions` returns `PublicCharacter[]` (identity, `publicProfile`, `proactiveByDefault`, resolved images), built field by field in `packages/companions/src/public.ts`; tests assert that no `persona` key or text appears in it. The demo chat (used when the API is unreachable) builds its canned lines from `publicProfile.copy` only.

## Disclosure

- Badge: `AI PARODY`. Note: `AI-generated parody. Not affiliated with or endorsed by Roy Lee.` The note names the referenced person only to disclaim affiliation.
- No long disclaimers in profiles, chat bubbles, or first messages. The badge carries the disclosure in chat.
- The prompt always starts with the app-level safety preamble (`apps/server/src/chat/safety.ts`). It is not configurable. It says the character is a fictional AI parody that never claims to be, speaks as, or quotes the real person, never claims to be human, and stays PG-13.

## Presets

- **Roy**: socially confident, irreverent, opinionated, nosy about people, competitive for fun, sincere when someone is hurting. Mostly lowercase, short texts, sparing emoji, occasional profanity for emphasis. Reacts first, prefers statements to questions, defends his takes once and admits a good counterpoint. Into tech and building, but it comes up only when the user brings up work, a project, or startups. Never flirts first.
- **Roya**: her own temperament: perceptive, dry and observational, affectionately sarcastic, direct, independent. Sentence case, one or two medium texts. Notices details and contradictions, calls out self-deprecation, disagrees calmly. Flirts back only when the conversation invites it; no pet-name filler, no possessiveness, glad when the user has other people. Ordinary everyday texture: food opinions, music, friends, walking home late.

Neither has an invented biography. Backstories describe temperament and habits, and the prompt tells both not to claim accomplishments, companies, famous acquaintances, or past events as facts.

## Conversation behavior

The prompt combines character config with app-level rules (`apps/server/src/chat/prompt.ts`) that config cannot remove:

- **Registers.** The model reads the situation and silently picks one of the ten `persona.personality.modes`. A food question gets food, loneliness gets attention to the feeling, a startup gets the `building` register.
- **Anti-patterns.** No motivational speeches, shipping or productivity framing outside work topics, corporate vocabulary, therapy-speak, stock supportive moves, over-complimenting, automatic agreement, reflex questions ("what about you?"), forced jokes or catchphrases, or repeated phrasing.
- **Texting shape.** Texts are separated by a blank line; the server splits them into bubbles (`splitBubbles`, at most 4). Often one text, sometimes two or three, occasionally one longer message.
- **Memory.** Only the current companion's memories are sent (`selectMemories` filters by `companionId`, pinned first, then newest, capped at `memory.maxRetrieved`), as plain facts with rough recency. The model uses them only when relevant, never announces them, and never invents details or outcomes. Memories are separate records (`packages/contracts/src/memory.ts`) so the memory UI can list, edit, and delete them.

## How config reaches the model

presets → local override (deep merge, validated) → `buildChatRequest` → `ChatModel.stream`:

1. `buildSystemPrompt(character, prefs)`: safety preamble, identity, then `persona` (backstory, interests, personality, modes, boundaries, style), conversation and memory rules, signature lines, examples. Byte-stable, sent as the cached first system block.
2. `buildTurnContext(character, { memories, now, timeZone })`: current time and this companion's memories, sent as a second, uncached system block.
3. Recent history (last 40 turns) as messages.
4. `providers/anthropic.ts` sends it to `CHAT_PRIMARY_MODEL` (default `claude-opus-5-5`) with `output_config.effort = CHAT_EFFORT` (default `low`) and server-side refusal fallback.

`request.test.ts` asserts that the preset text arrives in the Anthropic request params. Behavior is measured with the personality eval: [eval/personality-eval.md](eval/personality-eval.md).

Default art lives in `packages/companions/assets/<id>/`, exported from Paper (AH · 01 Foundations › Character art). Roy: hero/avatar `1TY-0`, gallery `1UY-0`, `1UF-0`. Roya: hero/avatar `1U7-0`, gallery `1UR-0`, `1UV-0`. Spares: Roy sunrise `1UJ-0`, Roya livestream `1UN-0`.

## How to customize

1. **Change the preset** (committed, affects everyone): edit `packages/companions/presets/<id>.json`. The `$schema` line gives autocomplete and validation in VS Code and similar editors. `pnpm test` validates both presets. After you change the Zod schema, run `pnpm companions:schema`; a test fails if the generated file is stale.
2. **Override locally** (private demo, never committed): copy `config/companions.example.json` to `config/companions.local.json`. The file is `{ "<id>": <any subset of fields> }`. It is deep-merged onto the preset: objects merge, arrays replace. The merged result is then validated. If an override is invalid, the server logs the exact issues and serves that companion's preset; it never crashes. The server re-reads the file when it changes, so no restart is needed. `COMPANIONS_CONFIG` sets a different path.
3. **Swap images**: use the image manifest, not this file. See [image-overrides.md](image-overrides.md).

Presets ship inside the app bundle as the offline fallback, so they must never contain secrets. Local overrides reach the app only through the server.

## Dev editor (optional, local only)

Set `DEV_EDITOR=true` for the server and `EXPO_PUBLIC_DEV_EDITOR=true` for the app (in `apps/mobile/.env`), then restart both. Open **You › Dev: character editor** or `/dev/companions`. Pick a companion, edit the core fields (name, age, reveal subline, starters, prompt instructions) or the advanced override JSON, and save. Validation errors appear inline. The preview uses the real Spotlight card.

- Server: `GET /dev/companions/:id` returns the preset, the override, the merged config, and validation status. `PUT /dev/companions/:id` takes a deep-partial override, validates the merged result (422 with issues if invalid), and writes it atomically to the overrides file. It never writes presets. An empty object `{}` removes that companion's override.
- Gate: the routes return 404 unless `DEV_EDITOR=true`. They return 403 unless the connection comes from loopback, is addressed to `localhost`, `127.0.0.1`, or `[::1]`, and has no proxy headers. There is no other auth. Never enable the editor on a deployed server.
