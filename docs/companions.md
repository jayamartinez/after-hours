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

| Field | Notes | Public |
| --- | --- | --- |
| `id` | Slug (`roy`, `roya`). Immutable; an override cannot change it. | Yes |
| `name`, `age` (≥ 21), `pronouns { subject, object, possessive }` | Identity. | Yes |
| `tagline`, `statusLine`, `location` (fictional), `bio`, `backstory`, `interests[]` | Profile text; backstory and interests also feed the prompt. | Yes |
| `locationShort` | Short fictional place label; status line is `statusLine · locationShort` (Spotlight, profile hero, preview sheet). | Yes |
| `blurb` | One or two sentences for discovery cards and Cast List rows. | Yes |
| `tint` (`window` / `lamplight`) | Accent family for status lines, dots, and waveforms; maps to design tokens. | Yes |
| `chips` (exactly 3), `meters { banter 0–5, depth 0–5, pace easy/quick/instant }` | Spotlight and profile. | Yes |
| `talkStyle[]` (1–6) | Profile "How they talk" chips. | Yes |
| `disclosure { badge, note }` | `badge` is the "AI PARODY" pill beside the name (Spotlight, profile, chat header). `note` is one short line, shown once in the profile footer. | Yes |
| `personality.traits[]` | Prompt and profile. | Yes |
| `personality.instructions`, `personality.boundaries[]` | Second-person behavior and character-specific do-nots. | Prompt only |
| `style { casing, bubbleLength, burst [min,max] 1–4, emojiRate 0–1, questionRate 0–1, flirtation 0–3, roast 0–3 }` | Rendered into the prompt's style block. | Server only |
| `examples.messages[] { user?, companion[] }` | Few-shot exchanges. | Prompt only |
| `examples.starters[]`, `examples.signatureLines[]` | Quick replies; signature lines are a prompt hint and the profile's sample line. | Yes |
| `voice { description, summary, provider?, voiceId?, voiceIdEnv?, speed? }` | `summary` is the short form for compact voice rows (Cast List, sheet). Only `description` and `summary` are public. Prefer `voiceIdEnv` (env var name) over a literal id. | `description`, `summary` |
| `memory { enabled, focus[], maxRetrieved 1–20 }`, `proactive { enabledByDefault, quietHours, maxPerDay 0–5, openers[] }` | Feature config. `enabledByDefault` is exposed as `proactiveByDefault`, the default for the profile's "Proactive messages" toggle. | Server only, except `proactiveByDefault` |
| `copy { spotlightCta, revealHeadline, revealSubline, revealCta, matchReasons[], firstMessage[], profileSections { about, talks, voice, remembers, photos }, voiceLabel, sampleOpener, chatLocation? }` | All companion-specific UI text. `revealCta` is the onboarding reveal button. `sampleOpener` is the "He might open with" line (Cast List row, preview sheet). `chatLocation` is the optional place in the chat header status. | Yes |
| `appearance { style, look }` | Art direction for image generation. | Server only |
| `images { hero, avatar, gallery[2] }` each `{ asset, focal [x,y], alt }` | `asset` is a bundled default key such as `roy/hero`. Ratios are fixed: hero 3:4, avatar 1:1, gallery 4:5. | Yes (resolved) |

Objects are strict: unknown keys (typos) fail validation. `GET /companions` returns `PublicCharacter[]`, built field by field in `packages/companions/src/public.ts`; a test asserts that prompt-only fields never appear.

## Disclosure

- Badge: `AI PARODY`. Note: `AI-generated parody. Not affiliated with or endorsed by Roy Lee.` The note names the referenced person only to disclaim affiliation.
- No long disclaimers in profiles, chat bubbles, or first messages. The badge carries the disclosure in chat.
- The prompt always starts with the app-level safety preamble (`apps/server/src/chat/safety.ts`). It is not configurable. It says the character is a fictional AI parody that never claims to be, speaks as, or quotes the real person, never claims to be human, and stays PG-13.

## Presets

- **Roy**: a blunt, chaotic founder whose answer to everything is "build it now". He texts lowercase, in 2–3 short bubbles, never flirts, and roasts excuses bluntly.
- **Roya**: Roy's alternate-timeline counterpart, who founded the rival studio first. She teases and is sarcastic, flirts back within PG-13, calls the user "founder", and rates excuses out of 10. She writes in sentence case, 1–2 medium bubbles per turn.

Default art lives in `packages/companions/assets/<id>/`, exported from Paper (AH · 01 Foundations › Character art). Roy: hero/avatar `1TY-0`, gallery `1UY-0`, `1UF-0`. Roya: hero/avatar `1U7-0`, gallery `1UR-0`, `1UV-0`. Spares: Roy sunrise `1UJ-0`, Roya livestream `1UN-0`.

## How to customize

1. **Change the preset** (committed, affects everyone): edit `packages/companions/presets/<id>.json`. The `$schema` line gives autocomplete and validation in VS Code and similar editors. `pnpm test` validates both presets. After you change the Zod schema, run `pnpm companions:schema`; a test fails if the generated file is stale.
2. **Override locally** (private demo, never committed): copy `config/companions.example.json` to `config/companions.local.json`. The file is `{ "<id>": <any subset of fields> }`. It is deep-merged onto the preset: objects merge, arrays replace. The merged result is then validated. If an override is invalid, the server logs the exact issues and serves that companion's preset; it never crashes. The server re-reads the file when it changes, so no restart is needed. `COMPANIONS_CONFIG` sets a different path.
3. **Swap images**: use the image manifest, not this file. See [image-overrides.md](image-overrides.md).

Presets ship inside the app bundle as the offline fallback, so they must never contain secrets. Local overrides reach the app only through the server.

## Dev editor (optional, local only)

Set `DEV_EDITOR=true` for the server and `EXPO_PUBLIC_DEV_EDITOR=true` for the app (in `apps/mobile/.env`), then restart both. Open **You › Dev: character editor** or `/dev/companions`. Pick a companion, edit the core fields (name, age, tagline, status line, bio, starters, instructions) or the advanced override JSON, and save. Validation errors appear inline. The preview uses the real Spotlight card.

- Server: `GET /dev/companions/:id` returns the preset, the override, the merged config, and validation status. `PUT /dev/companions/:id` takes a deep-partial override, validates the merged result (422 with issues if invalid), and writes it atomically to the overrides file. It never writes presets. An empty object `{}` removes that companion's override.
- Gate: the routes return 404 unless `DEV_EDITOR=true`. They return 403 unless the connection comes from loopback, is addressed to `localhost`, `127.0.0.1`, or `[::1]`, and has no proxy headers. There is no other auth. Never enable the editor on a deployed server.
