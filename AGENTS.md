# After Hours — agent instructions

After Hours is an open-source AI companion app: an ongoing text, voice, and image relationship with a distinct, clearly disclosed fictional AI character. It targets iPhone first (Expo / React Native) with a public browser demo built from the same app.

Read before changing anything:

1. This file.
2. `docs/PRD.md` — what we are building and why.
3. `docs/design-brief.md` — visual identity, tokens, approved screens.
4. `docs/implementation-plan.md` — current phase, milestones, gates.
5. `docs/architecture.md` and `docs/decisions.md` when touching structure, data, or providers.

## Phase gates (hard rules)

- **Design gate.** No application code (frontend scaffold, UI components, backend routes) until the developer explicitly approves a design direction in Paper. Approval is recorded in `docs/decisions.md`. "Looks nice" is not approval; "approved, build it" is.
- **Baseline.** After approval, implement against the frozen baseline named in `docs/design-brief.md`. Visual changes beyond it need a new decision entry.
- **Shipping.** Never commit, push, open a PR, or merge without explicit developer authorization.
- Do not add a license file until the developer confirms the license choice.

## Scope

In scope: messaging with streaming replies, exactly two companions (Roy and Roya) with independent history and memory, memory controls, image generation and gallery, voice messages, voice calls (later), mock subscription flow, optional Mac-hosted iMessage bridge.

Out of scope: more than two companions, real billing, explicit content, real-person likeness or impersonation, minors as characters, a separate Next.js web app, microservices.

## Repository layout (target — do not scaffold before the design gate)

```
apps/mobile            Expo Router app (iOS + web). UI only; talks to apps/server.
apps/server            Hono (Node) API: chat, memory, media, voice, auth, rate limits.
apps/imessage-bridge   Optional macOS process. Never imported by other packages.
packages/contracts     Zod schemas + inferred types for every API boundary.
packages/companions    Character definitions (identity, persona, voice, look). Data, not logic.
config/                Companion image-slot manifests. Only `companion-assets.example.json` is committed; `*.local.json` is git-ignored.
docs/                  Product, design, architecture, decisions, plan.
```

Boundaries:
- `apps/mobile` never imports provider SDKs or holds secrets. It reaches AI only through `apps/server`.
- Provider SDKs live only in `apps/server/src/providers/*`, behind interfaces defined in `apps/server/src/providers/types.ts`.
- Cross-package types come from `packages/contracts`; do not redeclare API shapes.
- `apps/imessage-bridge` talks to the server over the documented bridge API only.

## Code quality

- TypeScript `strict: true` everywhere. No `any` at module boundaries; validate external input with Zod.
- Small modules with one responsibility. Split files that mix unrelated concerns.
- Follow existing patterns before adding new ones. No speculative abstractions, frameworks, or dependencies.
- Errors are typed and user-facing errors are actionable (retry, reconnect, check settings).
- Never present a stub as working. Unimplemented features are hidden behind a flag or clearly labeled "demo"/"coming soon" in UI and docs.
- Never hardcode companion identity, copy, or images in components; read them from character config.

## Security and privacy

- No credentials in code, fixtures, screenshots, or docs. Secrets come from environment variables; `.env.example` lists every variable with a placeholder.
- Provider keys are server-side only. Anything with an `EXPO_PUBLIC_` prefix is public.
- Every conversation, memory, and media query is scoped to the authenticated user (row-level security or an explicit `userId` filter, tested).
- Users can view and delete individual memories, clear a companion's history, and delete their account data.
- Companions are fictional adult AI parody characters defined by character config (Roy and Roya presets). Show the AI PARODY badge and the short non-affiliation note; personas never claim to be, speak as, or quote a real person. No real-person likeness in committed art. PG-13 only.
- No real user conversations, generated personal images, or `.env` files in Git.
- Never commit private or third-party images or likenesses. Image overrides live in git-ignored `config/*.local.json` and `PRIVATE_ASSETS_DIR`; only `config/companion-assets.example.json` is committed.
- Public demo deployments enforce per-user rate limits, per-user daily token/image budgets, and a global spend kill switch.
- Tool calls (web search, image generation) are allowlisted, schema-validated, and capped per turn.

## Testing and validation

- Unit-test critical logic: prompt assembly, memory extraction/retrieval, provider fallback, rate limiting, bridge dedup/loop prevention, contract schemas.
- Integration-test server routes against a real local database; mock only third-party HTTP providers.
- UI changes: verify in the browser (web) and, when available, the iOS Simulator. Capture screenshots for meaningful visual changes.
- Report what was actually run. Never claim something works without running it; list what was not verified.

## Documentation

- Update `docs/decisions.md` when a decision is made or reversed (date, decision, reason).
- Keep `docs/architecture.md` and `.env.example` in sync with code.
- Keep docs about After Hours only. No unrelated background, outreach plans, or private motivations.
- Attribute third-party code, fonts, and assets in `README.md` (or `THIRD_PARTY.md`).

## Commands

```
pnpm install
pnpm dev            # server (http://localhost:8787) + Expo web (http://localhost:8081)
pnpm dev:server     # API only
pnpm dev:web        # Expo web only
pnpm dev:ios        # Expo on the iOS Simulator (macOS only)
pnpm typecheck
pnpm lint
pnpm test           # Vitest (server and packages)
pnpm companions:schema   # regenerate packages/companions/character.schema.json after schema changes
pnpm db:generate    # SQL migration from apps/server/src/db/schema.ts into apps/server/drizzle (drizzle-kit via pnpm dlx)
pnpm db:migrate     # apply migrations to DATABASE_URL, or to local PGlite when unset (stop `pnpm dev` first)
pnpm --filter @after-hours/mobile export:web   # static web build into apps/mobile/dist
```

Without `DATABASE_URL`, the server uses PGlite (in-process Postgres) in `local-data/pglite` (git-ignored) and migrates it on startup, so `pnpm dev` needs no database setup. Only one process may open that directory at a time (a `.lock` file enforces it). Docker is never required.

Expo (SDK 58) changes between releases: check the versioned docs at `https://docs.expo.dev/versions/v58.0.0/` instead of relying on memory, and add native-capable packages with `npx expo install <package>` (run in `apps/mobile`) so versions match the SDK.
