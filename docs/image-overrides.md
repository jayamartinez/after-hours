# Companion image overrides

Roy and Roya ship with original default art in `packages/companions/assets/`. For a private demo you can swap any image slot without code changes. Overrides never go into Git: `private-assets/` and `config/*.local.json` are git-ignored. Slot ratios and resolution rules are in `docs/architecture.md` ("Companion image slots"). To change a companion's name, copy, personality, or default focal/alt text instead, use the character config ([companions.md](companions.md)); images stay in this manifest.

> A server reachable from the internet serves these files to anyone with the URL. Use private assets only on private deployments.

## Steps

1. Put images in `private-assets/<companion-id>/` at the repo root, e.g. `private-assets/roy/hero.jpg`. Allowed: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
2. Copy the example manifest and edit it:

   ```sh
   cp config/companion-assets.example.json config/companion-assets.local.json
   ```

   Slots: `hero` (3:4), `avatar` (1:1), `gallery` (two 4:5 entries; `null` keeps that default). Each entry is `{ "src": ..., "focal"?: [x, y], "alt"?: "..." }`:
   - `src`: a path relative to `private-assets/` (no `..`), or an `https://` URL (`http://` only for `localhost`).
   - `focal`: crop anchor, each value 0 to 1. Omit to keep the slot default.
3. Optional environment variables (in `.env`): `PRIVATE_ASSETS_DIR` (default `private-assets`), `COMPANION_ASSET_MANIFEST` (default `config/companion-assets.local.json`), `PUBLIC_SERVER_URL` (origin used in image URLs; default is the request's origin).
4. Start or restart the server (`pnpm dev` or `pnpm dev:server`). Manifest edits are picked up on the next `GET /companions`; a restart is only needed after changing env vars. Reload the app.

If the manifest is invalid JSON or fails validation, the server logs a warning and uses the default art for everything. A relative `src` whose file does not exist falls back to that slot's default. Unknown companion ids are ignored.

Check the result: `curl http://localhost:8787/companions` shows each slot's `uri` (`null` means default art).

## Web

`pnpm dev` serves the app at `http://localhost:8081` and the API at `http://localhost:8787`. The defaults match; no extra configuration is needed. If you change ports or origins, set `CORS_ORIGINS` on the server and `EXPO_PUBLIC_API_URL` for the app.

## iOS Simulator and devices

The app reads `EXPO_PUBLIC_API_URL` (from `apps/mobile/.env` or your shell) at bundle time. Set it to your dev machine's LAN IP, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:8787`, so image URLs and API calls reach the server from the Simulator or a device, and set `PUBLIC_SERVER_URL` to the same origin so private-asset URLs use it too. Restart Expo after changing it. If the server is unreachable, the app shows bundled profiles and default art.
