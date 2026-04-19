<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Architecture

Three independent apps share a single Supabase PostgreSQL backend — **not** an npm workspaces monorepo. Each app has its own `package.json` and `npm install`:

| App | Path | Dev command | Default port |
|-----|------|-------------|-------------|
| **Studio** (Next.js 16) | `gentrix/` | `npm run dev` | 3000 |
| **Chameleon** webshop (Vite + React 18) | `gentrix/frontends/chameleon/` | `npm run dev` | 8080 |
| **Booking** (Vite + React 18) | `gentrix/frontends/booking/` | `npm run dev` | 8080 |

Chameleon and Booking both default to port 8080; if running simultaneously the second will auto-pick the next available port.

### Lint / Test / Build

All commands are documented in each app's `package.json` scripts. Standard commands:

- **Lint**: `npm run lint` (ESLint 9 flat config for all three apps)
- **Test**: `npm run test` (Vitest for all three apps)
- **Build**: `npm run build` (Next.js build / Vite build)

The main app lint has 3 pre-existing `react-hooks/set-state-in-effect` errors and 1 `no-unused-vars` warning — these are in existing code and not blocking.

Main app Vitest: tests under `lib/ai/_archive/` have broken imports (archived code); all active tests pass. Exclude `_archive` tests from your focus.

### Environment variables

The main app needs `.env.local` in `gentrix/` (see `.env.example`). At minimum, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`. Without real Supabase credentials, the app still starts and renders static/SSR pages but any data-dependent features will fail.

Chameleon needs `.env` in `frontends/chameleon/` (see `.env.example`). Booking: voor **live** boeken tegen de Next-API draai je `npm run dev` in `gentrix/` op poort 3000 en Vite proxy’t `/api` (zie `frontends/booking/vite.config.ts`). Zie `frontends/booking/.env.example` voor `VITE_GENTRIX_API_BASE` / productie-CORS.

Set `STUDIO_PROMO_VIDEO=0` in `.env.local` to disable Playwright-based promo video generation (avoids needing Chromium).

### Gotchas

- Next.js 16 uses `--hostname localhost` flag in the dev script to prevent cross-origin blocking of `/_next/*` assets.
- The `middleware.ts` convention is deprecated in Next.js 16; the codebase still uses it (with a console warning). Use `proxy` for new work per Next.js docs.
- `jsdom` is pinned to 25.0.1 via `overrides` in `package.json` to avoid ESM compatibility issues with newer versions.
