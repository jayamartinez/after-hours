# Deploying the public demo (Vercel)

The demo runs as **one Vercel project** (D-047): the web app and the API share one URL. The build (`scripts/build-vercel.mjs`, set in `vercel.json`) exports the Expo web app as static files and bundles the server into one streaming function at `/api`. The database stays on Supabase. Everything fits Vercel's free Hobby plan (non-commercial use; the demo takes no real payments).

## 1. Before you deploy

1. **Set a spend limit on the Anthropic account** (Anthropic Console, Limits). This is the only cap nothing in the app can exceed. The app's own caps (D-041, D-042) sit under it: $3 per network ever, $25 for everyone per day.
2. **Apply the database migrations** to the production database from your machine: `DATABASE_URL=<production url> pnpm db:migrate`. Do this before each deploy that adds a migration (Vercel never migrates).
3. **Get the Supabase transaction pooler URI** (Supabase, Connect, "Transaction pooler", port 6543). Serverless functions open many short connections; the transaction pooler is made for that.
4. **Supabase free projects pause after a week without activity.** Open the demo (or the Supabase dashboard) at least weekly, or resume the project before sharing the link.

## 2. Companion photos (Vercel Blob)

The repository ships no photos (D-030). Use only original images you have the rights to publish, never real people.

1. In the Vercel dashboard: Storage, Create, **Blob**, and connect it to the project.
2. Open the store and upload the images (for example `roy/hero.jpg`, `roy/avatar.jpg`, `roya/hero.jpg`, `roya/avatar.jpg`). Copy each file's URL.
3. Write the manifest with those URLs (same shape as `config/companion-assets.example.json`; every `src` must be an `https://` URL) and paste it, minified onto one line, as the `COMPANION_ASSETS_JSON` environment variable:

   ```json
   {"roy":{"hero":{"src":"https://….public.blob.vercel-storage.com/roy/hero.jpg","focal":[0.5,0.3]},"avatar":{"src":"https://…/roy/avatar.jpg"}},"roya":{"hero":{"src":"https://…/roya/hero.jpg"},"avatar":{"src":"https://…/roya/avatar.jpg"}}}
   ```

   Anyone with the demo link can see these photos.

## 3. Create the project

1. Vercel, Add New, Project, import the GitHub repository.
   - **Root Directory:** the repository root (leave it empty). `vercel.json` sets the install and build commands; leave Framework Preset as "Other".
2. Environment variables (Production):

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase **transaction pooler** URI |
   | `SESSION_SECRET` | a new random string of 32+ characters (`openssl rand -hex 32`) |
   | `ANTHROPIC_API_KEY` | your key |
   | `TRUST_PROXY` | `true` (without it every visitor shares one $3 cap) |
   | `COMPANION_ASSETS_JSON` | the photo manifest from step 2 |
   | `GLOBAL_DAILY_SPEND_CAP_USD`, `NETWORK_LIFETIME_CAP_USD` | `25`, `3` (or your own) |
   | `WEB_ACCESS` | `true` (or `false` to turn off web lookups) |
   | `KILL_SWITCH` | `false` (set `true` to stop all chat) |

   No `CORS_ORIGINS` or `EXPO_PUBLIC_API_URL`: the app calls `/api` on its own domain. Never put a secret in an `EXPO_PUBLIC_` variable.
3. Deploy, then check `https://<project>.vercel.app/api/health` returns `{"status":"ok"}`.

To check a build before pushing: `node scripts/build-vercel.mjs` writes `.vercel/output` locally (git-ignored).

## 4. After deploying

- **Smoke test:** on a phone and on a laptop (the app shows inside a phone frame there): onboarding, three messages, the paywall's "Continue free", a picture request, the reply banner and sounds, and the You tab.
- **Watch spend** in the Anthropic Console for the first days.
- **Emergency stop:** set `KILL_SWITCH=true` and redeploy; chat returns "paused" for everyone.
- **Logs:** Vercel, the project, Logs. Hobby keeps runtime logs for one hour.
- **Limits that matter on Hobby:** 300 seconds per request (a reply takes seconds), 4 hours of active CPU and 1 million function calls a month (waiting on the model does not count as CPU). Per-minute rate limits and the starter cache live in each function instance; every spend cap lives in the database, so they hold across instances.
