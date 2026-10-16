# After Hours — Architecture

Status: **Milestone 1 scaffolded** (workspace, contracts, companions, server `/health` + `/companions` + private assets, app shell) plus the configurable character system (presets, local overrides, prompt assembly, dev editor). Everything else is proposed. Items marked *open* need a `docs/decisions.md` entry before implementation.

## Overview

```
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ apps/mobile (Expo Router)│        │ apps/imessage-bridge     │
 │ iOS app + static web     │        │ macOS process (optional) │
 └────────────┬─────────────┘        └────────────┬─────────────┘
   HTTPS + SSE│ Supabase JWT            HTTPS     │ bridge token
              ▼                                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ apps/server (Hono on Node)                                  │
 │ auth · rate/budget · prompt assembly · memory · media · tools│
 │ providers/: ChatModel ImageModel SpeechToText TextToSpeech   │
 │             WebSearch  (env-selected implementations)        │
 └──────┬───────────────────────────────┬──────────────────────┘
        │ Drizzle (service role)        │ provider HTTPS
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
| `packages/companions` | Character presets (`presets/*.json`), generated JSON Schema, bundled default art, public projection. | Contain secrets or server-only logic. |

## Mobile app

- **Routing:** Expo Router. Main areas: onboarding, companion list, chat, profile, memories, gallery, settings, paywall.
- **Server state:** TanStack Query for conversations, messages, memories, gallery, entitlements. Optimistic inserts for sent messages.
- **Client state:** one small Zustand store for UI-only state (onboarding progress, composer drafts, active stream, demo flags). No server data duplicated there.
- **Streaming:** `expo/fetch` with SSE parsing on iOS and web. Events are typed in `packages/contracts`: `typing`, `delta`, `message` (final, with id), `tool` (e.g., image pending), `error`, `done`.
- **Web:** `expo export --platform web` produces a static bundle served by any static host or by the server. Features that need native APIs (haptics, mic) degrade with feature checks.
- **Auth:** Supabase client for session only (anonymous sign-in, later email linking). The JWT is sent to the server; the app does not query tables directly.

## Server

Hono on Node, deployed as a **single Node service** (*open:* Fly.io, Render, or Railway; all support long-lived SSE and a persistent process). Modules: `routes/`, `chat/`, `memory/`, `media/`, `voice/`, `limits/`, `bridge/`, `providers/`, `db/`.

### Chat pipeline

1. Request (`POST /conversations/:id/messages`) validated against contracts.
2. Auth: verify Supabase JWT; resolve `userId`; confirm conversation ownership.
3. Rate and budget check against `usage_ledger` and in-memory/token-bucket limits; global kill switch.
4. Persist user message (`status: sent`); emit `typing`.
5. Assemble prompt (`apps/server/src/chat/prompt.ts`): fixed safety preamble + character identity, instructions, boundaries, style block, signature lines, examples + user preferences + top-k memories + recent message window.
6. Stream from primary `ChatModel`. If it fails **before the first token**, retry once, then fall back to the secondary provider. After the first token, errors end the stream with a typed `error` event and a retry action.
7. Handle tool calls (allowlist below), then persist the assistant message(s), split into bursts per style params.
8. Async (after response): memory extraction with a cheap model, usage ledger write, receipts update.

### Memory

- **Separate from history.** Memories are short facts/preferences with category (`fact`, `preference`, `event`, `relationship`, `boundary`), source message, and pinned flag.
- **Extraction:** after each turn, a cheap model proposes candidates as Zod-validated JSON; the server dedupes and merges against existing memories (normalized text match, then embedding similarity when enabled). "Remember this" writes directly as pinned.
- **Retrieval:** score = relevance (embedding cosine via pgvector, or keyword overlap when embeddings are off) + recency decay + pinned boost; take top-k (default 8). `deleted_at` rows are never retrieved.
- **User controls:** list, edit, pin, delete, clear all per companion; account deletion cascades.

### Tool calls

Allowlist: `generate_image`, `web_search` (time-sensitive questions only), `save_memory`. Arguments validated with Zod; max N calls per turn (default 2, env-configurable); each tool checks budget and entitlement; unknown tools are rejected and logged. Tools whose provider is unconfigured are not offered to the model.

### Provider interfaces

Defined in `apps/server/src/providers/types.ts`; implementation chosen by env at startup.

| Interface | Proposed default (*open*) | Alternatives |
| --- | --- | --- |
| `ChatModel` (primary) | Anthropic Claude | — |
| `ChatModel` (fallback) | OpenAI-compatible endpoint (e.g., OpenRouter) | Any OpenAI-compatible API |
| `ChatModel` (local, opt-in) | Ollama / OpenAI-compatible local URL | — |
| `ImageModel` | fal.ai with character reference image | Replicate; fixed seed + LoRA |
| `SpeechToText` | OpenAI Whisper-class | Deepgram |
| `TextToSpeech` | ElevenLabs | OpenAI TTS |
| `WebSearch` | Any search API behind the interface | — |
| Voice calls (P2) | WebRTC via LiveKit | Provider realtime speech API |

**Fallback ≠ offline.** The fallback provider is another hosted API used automatically on primary failure. Local inference is a separate provider selected explicitly by the deployer; it is never an automatic fallback.

### Media and voice

- **Images:** prompt built from the companion's appearance description + reference images + seed/LoRA + scene from conversation; banned-term filter for real names and explicit content; result stored in Supabase Storage (private bucket, signed URLs), recorded in `media_assets`, and attached as an `image` message.
- **Voice in:** client uploads audio → STT → transcript stored on the user `voice` message → normal chat pipeline.
- **Voice out:** companion replies selected as voice (style param or request) are synthesized with the companion's voice config, stored, recorded in `voice_assets`.

## Persistence

Supabase Postgres + Auth + Storage. Drizzle ORM for queries and schema; SQL migrations committed and applied with `pnpm db:migrate`. RLS on every user-owned table (`user_id = auth.uid()`); the server also filters by `userId` explicitly and both are tested.

| Table | Key columns |
| --- | --- |
| `users` | id (= auth uid), display_name, preferences (jsonb: texting style, pacing), age_confirmed_at, onboarding_completed_at, created_at |
| `companions` | id (slug), name, version — seeded from `packages/companions` |
| `conversations` | id, user_id, companion_id (unique pair), last_read_message_id, created_at |
| `messages` | id, conversation_id, role (user/assistant/system), content, kind (text/voice/image), source (app/imessage), external_id (unique, nullable), status (sending/sent/delivered/read/failed), reactions (jsonb), created_at |
| `memories` | id, user_id, companion_id, content, category, source_message_id, pinned, embedding (vector, optional), created_at, updated_at, deleted_at |
| `media_assets` | id, user_id, companion_id, message_id, storage_path, prompt, provider, created_at |
| `voice_assets` | id, user_id, message_id, storage_path, duration_s, direction (in/out), transcript |
| `entitlements` | user_id, plan (free/demo_plus), demo_purchased_at — demo state only, no billing |
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
- JWT verification on every route; ownership checks per conversation; RLS as a second layer.
- Supabase service-role key used only by the server, never by the app or bridge.
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
- **Bundled defaults:** original art in `packages/companions/assets/<id>/`, imported with static `require()` from `@after-hours/companions/default-images` and keyed by the slot's `asset` key (e.g. `roy/hero`) so Metro bundles them. Only the app imports that entry; the server never does.
- **How-to:** `docs/image-overrides.md`.

> **Warning:** a publicly reachable server serves private assets to anyone with the URL. Run private-asset demos only on private deployments.

**Not built:** no upload UI, no CDN pipeline, no image processing.

## Character config

Reference: `docs/companions.md`.

- **Sources:** presets in `packages/companions/presets/*.json` (committed), deep-merged with the git-ignored overrides file `COMPANIONS_CONFIG` (default `config/companions.local.json`). Objects merge and arrays replace. The merged result is validated against `CharacterConfigSchema`. An invalid override logs the Zod issues and falls back to the preset. The file is re-read when its mtime or size changes, using the same cached loader as the image manifest (`apps/server/src/files/cached-file.ts`).
- **Server is the source of truth:** `GET /companions` returns `PublicCharacter[]` (`packages/contracts`) with image slots resolved by the asset manifest. Prompt-only and feature fields (instructions, boundaries, example exchanges, style, memory, proactive, voice ids, appearance) never leave the server.
- **Client:** every screen reads companions through one hook, `useCompanions()` / `useCompanion(id)` (`apps/mobile/src/api/companions.ts`). No component hardcodes a companion's name, copy, or image.
- **Loading on iOS and web:** both platforms run the same code path.
  - Online: the app fetches `${EXPO_PUBLIC_API_URL}/companions`. The web build reaches `localhost:8787` directly; CORS allows `CORS_ORIGINS`. The iOS Simulator can also use `localhost`. A physical device needs the computer's LAN IP in `EXPO_PUBLIC_API_URL` (and in `PUBLIC_SERVER_URL` so private-asset URLs work).
  - Offline or invalid response: the app falls back to the bundled presets. Metro inlines the preset JSON imports at build time on iOS and web, and the app projects them to `PublicCharacter`. Images then come from bundled defaults via static `require()`. Local overrides are never bundled; they arrive only through the server.
  - Images: bundled defaults are static `require()` (iOS and web). Overrides are http(s) URLs served by the server or hosted elsewhere (iOS and web). The client never reads arbitrary filesystem paths.
  - The whole preset file is in the bundle (the repo is public anyway), so presets must never hold secrets.
- **Prompt assembly:** `buildSystemPrompt(character, prefs?, memories?)` puts the app-level safety preamble (`chat/safety.ts`, not configurable) first, then renders config. Onboarding preferences can lower flirtation or roast levels, never raise them. Unit tests prove that config changes alter the prompt and that config cannot remove the preamble.
- **Dev editor:** `GET`/`PUT /dev/companions/:id` exists only with `DEV_EDITOR=true` and only for loopback connections to a local host name with no proxy headers. It writes only the overrides file, atomically (temp file + rename). The mobile route `/dev/companions` redirects home unless `EXPO_PUBLIC_DEV_EDITOR=true` at bundle time.

## Environment variables

Names only. "Degrades" describes behavior when unset.

| Variable | Required | Degrades when unset |
| --- | --- | --- |
| `PORT` | No | Default 8787 |
| `PUBLIC_SERVER_URL` | No | Private-asset URLs use the request's own origin |
| `CORS_ORIGINS` | No | `http://localhost:8081` (Expo web dev server) |
| `COMPANION_ASSET_MANIFEST` | No | Defaults to `config/companion-assets.local.json` (git-ignored). Missing file uses bundled default art. |
| `COMPANIONS_CONFIG` | No | Defaults to `config/companions.local.json` (git-ignored). Missing file: presets only. |
| `DEV_EDITOR` | No | `false`: `/dev/companions` routes return 404. Never enable on a deployed server. |
| `EXPO_PUBLIC_DEV_EDITOR` | No | `false`: the app's `/dev/companions` route redirects home. |
| `PRIVATE_ASSETS_DIR` | No | Defaults to `private-assets/` at the repo root (git-ignored). Relative `src` values whose file is missing fall back to defaults. |
| `DATABASE_URL` | Yes | — |
| `SUPABASE_URL` | Yes | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — |
| `SUPABASE_JWT_SECRET` | Yes | — |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | — |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | — |
| `EXPO_PUBLIC_API_URL` | Yes | — |
| `CHAT_PRIMARY_PROVIDER`, `CHAT_PRIMARY_MODEL` | Yes | — |
| `ANTHROPIC_API_KEY` | If primary is Anthropic | Chat unavailable |
| `CHAT_FALLBACK_BASE_URL`, `CHAT_FALLBACK_API_KEY`, `CHAT_FALLBACK_MODEL` | No | No fallback; primary errors surface to user |
| `MEMORY_MODEL` | No | Uses primary model for extraction |
| `LOCAL_LLM_BASE_URL` | No | Local provider unavailable |
| `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_API_KEY` | No | Keyword + recency retrieval only |
| `IMAGE_PROVIDER`, `IMAGE_API_KEY` | No | Image tool not offered; gallery hidden |
| `STT_PROVIDER`, `STT_API_KEY` | No | Mic button hidden |
| `TTS_PROVIDER`, `TTS_API_KEY` | No | Companions reply in text only |
| `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_API_KEY` | No | Web search tool not offered |
| `RATE_LIMIT_PER_MIN`, `DAILY_TOKEN_BUDGET`, `DAILY_IMAGE_BUDGET`, `DAILY_AUDIO_SECONDS` | No | Conservative defaults |
| `GLOBAL_DAILY_SPEND_CAP_USD`, `KILL_SWITCH` | No (required for public demo) | No global cap |
| `MAX_TOOL_CALLS_PER_TURN` | No | Default 2 |
| `BRIDGE_TOKENS` | No | Bridge API disabled |
| `LOG_LEVEL` | No | `info` |

Bridge-side: `BRIDGE_SERVER_URL`, `BRIDGE_TOKEN`, `BRIDGE_POLL_MS`.

## Local development and self-hosting

- `pnpm install`; `pnpm dev` runs server + Expo web; `pnpm dev:ios` for the Simulator (macOS). From Milestone 3: set the hosted Supabase variables in `.env`, then `pnpm db:migrate` and seed companions.
- The database is a hosted Supabase project (D-019). Docker is optional and never required; the Supabase CLI local stack (`supabase start`) is only an alternative for developers who already run Docker.
- Minimum to chat: Supabase variables + one chat provider key. Everything else is optional and hides its feature when absent.
- Self-hosting: deploy the server as one Node service, the web export to any static host, and point both at a Supabase project (hosted or self-hosted). The bridge runs separately on a Mac.

## Testing strategy

- **Unit:** prompt assembly (per companion and preferences), memory extraction parsing/dedupe/merge, retrieval scoring, provider fallback (pre/post first token), rate/budget logic, tool allowlist and caps, bridge dedup and loop prevention, contract schemas.
- **Integration:** Hono routes against a real local database: PGlite (in-process Postgres, no Docker) once persistence lands; route tests today use Hono's in-memory `app.request`; third-party providers mocked at the HTTP layer; RLS tests prove user A cannot read user B's conversations, memories, or media.
- **Streaming:** SSE event sequence tests, including mid-stream failure.
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
6. Rate-limit store: in-process vs. Postgres-backed (matters if scaled beyond one instance).
7. Voice call stack (LiveKit vs. realtime speech API).
