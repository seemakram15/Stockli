# Guest browsing & Customisation

Lets unauthenticated visitors browse the whole app. Personal pages (Dashboard,
Portfolio, Watchlist, Alerts) show sample data instead of a login wall; public
pages (Market, Tools, Explore, stock detail) show real data to everyone. A
superadmin panel at `/admin/customisation` controls it all.

## Three modes, one boolean

`isSampleMode()` (`lib/auth/roles.ts`) is `true` in exactly two cases:

1. **Demo mode** — `isDemoMode` (`lib/config.ts`), true when no real Supabase
   env vars are configured at all. Deploy-time, affects every visitor
   including admins. Unrelated to guest browsing — don't conflate the two.
2. **Guest mode** — a real deployment, real Supabase, but *this request* has
   no authenticated user and the current page + site settings allow guest
   access. Per-request, only affects unauthenticated visitors.

Every service/action that used to check `isDemoMode` to decide "serve fixture
data" now checks `await isSampleMode()` instead — so guests transparently get
the same `DEMO_PORTFOLIOS`/`DEMO_HOLDINGS`/etc. fixtures
(`lib/demo/data.ts`) that demo mode has always used. Real logged-in users
always get `false` — zero behavior change for them.

## Where the guest decision is made

`getSessionContext()` (`lib/auth/roles.ts`) is the single chokepoint, called
once per request from `app/(app)/layout.tsx`. When there's no real user and
not demo mode, it:

1. Reads the current pathname from the `x-pathname` header (set by
   `lib/supabase/middleware.ts` on every request — same mechanism as the
   existing `x-stockli-user` forwarded-user header).
2. Resolves that pathname to a page-registry key
   (`lib/access/page-registry.ts`).
3. Checks `getAppSettings()` (`lib/services/app-settings.ts`, Redis-cached
   via `getStaleCached`): is guest browsing enabled globally, and is this
   specific page enabled?
4. If yes → returns a synthetic `GUEST_USER` session with `isGuest: true`
   plus a `guestPageAccess` map (for nav lock icons). If no → falls through
   to the original `user: null`, which `app/(app)/layout.tsx`'s **unchanged**
   `if (!user) redirect("/login")` catches exactly as before.

This means adding guest support required almost no change to `layout.tsx`'s
core gate — it just sometimes receives a truthy synthetic user now.

## Adding a new nav page

`lib/access/page-registry.ts` derives its list from the existing nav
constants (`NAV_ITEMS`, `MARKET_NAV_ITEMS`, `TOOL_NAV_ITEMS`,
`EXPLORE_NAV_ITEMS` in `lib/constants.ts`) — add your page to the normal nav
constant and it appears in the registry automatically, classified `"open"`
by default. If the new page is user-specific (like Dashboard/Portfolio), add
its `href` to `DUMMY_HREFS` in `page-registry.ts` so it renders sample data
for guests instead of erroring.

A missing settings row for a page means **enabled** — so new pages default
open without needing a migration.

`/account` and `/admin*` are deliberately excluded from the registry. An
unresolved pathname never gets guest-synthesized, so these routes always
require a real login (and superadmin role for admin), unaffected by any
toggle.

## Settings storage

Table `app_settings` (`supabase/migrations/0014_app_settings.sql`):
`key text primary key, enabled boolean`. Public `SELECT`; `INSERT`/`UPDATE`
gated by `is_superadmin()`. Two master keys are seeded:
`guest_browsing_enabled` and `guest_login_popup_enabled`. Per-page rows are
named `page:<key>` and are created on first toggle from the Customisation UI
— never pre-seeded.

`getAppSettings()` reads all rows via `getStaleCached` (15s fresh / 120s
stale window) — only runs for the "no real user" branch of
`getSessionContext()`, so real logged-in users pay zero added latency.
`updateAppSetting(key, enabled)` (superadmin-only) upserts a row and calls
`invalidateStaleCache` so the change propagates immediately rather than
waiting out the TTL.

## Testing locally

1. Open the app in an incognito window (no session cookie).
2. Visit `/dashboard`, `/portfolios`, `/watchlist`, `/alerts` — should show
   sample data with a "You're browsing with sample data" banner; any
   add/edit/delete action should show a "Sign in to save changes" message.
3. Visit `/market`, `/analysis/*`, `/explore/*`, `/stock/[symbol]` — should
   show real data, no login prompt.
4. Visit `/account` or `/admin` — should redirect straight to `/login`.
5. As a superadmin, visit `/admin/customisation`, toggle a single page off,
   then re-check step 2/3 for that page in a fresh incognito tab — should now
   redirect to `/login`, and the nav item should show a lock icon.
6. Toggle "Enable public browsing" off — every guest route should redirect to
   `/login` again, matching pre-feature behavior.
