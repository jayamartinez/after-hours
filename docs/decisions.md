# After Hours — decisions

Log of product, architecture, and design decisions. Add a row when a decision is made or reversed; never delete rows. Status values: **Accepted**, **Proposed**, **Pending** (waiting on the developer), **Open** (not yet framed), **Reversed**.

| ID | Date | Decision | Status | Reason |
|---|---|---|---|---|
| D-001 | 2026-10-15 | One Expo Router app serves iOS and web. No separate Next.js web app. | Accepted | One codebase for the iPhone app and the browser demo; avoids duplicate UI work. |
| D-002 | 2026-10-15 | Hono on Node as the API, deployed as a single server. | Proposed | Small, typed HTTP layer with a simple deploy; no microservices. |
| D-003 | 2026-10-15 | Supabase Postgres for data, Auth, and Storage. Anonymous auth for the demo. | Proposed | Managed Postgres with per-user row scoping and object storage; anonymous auth lets the demo run without sign-up. |
| D-004 | 2026-10-15 | pnpm workspaces. `packages/contracts` holds Zod schemas shared by all apps. | Proposed | One install and one set of types across mobile and server; schemas validate external input at every boundary. |
| D-005 | 2026-10-15 | A hosted primary chat model with a secondary fallback, both behind a `ChatModel` interface. A local inference provider is a separate optional provider, not a fallback. | Proposed | Keeps provider SDKs in `apps/server/src/providers/*` and makes swaps cheap. Local models differ in quality and latency, so they are not silent fallbacks. |
| D-006 | 2026-10-15 | Visual mood "hotel bar after last call": dark-first, brass accent, Instrument Serif for display and Inter for UI. | Accepted (direction pending) | Establishes a warm, restrained identity distinct from generic AI apps. Final direction set by D-014 (2026-10-15). |
| D-007 | 2026-10-15 | Only two companions: Roy and Roya, fictional AI parody characters, aged 25, disclosed as "AI PARODY". Limited-scope polished demo. | Accepted | Replaces the earlier two-companion proposal (superseded 2026-10-15). Fictional by design, so no real-person likeness. |
| D-008 | 2026-10-15 | No real billing. The subscription flow is a mock paywall with an explicit demo state. | Accepted | Avoids payment handling and compliance scope for a portfolio/open-source build; the demo state must be visible to users. |
| D-009 | 2026-10-15 | iMessage support is optional, runs as a Mac-hosted bridge, is off by default, and requires explicit opt-in. No SIP changes. | Accepted | Apple Messages has no public server API; the bridge stays isolated in `apps/imessage-bridge` and never imported by other packages. |
| D-010 | 2026-10-15 | Open-source license. | Open | Developer has not chosen. No license file until confirmed. |
| D-011 | 2026-10-15 | Providers for chat, image generation, speech-to-text, and text-to-speech. | Open | Depends on cost, quality, and terms; to be chosen per capability behind server-side interfaces. |
| D-012 | 2026-10-15 | Hosting target for the server and the public web demo. | Open | Depends on cost limits and spend controls in Phase 6. |
| D-013 | 2026-10-15 | Original stylized character art may be generated in Paper (authorized 2026-10-15). Art must be non-photoreal and must not depict a real person. | Accepted | Supersedes the earlier no-generated-portraits rule. Keeps character art fictional and original. |
| D-014 | 2026-10-15 | Gate A: chat Lamplight (A, primary; Chat B archived), discovery Spotlight card (primary, Companions tab), The Cast List (B, secondary browse state). Spotlight card style for the onboarding reveal and profile hero. Changed 2026-10-16: discovery primary is Spotlight, not The Cast List. | Accepted (2026-10-15; changed 2026-10-16) | Developer approved the baseline. Applies to the revised Roy & Roya content. Originally a Pending choice of A or B directions. |
| D-015 | 2026-10-15 | Parody guardrails: "AI PARODY" badge; no real names, companies, or quotes except the referenced person's name in one non-affiliation note; no implied endorsement; companions never claim to be or speak as a real person; PG-13 only. Amended 2026-10-16: long repeated disclaimers removed in favor of the badge and one short footer note. | Accepted (amended 2026-10-16) | Companions are satirical fictional characters and must not be mistaken for real people; one clear note is enough. |
| D-016 | 2026-10-15 | Gate A2: developer approves the revised Roy & Roya designs before implementation. | Accepted (2026-10-16) | Developer approved revision v3 ("Approved, v3 looks good. Let's move into implementation.") and authorized implementation in tested milestones. |
| D-017 | 2026-10-16 | Configurable image slots via an optional git-ignored manifest; defaults are original painted art; no third-party photos or likenesses in the repo. | Accepted | Keeps the public repo clean while letting private demos customize art without code changes. |
| D-018 | 2026-10-16 | Fixed slot ratios (hero 3:4, avatar 1:1, gallery 4:5) with configurable focal points; 2 gallery images per companion. | Accepted | Consistent crops across discovery, profile, onboarding and chat; fewer, stronger images. |
| D-019 | 2026-10-16 | Hosted Supabase for the demo database. Docker is optional, never required for local development. PGlite (in-process Postgres) for database integration tests. | Accepted | Keeps setup to `pnpm install` plus env vars for a short demo build; tests stay fast and need no containers. Refines D-003. |
| D-020 | 2026-10-16 | Companions are defined by a validated `CharacterConfig`; Roy and Roya ship as JSON presets in `packages/companions/presets`; git-ignored `config/companions.local.json` overrides any field; UI and prompt assembly read only from config; optional dev editor gated by `DEV_EDITOR=true` and localhost. | Accepted | Easy customization without code changes; keeps identity out of UI components. No character-creation system. |

## Gate A record

- Approved chat direction: Lamplight (A). Chat B "Late Edition" kept as an archived alternative.
- Approved discovery direction: Spotlight card (primary, Companions tab); The Cast List (B) is a secondary browse state. Spotlight card style for the onboarding reveal and profile hero. Changed 2026-10-16.
- Content: Roy & Roya (revision v3, 2026-10-16). Gate A2 (D-016) approved 2026-10-16; implementation started on feat/app-shell.
- Approved by / date: developer, 2026-10-15; baseline updated 2026-10-16.
