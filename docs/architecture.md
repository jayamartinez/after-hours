# After Hours, Architecture

Status: **Milestone 4 built**: workspace, contracts, companions, server `/health` + `/companions` + private assets, app shell, configurable character system (presets, overrides, prompt assembly, dev editor), real chat (anonymous sessions, Postgres/PGlite persistence, streamed replies over SSE; D-023), long-term memory with user controls (D-025), and photos with demo credits (placeholder images; D-026). Image generation, voice, and the bridge are still proposed. Items marked *open* need a `docs/decisions.md` entry before implementation.

## Overview

```
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ apps/mobile (Expo Router)│        │ apps/imessage-bridge     │
 │ iOS app + static web     │        │ macOS process (optional) │
 └────────────┬─────────────┘        └────────────┬─────────────┘
   HTTPS + SSE│ session token           HTTPS     │ bridge token
              ▼                                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ apps/server (Hono on Node)                                  │
 │ auth · rate/budget · prompt assembly · memory · media · tools│
 │ providers/: ChatModel ImageModel SpeechToText TextToSpeech   │
 │             WebSearch  (env-selected implementations)        │
 └──────┬───────────────────────────────┬──────────────────────┘
        │ Drizzle (table owner)         │ provider HTTPS
        ▼                               ▼
 ┌──────────────────────────┐   ┌───────────────────────────────┐
 │ Supabase                 │   │ LLM / image / STT / TTS / search│
 │ Postgres+RLS · Auth ·    │   │ (primary + fallback, or local)  │
 │ Storage · pgvector (opt) │   └───────────────────────────────┘
 └──────────────────────────┘
```

## Repository layout

| Path | Responsibility | Must not |
| --- | --- | --- |
| `apps/mobile` | Expo Router app for iOS and web (react-native-web). UI, local UI state, server calls. | Import provider SDKs, hold secrets, talk to providers directly. |
| `apps/server` | Hono API on Node: auth, chat, memory, media, voice, entitlements, limits, bridge API. | Import from `apps/mobile` or `apps/imessage-bridge`. |
| `apps/server/src/providers/*` | Provider implementations behind `providers/types.ts`. | Leak provider types outside this folder. |
| `apps/imessage-bridge` | Optional macOS Node process relaying iMessage ↔ server. | Be imported by any other package; touch the database directly. |
| `packages/contracts` | Zod schemas and inferred types for every API boundary (app, bridge, tool calls, SSE events). | Contain runtime logic beyond validation. |
| `packages/companions` | Character presets (`presets/*.json`), generated JSON Schema, public projection. | Contain secrets or server-only logic. |

## Mobile app

- **Routing:** Expo Router. Main areas: onboarding, companion list, chat, profile, memories, gallery, settings, paywall.
- **Server state:** TanStack Query for conversations, messages, memories, gallery, entitlements. Optimistic inserts for sent messages.
- **Client state:** one small Zustand store for UI-only state (onboarding progress, composer drafts, active stream, demo flags). No server data duplicated there.
- **Streaming:** `expo/fetch` (streaming `response.body` on iOS; the browser's fetch on web) with an incremental SSE parser (`apps/mobile/src/chat/sse.ts`). Events are typed in `packages/contracts/src/chat.ts`: `ack`, `typing`, `delta`, `bubble`, `done`, `error` (later: `tool`).
- **Conversations:** `useConversation` reads one `ConversationSource`. The server-backed source (`chat/api-source.ts`) loads history, inserts the user message optimistically (`sending` → `sent` on `ack` → `read` when the reply starts), shows the typing indicator, and paces reply bubbles with a short typing pause between them. A failed send shows "Not delivered · Retry" under the message; retry resends the same `clientId`. If the API cannot be reached at all, the labeled demo source (`demo-source.ts`, "Demo data · canned replies") takes over. Reactions are local only for now.
- **Web:** `expo export --platform web` produces a static bundle served by any static host or by the server. Features that need native APIs (haptics, mic) degrade with feature checks.
- **Auth:** anonymous device session (D-023). On first API use the app calls `POST /session`, stores the token in AsyncStorage (iOS and web; Keychain via expo-secure-store is a later hardening step), and sends `Authorization: Bearer`. A 401 drops the token and creates a new session once. The app never queries tables directly.

## Server

Hono on Node, deployed as a **single Node service** (*open:* Fly.io, Render, or Railway; all support long-lived SSE and a persistent process). Modules: `routes/`, `chat/`, `memory/`, `media/`, `voice/`, `limits/`, `bridge/`, `providers/`, `db/`.

### Chat pipeline

Built in Milestone 3 (`apps/server/src/routes/conversations.ts`):

1. `KILL_SWITCH` → 503. The body `{ text, clientId, timeZone? }` is validated with `SendMessageRequestSchema` (max 2,000 characters).
2. Auth: verify the session token (`auth/session.ts`) and that the user row exists; resolve `userId`. Conversations are addressed by companion id and always looked up through `userId`, so ownership is structural. Unknown companion → 404.
3. Per-user rate limit (in-memory fixed window, `RATE_LIMIT_PER_MIN`, default 20) → 429.
4. Get or create the conversation (a new one starts with the companion's `copy.firstMessage`). Persist the user message, idempotent on `(conversation, clientId)`: resending an answered message replays the stored reply without calling the model; resending a failed one generates again. Emit `ack`, then `typing`.
5. Build the request with `buildChatRequest`: the last 30 stored messages (failed ones dropped, consecutive same-side messages merged), this user's memories for this companion only, and the device time zone.
6. Stream from the `ChatModel`. Deltas feed an incremental bubble splitter (`createBubbleSplitter`, same result as `splitBubbles`); each finished bubble is stored as its own assistant message (`reply_to` = the user message) and emitted as `bubble`. A retryable failure before the first token is retried once. No fallback provider yet.
7. `done` with the stored ids; the user message becomes `read`. On failure, `error { code, message, retryable }`: a refusal is non-retryable (message `read`); a provider error before any bubble is retryable (message `failed`); a failure after some bubbles keeps them and is non-retryable. A client disconnect does not stop generation, so the reply is still saved. Logs never include message content.

8. After `done`, memory extraction runs in the background (see "Memory"); its failure is logged and never affects the reply.

Later: the usage ledger after each turn, persisted reactions and read pointers. No fallback chat provider is planned (developer decision 2026-10-18).

### Memory

Built in Milestone 4 (`chat/memory-extract.ts`, `chat/remember.ts`, `routes/memories.ts`; D-025):

- **Separate from history.** Memories are short third-person facts with a category (`fact`, `preference`, `event`, `relationship`, `boundary`), the user message they came from, and a pinned flag. Clearing a conversation keeps them.
- **Extraction:** after each delivered reply, `MEMORY_MODEL` (structured outputs, Zod-validated) reads the last few turns, today's date in the device time zone, and what the companion already knows, and proposes facts the user stated in the latest message, guided by the companion's `memory.focus`. The server keeps candidates with confidence ≥ 0.7, at most 3 per exchange, skips normalized-text duplicates, and stores relative dates as absolute ones ("on Fri, Oct 23"). Secrets, contact details, and addresses are excluded by the prompt.
- **"Remember this"** (long-press on the user's own text message): the server loads that message through the user's own conversation, phrases it as a memory with the same model, and returns an existing memory instead when the model marks it as already known. If phrasing fails, the message text is saved as is.
- **Retrieval:** all of this companion's memories for this user, pinned first, then newest, capped at `memory.maxRetrieved`, as a volatile system block (`chat/context.ts`). No embeddings yet.
- **User controls:** `GET/POST /memories/:companionId`, `PATCH|DELETE /memories/:companionId/:memoryId` (edit text, pin), `DELETE /memories/:companionId` (forget all), `DELETE /conversations/:companionId` (clear messages), `DELETE /account` (user row; everything cascades). Deletes are hard deletes, so forgotten text is gone, not hidden.

### Getting to know the user

Built in D-032 (`chat/relationship.ts`, `chat/starters.ts`, `routes/profile.ts`):

- **Onboarding profile:** the onboarding chat sends the user's answers (looking for, values, dynamic, texting length) with `PUT /profile` (Zod-validated, stored in `users.profile`, deleted with the account). Skipped onboarding sends nothing.
- **Adapting to the answers (D-033):** `chat/profile.ts` turns the answers into concrete behavior in a "Tuned to them" section of the character prompt (values first, then what they are looking for, vibe, depth, texting length), within the character's own personality and rules. A gentle vibe lowers the roast level; answers never raise a level. The section is per user and stable, so the prompt still caches.
- **Pacing:** each turn's volatile context gets a relationship stage from the thread's user-message count and how many memories this companion has: `new` (≤ 6 messages and < 4 memories: short replies, one specific question about the user's life, little self-disclosure, teasing and flirting held back), `warming` (≤ 30 and < 10: occasional follow-ups, usual length), then `familiar` (usual style). Memories count so a cleared thread does not start over. 
- **Starters:** `GET /conversations/:companionId/starters` asks `MEMORY_MODEL` for 4 tap-to-send lines in the user's voice from their profile and this companion's memories, cached in-process per user × companion until either changes (rate-limited per user). Without a memory model, under the kill switch, when rate-limited, or on failure, the companion's default `publicProfile.starters` are returned. The app shows them in the onboarding chat and in any empty thread (new or cleared).

### Tool calls

Built (D-026): chat offers exactly one tool, `send_photo` (`chat/photo-tool.ts`), declared `strict` and re-validated with Zod. `streamReply` runs one round of tool use per reply: if the model stops on tool calls, they run after every earlier bubble is delivered, and the model continues once with the results and `tool_choice: none`, with its own content blocks (thinking included) echoed back unchanged. At most one photo per reply; extra or invalid calls get error results and spend nothing. Later candidates (`web_search`, image generation) follow the same allowlist pattern.

### Photos and credits

Built in D-026 (`db/credits.ts`, `routes/credits.ts`):

- **Photos:** `send_photo` spends one credit, then stores an assistant `image` message whose `media` is `{ kind: 'placeholder', description }` (the tool's `moment`). No image is shown: chat and Gallery draw a labeled "Placeholder" card with that description until image generation exists. History shows it to the model as `[photo] caption`. Without credits nothing is stored, the stream emits `credits_required`, and the companion says the photo will wait. After a photo, `credits { balance }` follows the image bubble.
- **Credits:** `users.image_credits` (starts at 3, never negative) holds the balance, so a spend is one conditional update. `credit_events` records every change with a ref unique per user, which makes purchases (`purchaseId`), spends (user message + tool call id), and Plus grants idempotent.
- **Demo purchases (D-008):** `POST /credits/purchase { packId, purchaseId }` adds 10/30/100 credits (balance capped at 999, 10 purchases per user per minute); nothing is charged and the UI labels prices as demo. `POST /plus { plan }` / `DELETE /plus` start and end demo Plus, which grants 50 credits per 30-day period, applied lazily on the next balance read (missed periods are not back-paid). `GET /credits` returns the balance and Plus state; `GET /gallery` lists the user's photos. All scoped to the session user; account deletion cascades the ledger.
- **App:** the chat source forwards credit events (`api/credits.ts`), which update the cached balance and open the "More photos" sheet; the You tab shows the balance and Plus state; the onboarding paywall's demo purchase also starts server Plus.

### Provider interfaces

Defined in `apps/server/src/providers/types.ts`; implementation chosen by env at startup.

| Interface | Proposed default (*open*) | Alternatives |
| --- | --- | --- |
| `ChatModel` (primary) | Anthropic Claude | - |
| `ChatModel` (fallback) | OpenAI-compatible endpoint (e.g., OpenRouter) | Any OpenAI-compatible API |
| `ChatModel` (local, opt-in) | Ollama / OpenAI-compatible local URL | - |
| `ImageModel` | fal.ai with character reference image | Replicate; fixed seed + LoRA |
| `SpeechToText` | OpenAI Whisper-class | Deepgram |
| `TextToSpeech` | ElevenLabs | OpenAI TTS |
| `WebSearch` | Any search API behind the interface | - |
| Voice calls (P2) | WebRTC via LiveKit | Provider realtime speech API |

**Fallback ≠ offline.** The fallback provider is another hosted API used automatically on primary failure. Local inference is a separate provider selected explicitly by the deployer; it is never an automatic fallback.

### Media and voice

- **Images:** prompt built from the companion's appearance description + reference images + seed/LoRA + scene from conversation; banned-term filter for real names and explicit content; result stored in Supabase Storage (private bucket, signed URLs), recorded in `media_assets`, and attached as an `image` message.
- **Voice in:** client uploads audio → STT → transcript stored on the user `voice` message → normal chat pipeline.
- **Voice out:** companion replies selected as voice (style param or request) are synthesized with the companion's voice config, stored, recorded in `voice_assets`.

## Persistence

Postgres via Drizzle ORM (D-023). Schema in `apps/server/src/db/schema.ts`; SQL migrations generated by drizzle-kit into `apps/server/drizzle/` (`pnpm db:generate`) and applied with `pnpm db:migrate`.

- **Targets:** `DATABASE_URL` set → node-postgres (hosted Supabase, session pooler URI). Unset → PGlite (in-process Postgres, no Docker) persisted to `PGLITE_DIR` (default `local-data/pglite`, git-ignored) and migrated at server startup. Tests use in-memory PGlite. PGlite is single-process; a pid `.lock` file next to the directory stops a second process (e.g. `db:migrate` during `pnpm dev`) from opening it.
- **Scoping:** every query filters by `userId` (or a conversation id resolved through it). RLS is enabled on every table with no policies: the server connects as the table owner, and Supabase's public PostgREST roles see nothing. Route tests prove two users and two companions stay isolated.
- **Built now:** `users` (id, image_credits, plus_plan, plus_since, profile jsonb, created_at); `credit_events` (id, user_id, kind `purchase`/`spend`/`plus_grant`, amount, ref unique per user, created_at); `conversations` (id, user_id, companion_id; unique per user × companion); `messages` (id, seq, conversation_id, role, kind, content, status `sent`/`read`/`failed`, client_id unique per conversation, reply_to, reactions, media, created_at); `memories` (id, user_id, companion_id, content, category, pinned, source_message_id, created/updated_at; hard deletes). The rest of the table below is proposed.

| Table | Key columns |
| --- | --- |
| `users` | id (= auth uid), display_name, preferences (jsonb: texting style, pacing), age_confirmed_at, onboarding_completed_at, created_at |
| `companions` | id (slug), name, version, seeded from `packages/companions` |
| `conversations` | id, user_id, companion_id (unique pair), last_read_message_id, created_at |
| `messages` | id, conversation_id, role (user/assistant/system), content, kind (text/voice/image), source (app/imessage), external_id (unique, nullable), status (sending/sent/delivered/read/failed), reactions (jsonb), created_at |
| `memories` | id, user_id, companion_id, content, category, source_message_id, pinned, embedding (vector, optional), created_at, updated_at |
| `media_assets` | id, user_id, companion_id, message_id, storage_path, prompt, provider, created_at |
| `voice_assets` | id, user_id, message_id, storage_path, duration_s, direction (in/out), transcript |
| `entitlements` | user_id, plan (free/demo_plus), demo_purchased_at, demo state only, no billing |
| `usage_ledger` | user_id, day, tokens_in, tokens_out, images, audio_seconds, est_cost |
| `imessage_links` | id, user_id, companion_id, handle, bridge_id, verified_at, proactive_enabled, quiet_hours |

## iMessage bridge (P2, optional)

- Runs on an always-on Mac signed into a **dedicated Apple ID** per bridge.
- **Reading:** opens `~/Library/Messages/chat.db` **read-only**. Requires granting Full Disk Access to the Node binary/terminal. **Do not disable SIP.** Polls (or watches the WAL file and then queries) for rows with `ROWID` above a persisted cursor.
- **Sending:** AppleScript via `osascript` to the Messages app, addressed by handle.
- **Auth:** per-bridge token sent to the server's bridge API; tokens are revocable and scoped to that bridge.
- **Linking:** user opts in in the app, receives a verification code, texts it to the bridge's Apple ID; the server maps handle → `imessage_links` row.
- **Canonical store:** the server. The bridge holds only its cursor and an outbound GUID cache.
- **Dedup:** inbound messages keyed by chat.db GUID → `messages.external_id` (unique) plus an idempotency key per request.
- **Loop prevention:** the bridge records GUIDs of messages it sent and ignores `is_from_me` rows it originated; it never relays `is_from_me` rows as user input.
- **Delivery tracking:** reads `is_delivered` / `is_read` / `date_read` for outbound GUIDs and reports status to the server.
- **Proactive messages:** server-scheduled, respect quiet hours, user can disable per link.
- **Limitations:** needs an always-on Mac; no official bot API; Apple may rate-limit or flag the account; attachments are best-effort; chat.db schema can change between macOS versions.

## Security

- All secrets server-side, from env. `.env.example` lists every variable with placeholders. `EXPO_PUBLIC_*` is public.
- Session-token verification on every chat route; conversations resolved through the user; RLS enabled (no policies) so the public Supabase API cannot read tables.
- `DATABASE_URL` and `SESSION_SECRET` are server-only, never in the app or bridge.
- Storage buckets private; media served by short-lived signed URLs.
- Zod validation on all inputs, tool arguments, model JSON outputs, and bridge payloads.
- Rate limits per user and per IP; daily budgets from `usage_ledger`; global spend kill switch.
- Prompt-injection posture: tool allowlist, capped calls, no tool can read other users' data, web search results treated as untrusted text.
- Logs exclude message content and secrets by default.

## Companion image slots

Each companion has fixed image slots. Ratios are fixed for visual consistency; a deployer changes only the source and focal point. Slot definitions and default art are in `docs/companions.md`.

| Slot | Ratio | Used in |
| --- | --- | --- |
| `<id>.hero` | 3:4 | Spotlight card, profile hero, onboarding welcome and reveal, Cast List expanded image |
| `<id>.avatar` | 1:1 | Chat header, Cast List thumb, small chips |
| `<id>.gallery.0`, `<id>.gallery.1` | 4:5 | Chat image bubble, profile photos |

Each slot has a focal point `[x, y]` (0 to 1). Rendering uses `object-fit: cover` with `object-position` from the focal point. Images are never stretched, and a different source is never used for the same slot. Galleries hold two images per companion.

**Resolution order:** override manifest, then bundled default, then monogram fallback. A missing slot or file falls through to the next step.

- **Override manifest:** `COMPANION_ASSET_MANIFEST` (default `config/companion-assets.local.json`, git-ignored). Example:

```json
{"roy":{"hero":{"src":"roy/hero.jpg","focal":[0.5,0.3],"alt":"Roy at his desk"},"avatar":{"src":"roy/avatar.jpg"},"gallery":[{"src":"https://cdn.example.com/roy-1.jpg","focal":[0.55,0.45]}]}}
```

- **`src`:** a relative path (no `..`, no leading slash, no backslashes) is served by the API at `/assets/private/<path>` from `PRIVATE_ASSETS_DIR` (default `private-assets/` at the repo root, git-ignored), but only if the file exists; otherwise the slot gets `uri: null` and the default art. An `https://` URL is used as-is; plain `http://` is accepted only for `localhost`. An omitted `focal` or `alt` uses the slot default.
- **Validation:** the manifest is validated with a Zod schema in `packages/contracts`. Invalid JSON or schema logs a warning and the whole file is ignored; unknown companion ids are ignored with a warning. The server re-reads the file when its mtime or size changes. The resolver returns `{ uri, focal, alt }` per slot in `GET /companions`.
- **Private asset route:** image extensions only (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`), decoded once and re-checked, symlinks resolved and kept inside the root; traversal attempts get 400, missing or non-image files 404.
- **Client:** `CompanionImage` renders with expo-image (`contentFit="cover"`, `contentPosition` from the focal point), identical on iOS and web.
- **No bundled art (D-030):** the app ships no companion images. A slot without a server image URI shows a loading animation.
- **How-to:** `docs/image-overrides.md`.

> **Warning:** a publicly reachable server serves private assets to anyone with the URL. Run private-asset demos only on private deployments.

**Not built:** no upload UI, no CDN pipeline, no image processing.

## Character config

Reference: `docs/companions.md`.

- **Sources:** presets in `packages/companions/presets/*.json` (committed), deep-merged with the git-ignored overrides file `COMPANIONS_CONFIG` (default `config/companions.local.json`). Objects merge and arrays replace. The merged result is validated against `CharacterConfigSchema`. An invalid override logs the Zod issues and falls back to the preset. The file is re-read when its mtime or size changes, using the same cached loader as the image manifest (`apps/server/src/files/cached-file.ts`).
- **Shape:** `CharacterConfig` groups identity at the top level (`id`, `name`, `age`, `pronouns`, `tint`, `disclosure`, `images`), `publicProfile` (chips, meters, voice summary, match tags, starters, UI copy: the only character content the app may display or use), `persona` (backstory, interests, personality, style, examples: server-only prompt material), and server-only feature config (`voice`, `memory`, `proactive`, `appearance`).
- **Server is the source of truth:** `GET /companions` returns `PublicCharacter[]` (`packages/contracts`): identity, `publicProfile`, `proactiveByDefault`, and image slots resolved by the asset manifest. `toPublicCharacter` (`packages/companions/src/public.ts`) copies those fields one by one, so `persona` and feature config never leave the server; a test checks that no persona text appears in the serialized result.
- **Client:** every screen reads companions through one hook, `useCompanions()` / `useCompanion(id)` (`apps/mobile/src/api/companions.ts`). No component hardcodes a companion's name, copy, or image.
- **Loading on iOS and web:** both platforms run the same code path.
  - Online: the app fetches `${EXPO_PUBLIC_API_URL}/companions`. The web build reaches `localhost:8787` directly; CORS allows `CORS_ORIGINS`. The iOS Simulator can also use `localhost`. A physical device needs the computer's LAN IP in `EXPO_PUBLIC_API_URL` (and in `PUBLIC_SERVER_URL` so private-asset URLs work).
  - Offline or invalid response: the app falls back to the bundled presets. Metro inlines the preset JSON imports at build time on iOS and web, and the app projects them to `PublicCharacter`. Images then come from bundled defaults via static `require()`. Local overrides are never bundled; they arrive only through the server.
  - Images: bundled defaults are static `require()` (iOS and web). Overrides are http(s) URLs served by the server or hosted elsewhere (iOS and web). The client never reads arbitrary filesystem paths.
  - The whole preset file is in the bundle (the repo is public anyway), so presets must never hold secrets.
- **Prompt assembly:** `buildChatRequest(character, { history, memories, prefs, now })` (`chat/request.ts`) is the one path from config to a model request. `buildSystemPrompt(character, prefs?)` puts the app-level safety preamble (`chat/safety.ts`, not configurable) first, then renders identity and `persona` plus the app-level conversation and memory rules (including: never claim accomplishments, companies, famous acquaintances, or past events as facts); it is byte-stable and sent as the cached system block. `buildTurnContext` (`chat/context.ts`) adds the volatile part (current time, relationship stage and onboarding profile, this companion's memories only) as a second system block. `ChatModel` (`providers/types.ts`, Anthropic implementation in `providers/anthropic.ts`) streams the reply; `splitBubbles` / `createBubbleSplitter` turn blank-line-separated texts into bubbles. Onboarding preferences can lower flirtation or roast levels, never raise them. Unit tests prove that config changes alter the request and that config cannot remove the preamble. The chat route (see "Chat pipeline") uses this path; `pnpm --filter @after-hours/server eval` exercises it against the real model.
- **Dev editor:** `GET`/`PUT /dev/companions/:id` exists only with `DEV_EDITOR=true` and only for loopback connections to a local host name with no proxy headers. It writes only the overrides file, atomically (temp file + rename). The mobile route `/dev/companions` redirects home unless `EXPO_PUBLIC_DEV_EDITOR=true` at bundle time.

## Environment variables

Names only. "Degrades" describes behavior when unset.

| Variable | Required | Degrades when unset |
| --- | --- | --- |
| `PORT` | No | Default 8787 |
| `PUBLIC_SERVER_URL` | No | Private-asset URLs use the request's own origin |
| `CORS_ORIGINS` | No | `http://localhost:8081` (Expo web dev server). Outside `NODE_ENV=production`, any `http://localhost:<port>` or `127.0.0.1` origin is also allowed. |
| `COMPANION_ASSET_MANIFEST` | No | Defaults to `config/companion-assets.local.json` (git-ignored). Missing file uses bundled default art. |
| `COMPANIONS_CONFIG` | No | Defaults to `config/companions.local.json` (git-ignored). Missing file: presets only. |
| `DEV_EDITOR` | No | `false`: `/dev/companions` routes return 404. Never enable on a deployed server. |
| `EXPO_PUBLIC_DEV_EDITOR` | No | `false`: the app's `/dev/companions` route redirects home. |
| `PRIVATE_ASSETS_DIR` | No | Defaults to `private-assets/` at the repo root (git-ignored). Relative `src` values whose file is missing fall back to defaults. |
| `DATABASE_URL` | No | Local PGlite in `PGLITE_DIR`. For hosted Postgres, the Supabase session pooler URI. |
| `PGLITE_DIR` | No | `local-data/pglite` (git-ignored) |
| `SESSION_SECRET` | With `DATABASE_URL` | PGlite only: a random secret is generated once into `local-data/session-secret`. 32+ characters. |
| `NODE_ENV` | No | `development` (any-localhost CORS allowed); set `production` when deployed |
| `EXPO_PUBLIC_API_URL` | No | `http://localhost:8787` |
| `CHAT_PRIMARY_PROVIDER`, `CHAT_PRIMARY_MODEL` | No | `anthropic`, `claude-opus-5-5` |
| `ANTHROPIC_API_KEY` | If primary is Anthropic | Chat unavailable |
| `CHAT_FALLBACK_BASE_URL`, `CHAT_FALLBACK_API_KEY`, `CHAT_FALLBACK_MODEL` | No | No fallback; primary errors surface to user |
| `MEMORY_MODEL` | No | `claude-haiku-5-5` (memory extraction, eval judge) |
| `CHAT_EFFORT` | No | `low` (reasoning effort for chat replies) |
| `LOCAL_LLM_BASE_URL` | No | Local provider unavailable |
| `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_API_KEY` | No | Keyword + recency retrieval only |
| `IMAGE_PROVIDER`, `IMAGE_API_KEY` | No | Image tool not offered; gallery hidden |
| `STT_PROVIDER`, `STT_API_KEY` | No | Mic button hidden |
| `TTS_PROVIDER`, `TTS_API_KEY` | No | Companions reply in text only |
| `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_API_KEY` | No | Web search tool not offered |
| `RATE_LIMIT_PER_MIN` | No | 20 chat messages per user per minute (in-memory) |
| `KILL_SWITCH` | No (public demo emergency stop) | `false`; `true` makes chat sends return 503 |
| `DAILY_TOKEN_BUDGET`, `DAILY_IMAGE_BUDGET`, `DAILY_AUDIO_SECONDS`, `GLOBAL_DAILY_SPEND_CAP_USD` | No | Not implemented yet |
| `MAX_TOOL_CALLS_PER_TURN` | No | Default 2 |
| `BRIDGE_TOKENS` | No | Bridge API disabled |
| `LOG_LEVEL` | No | `info` |

Bridge-side: `BRIDGE_SERVER_URL`, `BRIDGE_TOKEN`, `BRIDGE_POLL_MS`.

## Local development and self-hosting

- `pnpm install`; `pnpm dev` runs server + Expo web; `pnpm dev:ios` for the Simulator (macOS). With no `DATABASE_URL` the server uses local PGlite and migrates it on startup: nothing else to set up.
- Hosted database (D-019, D-023): put the Supabase **session pooler** URI in `DATABASE_URL` and a 32+ character `SESSION_SECRET` in `.env`, run `pnpm db:migrate` once (and after each new migration), then `pnpm dev`. Docker is never required.
- Minimum to chat: `ANTHROPIC_API_KEY`. Everything else is optional and hides its feature when absent.
- Self-hosting: deploy the server as one Node service, the web export to any static host, and point both at a Supabase project (hosted or self-hosted). The bridge runs separately on a Mac.

## Testing strategy

- **Unit:** prompt assembly (per companion and preferences), memory extraction parsing/dedupe/merge, retrieval scoring, provider fallback (pre/post first token), rate/budget logic, tool allowlist and caps, bridge dedup and loop prevention, contract schemas.
- **Integration:** Hono routes via `app.request` against in-memory PGlite with the migrations applied and the `ChatModel` replaced by a scripted double (`routes/conversations.test.ts`): SSE event order, persistence, idempotency, two-user and Roy/Roya isolation, memory scoping, rate limit, kill switch, refusal, retry before the first token, and RLS enabled on every table. `routes/memories.test.ts` adds a scripted `StructuredModel`: extraction after a reply, "Remember this", every memory control, clear history, account deletion, and that a second user can never list, edit, pin, delete, or remember from the first user's data. `routes/starters.test.ts` covers `PUT /profile` validation, per-user starters (caching, regeneration after a new memory, fallbacks, two-user isolation), and stage pacing in real sends. `routes/photos.test.ts` covers the photo tool (sent, out of credits, one per reply, invalid input, idempotent replay), purchases, Plus periods, and per-user isolation of photos, balances, and the ledger.
- **Streaming:** SSE event sequence tests, including mid-stream failure; client SSE parser and API source tests (`apps/mobile/src/chat/*.test.ts`).
- **Persona regression:** fixed transcript prompts per companion checked for style params (casing, length, bursts) with a mocked or recorded model.
- **UI:** verify on web and iOS Simulator; screenshots for meaningful visual changes.

## Observability

- Structured JSON logs with a request ID per request (propagated to provider calls and SSE streams) and bridge ID for bridge traffic.
- Per-turn metrics in logs: time to first token, total latency, provider used, fallback taken, tokens, tool calls, cost estimate.
- Usage ledger doubles as the cost dashboard source; alert when nearing the global cap.
- Message content and memory text are not logged by default.

## Open decisions

1. Server host: Fly.io, Render, or Railway (D-012).
2. Primary and fallback chat models; memory extraction model (D-005, D-011).
3. Image provider and consistency method (D-011).
4. STT and TTS providers; eager vs. on-play TTS (D-011).
5. Whether embeddings (pgvector) ship in P0 or keyword retrieval suffices.
6. Rate-limit store: in-process today (D-023); Postgres-backed if scaled beyond one instance.
7. Voice call stack (LiveKit vs. realtime speech API).
