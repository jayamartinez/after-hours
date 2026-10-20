# After Hours — Product Requirements

Status: draft for the prototype. Decisions and reversals are recorded in `docs/decisions.md`.

## Scope statement

After Hours is a **deliberately polished, limited-scope demo**, not a commercial app. It ships with exactly two companions, **Roy** and **Roya**: fictional AI parody characters satirically inspired by a loud-founder public persona. No additional companions are in scope. The companion model stays data-driven so the codebase is clean, but the demo is judged on how well these two characters feel, not on breadth.

## Problem and vision

Most AI chat apps feel like a tool: a blank prompt box, generic voice, no continuity. After Hours makes an AI companion feel like texting someone you have an ongoing relationship with — a distinct character who remembers what matters, writes in a recognizable style, sends voice notes and photos, and is always honest about being a fictional AI parody.

The demo must prove that this feeling is achievable with a small, maintainable codebase: one Expo app (iPhone first, plus a public browser demo from the same code) and one Node API.

## Target user and use cases

Target user: an adult (18+) who enjoys character-driven, comedic conversation and wants something warmer and more continuous than a general-purpose assistant.

Use cases:
- Late-night texting with Roy (hype and roasts about shipping) or Roya (teasing, flirty banter).
- Picking up a conversation days later and having the companion recall a relevant detail (a launch date, a promise to ask for a raise).
- Sending and receiving voice messages instead of typing.
- Asking for a photo ("what are you up to?") and getting a consistent, stylized, non-explicit image.
- Reviewing and correcting what the companion remembers.
- Optionally texting a companion from the native Messages app via iMessage.
- Trying the public web demo without installing anything or creating an account.

## Principles

1. **Honest by default.** Roy and Roya are fictional AI parody adults, labeled "AI parody" in onboarding, profiles, and the chat header. They never claim to be human or a real person.
2. **Character over capability.** Tone, pacing, and memory matter more than feature count.
3. **The user owns their data.** Memories and history are visible, editable, and deletable.
4. **Feels native.** Streaming, typing indicators, receipts, and haptics behave like a real messaging app.
5. **Fail gracefully.** A missing provider key hides a feature; it never breaks chat.
6. **Small surface.** One app, one API, two data-driven companions. No speculative frameworks.

## Feature list

### P0 — core demo

| Feature | Notes |
| --- | --- |
| Companion picker and profiles | Spotlight cards as primary discovery (swipe Roy ↔ Roya); "The Cast List" as secondary browse; profile shows "AI parody" disclosure, bio, look, and two gallery images. |
| Streaming chat | Token streaming with typing indicator; persisted history per user × companion. |
| Read receipts and delivery status | `sending → sent → read`, companion "typing" before first token. |
| Reactions | Tapback-style reactions on any message. |
| Long-press actions | Reply, copy, "Remember this", regenerate. |
| Long-term memory | Automatic extraction plus "Remember this"; separate from history. |
| Memory controls | View, edit, pin, delete individual memories; clear a companion's history. |
| Onboarding (~14 screens) | Skippable and replayable; matches the user to Roy or Roya and sets texting style; includes parody disclosure and adult confirmation. |
| Anonymous demo sign-in | No account needed; upgradeable to email later. |
| Public web demo | Same Expo app exported for web, protected by rate and spend limits. |
| Demo limits | Per-user rate limits, daily budgets, global kill switch. |

### P1 — next

| Feature | Notes |
| --- | --- |
| Image generation | Conversational requests ("send me a pic") and a per-companion gallery; consistent stylized look; non-explicit. |
| Voice messages | Record → STT → reply; companion replies as TTS voice notes. |
| Mock subscription / paywall | Plans and a demo purchase that flips local entitlement state. No billing. |
| Email account upgrade | Link anonymous account to email; preserve data. |
| Web search tool | For time-sensitive questions only; allowlisted and capped. |
| Account data deletion | Delete all user data across both companions. |

### P2 — later

| Feature | Notes |
| --- | --- |
| iMessage mode | Optional Mac-hosted bridge; explicit opt-in with verification code. |
| Proactive messages | Companion-initiated check-ins with quiet hours and a user off switch. |
| Low-latency voice calls | Realtime speech; requires separate latency work. |
| Optional local inference | Opt-in self-hosted model provider. |

## Companion model

Each companion is a data record in `packages/companions` (spec: `docs/companions.md`). Logic never branches on a companion's identity; all distinctness comes from data. Memory is per user × companion and never shared between Roy and Roya.

| | Roy | Roya |
| --- | --- | --- |
| Identity | 23 (fictional), he/him; "AI parody" | 23 (fictional), she/her; "AI parody" |
| Persona (prompt only, never shown as profile text) | The friend people text for a real reaction: loud in a group chat, thoughtful one-on-one, competitive about small things, into tech and building when it comes up. No invented career, events, or history. | Notices things: dry, observational, affectionately sarcastic; an ordinary full life (food opinions, music on repeat, friends). No alternate-universe or startup backstory. |
| Tone | Blunt, playful, competitive; loyal and sincere when it counts | Witty, teasing, perceptive; warm by paying attention |
| Texting style | Quick bursts of short lowercase bubbles, few emoji | Sentence case, punchy lines, pointed questions |
| Voice | Fast, bright tenor | Smoky, amused mezzo |
| Visual identity / tint | `--color-window` (laptop-glow blue → ink) | Brass → oxblood (lamplight) |
| Public profile | Portrait, name, AI PARODY badge, age, actions, memories, photos, settings (D-024) | Same |

Onboarding answers set user-level preferences (texting style, pacing, companion match) that the prompt assembler combines with companion style params.

### Configurable characters

- Companions are defined by one validated `CharacterConfig` (Zod, in `packages/contracts`). Roy and Roya ship as JSON presets in `packages/companions/presets`.
- A character configures: identity (name, age, pronouns) and the AI PARODY label; a `publicProfile` (the only content the app may display); a server-only `persona` used only to build the prompt (backstory, interests, personality, instructions, conversation modes, style, example messages); images and focal points (slots per the design brief); voice; memory behavior; and proactive preferences. Onboarding, discovery, and profile copy live in `publicProfile`.
- Local overrides live in the git-ignored `config/companions.local.json` and need no code changes. An optional dev editor is available only when `DEV_EDITOR=true` and the server runs on localhost.
- Scope stays at exactly two presets. There is no character-creation system.

## Parody & likeness guardrails

- **Labeled.** An "AI PARODY" badge in the chat header and beside each name; one short non-affiliation note in the profile footer; onboarding welcome caption "AI-generated parody characters. 18+." No repeated disclaimers in chat.
- **Original art.** Stylized editorial illustration (gouache/grain, painterly), never photoreal, and never depicting or resembling a specific real person.
- **No real references.** No real names, companies, schools, products, or quotes in character data, prompts, copy, or generated output, except the referenced person's name in the non-affiliation note. All places and brands are fictional.
- **No factual claims about real people**, and no implied endorsement by or affiliation with anyone the characters may resemble.
- **PG-13.** Flirtation stays playful; never explicit, in text or images.
- **Never a real person.** Companions never claim to be human or a real person, and never speak as, for, or quote a real person. If asked sincerely, they say plainly, and in voice, that they are fictional AI parodies.
- **Refusals.** Requests to impersonate a real person, speak as one, invent quotes, or produce defamatory or harassing content about real people are declined in character, with a redirect to something in bounds. Image prompts naming real people are rejected.

## Success criteria for the demo

Qualitative:
- Testers can tell Roy and Roya apart from unlabeled transcripts.
- A returning tester notices the companion recalling a relevant detail without being prompted.
- Testers describe the chat as feeling like a messaging app, not a chatbot form.
- No tester is confused about whether the companion is an AI parody rather than a real person.

Measurable (server-side, measured on the deployed demo):

| Metric | Target |
| --- | --- |
| Time to first token (p50 / p95) | ≤ 1.2 s / ≤ 2.5 s |
| Time to typing indicator after send | ≤ 300 ms |
| Chat turn error rate (after fallback) | < 1% |
| Memory retrieval latency (p95) | ≤ 150 ms |
| Voice note round trip (STT + reply + TTS, p50) | ≤ 6 s |
| Image generation (p50) | ≤ 20 s, with progress state |
| Web demo cold load (LTE-class) | ≤ 4 s to interactive |
| Cross-user data leakage in RLS tests | 0 |
| Demo spend | Stays under the configured global daily cap |

## Non-goals

- A commercial product, or companions beyond Roy and Roya.
- Real billing, App Store in-app purchases, or payment collection.
- Explicit or sexual content of any kind.
- Real-person likeness, photoreal lookalikes, impersonation, or real quotes.
- Minors as characters or users.
- Claims that a companion is human or a real person.
- A separate web codebase (Next.js) or a microservice architecture.
- Android polish (may work via Expo; not a target).
- Therapy, medical, legal, or crisis services.

## Safety and privacy requirements

- **AI parody disclosure.** See *Parody & likeness guardrails*. If a user sincerely asks whether the companion is real, it answers honestly.
- **Adults only.** Onboarding requires age confirmation (18+). Companions are fictional 23-year-olds; personas forbid age-play or minor-coded content.
- **Content limits.** Image generation is non-explicit and stylized, enforced by prompt constraints plus provider safety filters. Personas include explicit-content and real-person boundaries.
- **Crisis handling.** Personas step out of the bit and point to appropriate resources when a user signals risk of self-harm.
- **Memory control.** Users can view, edit, pin, and delete individual memories, clear a companion's history, and delete all their data. Deleted memories are excluded from retrieval immediately.
- **Data scoping.** Every conversation, memory, and media query is scoped to the authenticated user (RLS plus explicit filters, tested).
- **No secrets client-side.** Provider keys live only on the server. `EXPO_PUBLIC_*` variables are treated as public.
- **Public demo protection.** Per-user rate limits, per-user daily token/image/audio budgets, a global spend kill switch, and anonymous-session abuse limits.
- **Tool safety.** Tool calls are allowlisted, schema-validated, and capped per turn.
- **iMessage.** Requires explicit opt-in and verification. Proactive messages respect quiet hours and can be disabled.
- **Repository hygiene.** No real conversations, generated personal images, or `.env` files in Git.

## Assumptions

- Hosted LLM, image, STT, and TTS providers are available via API with keys supplied by the deployer.
- Supabase (hosted or self-hosted) is acceptable for Postgres, Auth, and Storage.
- Expo with react-native-web is good enough for a credible browser demo.
- Testers for iMessage mode have access to a spare always-on Mac and Apple ID.
- Demo traffic is small (tens to low hundreds of daily users).

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Persona drift over long chats | Roy and Roya blur together | Style params enforced in prompt; regression transcripts in tests. |
| Parody slips into real-person claims | Likeness or defamation concerns | Guardrails in the global preamble; refusal regression prompts; real-name filter on image prompts. |
| Roast or flirt tone goes too far | Users feel insulted or content exceeds PG-13 | `roastLevel`/`flirtation` caps; roast excuses, never the user's identity; explicit-content boundary. |
| Memory extraction errors | Wrong or creepy recall | User-visible memory list, dedupe/merge, confidence threshold, easy deletion. |
| Image consistency | Companion looks different each time | Reference art plus fixed style line and seed; curated fallback set. |
| Public demo cost abuse | Unbounded spend | Budgets, rate limits, kill switch, anonymous-session caps. |
| Provider outage or latency | Broken or slow chat | Retry plus secondary provider before first token. |
| iMessage bridge fragility | Apple changes or flags accounts | Optional feature, dedicated Apple ID, clear limitations. |
| Web demo performance | Poor first impression | Static export, lazy-load heavy screens, measure cold load. |
| Emotional over-reliance | User harm | Honest disclosure, crisis guidance, no manipulative retention mechanics. |

## Open questions

1. Primary and fallback chat model choices, and per-turn cost ceiling (D-011).
2. Image provider and consistency method (reference image vs. LoRA vs. both) (D-011).
3. TTS provider and whether voice notes are generated eagerly or on play (D-011).
4. Hosting target for the server (Fly.io, Render, or Railway) (D-012).
5. Daily budget values for the public demo and whether anonymous users get lower limits.
6. Retention period for anonymous demo accounts with no activity.
7. Whether proactive messages exist outside iMessage mode (push notifications).
8. Mock paywall: which features are gated in the demo, if any.
9. License choice (D-010, pending developer confirmation).
