# AGENTS.md

## Cursor Cloud specific instructions

This repo is a two-package layout, both npm-based:

- Web app (root `/workspace`) — Next.js 15 App Router (the primary product + REST backend). Brand name "Stockli", package name `stock-portfolio`.
- Mobile app (`mobile/`) — Expo / React Native (`stockli-mobile`). Has no backend of its own; it calls the web app's `/api` routes and Supabase.

Node is pinned to the version in `.nvmrc` (`22.23.1`). The cloud VM has a `/exec-daemon/node` earlier in `PATH` (a close-but-different Node 22.x), so `node -v` may not reflect the pinned version even after `nvm use`. To force the pinned version for a command, prepend nvm's bin: `export PATH="$HOME/.nvm/versions/node/$(cat .nvmrc)/bin:$PATH"`.

### Web app (root) — the service to run

- Standard commands live in `package.json`: `npm run dev`, `npm run lint`, `npm run build`, `npm start`. `README.md` documents `npm run restart:all` (a dev wrapper via `scripts/restart-all.sh`).
- Run on port 3001 (`PORT=3001 npm run dev`). The app's configured `siteUrl` and README both assume `http://localhost:3001`, not the Next.js default 3000. `restart:all` also uses 3001.
- Demo mode: the app is designed to boot fully navigable with zero external services. When real Supabase credentials are absent it enters demo mode (see `lib/config.ts` → `isDemoMode`) and serves sample data with live-style prices. Redis, Z.AI, PSX, and fundamentals all degrade gracefully when unconfigured. No `.env.local` is required just to run and browse.
- Demo mode does NOT persist writes: create/save actions (e.g. creating a portfolio) show "Sign in to save changes". To test real persistence you need a Supabase project + `DATABASE_URL` (see `.env.example`). Read-only flows (search, market data, charts, navigation) work fully in demo mode.
- `npm run build` runs `npm run migrate` first (`scripts/apply-migrations.mjs`). Migrations skip gracefully when no `DATABASE_URL` is set locally, but FAIL if `CI`, `VERCEL`, or `REQUIRE_DB_MIGRATIONS=true` is set with no DB URL. Do not export `CI=true` when running a local build without a database.

### Gotchas

- Anti-scraper middleware (`middleware.ts`) returns `403 Forbidden` to requests with a non-browser user agent (e.g. plain `curl`). Health checks / smoke tests must send a browser `User-Agent` header, otherwise a healthy server looks broken.
- `npm run lint` (root) also lints `mobile/` and currently reports pre-existing errors/warnings there (mostly `no-explicit-any`, `no-require-imports`). The web app's own code is lint-clean. Do not treat the pre-existing `mobile/` lint failures as regressions.
- There is no automated test suite in either package (no jest/vitest/playwright). Verification is manual; see `docs/guest-browsing.md`.

### Mobile app (`mobile/`)

- Separate npm project: `cd mobile && npm install`, then `npm start` / `npm run android` / `npm run ios` (Expo). Building/running natively needs the Expo/EAS toolchain and a device/emulator, and it points at the web backend via `EXPO_PUBLIC_SITE_URL` (`mobile/.env.example`). Not required to run or test the web product.
