# Deploying the public demo

After Hours has three parts to host: the **server** (one Node process that streams replies), the **web app** (static files from the Expo web export), and the **database** (the Supabase Postgres you already use). This guide uses Render for the server and Vercel for the web app; any host that runs a long-lived Node process (Railway, Fly.io) works the same way for the server, and any static host (Netlify, Cloudflare Pages) works for the web app.

## 1. Before you deploy

1. **Set a spend limit on the Anthropic account** (Anthropic Console, Limits). This is the only cap nothing in the app can exceed. The app's own caps (D-041, D-042) sit under it: $3 per network ever, $25 for everyone per day.
2. **Apply the database migrations** to the production database: `DATABASE_URL=<production url> pnpm db:migrate`. Run it from your machine before each deploy that adds a migration.
3. **Decide on companion photos.** The repo ships no images (D-030); without them every photo slot shows a loading pulse. To show photos, upload them to a public bucket (Supabase Storage works) and write a manifest whose `src` values are those `https://` URLs (see `docs/image-overrides.md`). Only publish images you have the rights to use; anything you configure is visible to everyone who opens the demo.

## 2. Server (Render)

1. Create a **Web Service** from the GitHub repo.
   - **Root directory:** the repository root.
   - **Build command:** `pnpm install --frozen-lockfile`
   - **Start command:** `pnpm --filter @after-hours/server start`
   - **Instance:** the free tier sleeps after 15 minutes idle, so the first message after a quiet spell waits about a minute; the cheapest paid tier stays awake.
2. Set the environment variables (from `.env.example`):

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase session pooler URI |
   | `SESSION_SECRET` | a new random string of 32+ characters (`openssl rand -hex 32`) |
   | `ANTHROPIC_API_KEY` | your key |
   | `CORS_ORIGINS` | the web app's URL, e.g. `https://after-hours.vercel.app` |
   | `TRUST_PROXY` | `true` (Render sits in front of the server; without it every visitor shares one $3 cap) |
   | `PUBLIC_SERVER_URL` | the server's own URL, e.g. `https://after-hours-api.onrender.com` |
   | `GLOBAL_DAILY_SPEND_CAP_USD`, `NETWORK_LIFETIME_CAP_USD` | `25`, `3` (or your own) |
   | `WEB_ACCESS` | `true` (or `false` to turn off web lookups) |
   | `KILL_SWITCH` | `false` (set `true` to stop all chat immediately) |
   | `DEV_EDITOR` | leave unset (`false`) |
   | `COMPANION_ASSET_MANIFEST` | only if you serve photos: path of the manifest file (Render "Secret Files" can provide it) |

   `PORT` is set by Render; the server reads it.
3. Deploy, then check `https://<server>/health` returns 200.

## 3. Web app (Vercel)

1. Create a project from the GitHub repo with **Root Directory** `apps/mobile`. `apps/mobile/vercel.json` sets the install and build commands, the `dist` output, and the rewrite that sends every path to `index.html` (the web app is a single-page app).
2. Set `EXPO_PUBLIC_API_URL` to the server URL from step 2. It is baked into the bundle at build time, so redeploy after changing it. Every `EXPO_PUBLIC_` value is public; never put a secret in one.
3. Deploy, open the URL, and go through onboarding once.

## 4. After deploying

- **Smoke test:** onboarding, three messages, the paywall's "Continue free", a picture request, and the You tab.
- **Watch spend** in the Anthropic Console for the first days.
- **Emergency stop:** set `KILL_SWITCH=true` on the server and redeploy; chat returns "paused" for everyone.
- **One server instance:** per-minute rate limits and the starter cache live in memory, so run a single instance (the default).
