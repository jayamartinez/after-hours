# After Hours — implementation plan

Status as of 2026-10-18. Phases 1–3 built (scaffold, UI shell, real streamed chat on hosted Supabase). Current: **Phase 4 (memory) built on `feat/memory`, ready for manual testing**; next: Phase 5 as revised in D-026 (placeholder photos and image credits). Gate A approved 2026-10-15; Gate A2 (revision v3) approved 2026-10-16.

Scope and rules: see `AGENTS.md`. Decisions: `docs/decisions.md`. Visual baseline: `docs/design-brief.md`.

## Summary

- Target: about 24–48 hours of implementation after Gate A.
- Priority: a polished core (onboarding → discovery → chat with memory) over breadth.
- Build order follows the gates below. Nothing in Phases 1–8 starts before Gate A is recorded.

## Phase 0 — Setup, docs, design exploration

Status: **done**

- Goal: repo setup, product and design documentation, reference analysis, design directions in Paper.
- Deliverables:
  - `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `docs/` (this plan, `decisions.md`, `design-brief.md`).
  - Paper file "after hours" with Foundations, Chat directions, Discovery directions, Onboarding, and Core screens.
  - Outstanding: `docs/PRD.md` and `docs/architecture.md` are referenced by `AGENTS.md` but not yet written.
- Done when: the developer has reviewed the Paper directions and both direction pairs are presented for decision.
- Validation evidence: Paper screenshots per artboard; no application code exists.

## GATE A — Design direction approval

- Status: **approved 2026-10-15**. Chat Lamplight (A); discovery The Cast List (B); Spotlight card for the reveal and hero.
- Recorded in `docs/decisions.md` (D-014 and D-006).
- **GATE A2 (approved 2026-10-16, D-016):** revised Roy & Roya designs, revision v3.
- Implementation authorized after Gate A2.

## Phase 1 — Baseline and scaffold

- Goal: freeze the design baseline, finalize architecture, scaffold the monorepo, and set up CI.
- Deliverables:
  - Baseline frozen in `docs/design-brief.md`; `docs/architecture.md` written.
  - pnpm workspaces: `apps/mobile` (Expo Router), `apps/server` (Hono on Node), `packages/contracts` (Zod), `packages/companions`.
  - `.env.example` with placeholders; CI running typecheck, lint, and test.
- Done when:
  - `pnpm install && pnpm typecheck && pnpm lint && pnpm test` pass locally and in CI.
  - `apps/mobile` renders a placeholder route on web; `apps/server` returns 200 from a health route.
  - Both apps import at least one schema from `packages/contracts`.
  - `grep` finds no provider SDK imports in `apps/mobile`.
- Validation evidence: CI run link, health-route response, web screenshot of the placeholder route.

## Phase 2 — Navigation, UI shell, onboarding, discovery, chat (mock)

- Goal: a navigable app that matches the frozen baseline, with local mock data clearly labeled.
- Deliverables:
  - Design tokens from `docs/design-brief.md` as the single source for colors, type, spacing, and radius.
  - Core navigation and UI shell (floating tab bar, back chevron, progress bar).
  - Onboarding: skippable and replayable from settings.
  - Discovery list for Roy and Roya, each with the "AI PARODY" disclosure pill.
  - Chat UI with mock history, labeled "DEMO DATA".
  - Companion image slots: Zod manifest schema in `packages/contracts`; server resolver and static route for `PRIVATE_ASSETS_DIR`; client `CompanionImage` built on expo-image. Resolution order: override manifest, then bundled default, then monogram.
- Done when:
  - Onboarding can be completed, skipped, and replayed; onboarding state logic has unit tests.
  - Discovery shows both companions with AI PARODY disclosure and approved character art (Gate A2); placeholders only until then.
  - Chat renders mock messages, read receipt, and typing indicator; no mock data is presented as real.
  - Image slots: with no manifest, defaults render on iOS and web; an override manifest with one relative and one https `src` renders on both; a missing file falls back cleanly.
  - Screens match the baseline at 393 × 852 on web (iOS Simulator only when available; see Phase 7).
- Validation evidence: web screenshots per core screen; navigation and onboarding-state test output.

## Phase 3 — Real AI chat

- Goal: real, persisted, streamed conversations with each companion.
- Deliverables:
  - Supabase Postgres with anonymous auth; tables scoped to `userId` (RLS or explicit filter).
  - Streaming replies through `apps/server`; `ChatModel` interface in `apps/server/src/providers/types.ts`.
  - Per-companion persona in `packages/companions`; prompt assembly module.
  - Error and retry UI. Provider fallback dropped (D-026); a failed send retries once, then shows a retry action.
- Done when:
  - Reply tokens appear incrementally in the UI.
  - A conversation survives an app reload.
  - A second anonymous user cannot read the first user's conversations (integration test).
  - A failed send shows a retry action.
  - Prompt assembly and provider fallback have unit tests; routes are tested against a real local database.
- Validation evidence: test output, streamed-response recording, two-user isolation test result.

## Phase 4 — Long-term memory

- Goal: companions remember durable details, and the user controls what is remembered.
- Deliverables:
  - Memory extraction after each exchange; retrieval into prompt assembly.
  - Memory controls UI: view, delete individual memories, clear a companion's history, delete account data.
- Done when:
  - A fact stated in chat appears in the memory list.
  - A deleted memory is excluded from retrieval (test).
  - Clearing history and deleting account data remove the rows (integration test).
  - Extraction and retrieval have unit tests.
- Validation evidence: test output; before/after screenshots of the memory list.

## Phase 5 — Photos, image credits, gallery, voice messages

Revised 2026-10-18 (D-026): real image generation is deferred. A companion "sends a photo" through an allowlisted tool, which spends one image credit and sends a clearly labeled placeholder (the companion's gallery art). Users start with free credits, can buy more through demo packs (no real charge), and the demo Plus purchase grants monthly credits. The deliverables below that mention generation apply once a provider is chosen (D-011).

- Prerequisite: developer authorization for image generation (D-013, accepted 2026-10-15 for original, non-photoreal character art).
- Goal: generated images in a per-user gallery; voice messages in both directions.
- Deliverables:
  - Image generation tool call, allowlisted, schema-validated, capped per turn; gallery scoped to `userId`.
  - Voice message: record, speech-to-text, reply, text-to-speech playback.
- Done when:
  - A generated image appears only in the owner's gallery (test).
  - Per-user image budget blocks further generation with an actionable message.
  - A voice message round-trips to a text transcript and an audio reply.
- Validation evidence: gallery screenshot; budget-limit test output; transcript and audio check.

## Phase 6 — Demo paywall, limits, public web

- Goal: a public browser demo with safe spend.
- Deliverables:
  - Mock paywall with an explicit demo purchase state (D-008); entitlements gate features.
  - Per-user rate limits, per-user daily token and image budgets, global spend kill switch.
  - Public web deployment (hosting per D-012).
- Done when:
  - Demo purchase toggles entitlements and is labeled "demo" in UI.
  - Exceeding a per-user limit returns an actionable error (tested).
  - Flipping the kill switch stops all provider calls (tested).
  - The public URL serves the demo; the built client contains no provider keys (bundle check).
- Validation evidence: limit and kill-switch test output; deployed URL; bundle scan result.

## Phase 7 — macOS validation and optional iMessage bridge

- Goal: confirm the iOS build on a real simulator; optionally add the bridge.
- Deliverables:
  - iOS Simulator run at 393 × 852 with status bar and home indicator.
  - Optional `apps/imessage-bridge` (D-009): explicit opt-in, documented bridge API, no SIP changes.
- Done when:
  - Core flows run on the iOS Simulator; screenshots match the baseline.
  - If built: bridge deduplicates messages and prevents reply loops (tests); off by default.
- Validation evidence: simulator screenshots; bridge test output.

## Phase 8 — Stretch, documentation, open-source prep

- Goal: a stranger can run the project; licensing is settled by the developer.
- Deliverables:
  - Voice calls (stretch).
  - README, demo media, setup docs, `THIRD_PARTY` attributions for fonts and assets.
  - License file only after the developer confirms the license (D-010).
- Done when:
  - Fresh clone plus README steps reach a running server and web demo.
  - `.env.example` lists every variable; secret scan finds nothing.
  - Attributions cover Instrument Serif and Inter.
  - License decision recorded in `docs/decisions.md`.
- Validation evidence: clean-clone setup log; secret scan output.

## Risks

- Public demo cost or abuse: mitigated by Phase 6 limits and kill switch, which must ship before public deployment.
- Row-level scoping mistakes: mitigated by two-user isolation tests in Phase 3 and re-run in later phases.
- iOS-only layout issues surface late: web is the only verification target until Phase 7. Check safe areas during Phase 2.
- Design drift after Gate A: changes beyond the baseline need a new decision entry.
- Provider choices open (D-011): the `ChatModel` interface limits the blast radius of a swap.
- Companion safety and AI disclosure copy: must stay visible in onboarding, discovery, and chat header.

## Cut list if time runs short

Cut in this order:

1. Voice calls (Phase 8 stretch).
2. iMessage bridge (Phase 7).
3. Image consistency polish (Phase 5).
4. Voice messages (Phase 5).

Do not cut onboarding, discovery, chat, or memory controls. Cut features are removed or hidden behind a flag; never left as a visible stub (`AGENTS.md`).
