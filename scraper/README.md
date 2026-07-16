# NCCPL FIPI/LIPI scraper

Standalone service that fetches daily FIPI/LIPI (foreign/local investor flow)
data from NCCPL for the main Stockli app. It exists as a separate service
because NCCPL is behind Cloudflare and its Market Information page is a
client-rendered SPA — a plain HTTP request gets a 403 challenge page, so a real
(stealth) browser is required to load the page, solve the challenge, and
replay its tab -> date -> search flow. That's too heavy for a Vercel
serverless function, so it runs as its own always-on service.

## What it does

1. Loads `https://www.nccpl.com.pk/market-information` with
   [Scrapling](https://github.com/D4Vinci/Scrapling)'s `StealthyFetcher`
   (Cloudflare-solving headless browser).
2. For each of the 4 reports (FIPI Normal, FIPI Sector Wise, LIPI Normal, LIPI
   Sector Wise): clicks the tab, sets the date, clicks Search, and captures the
   JSON response NCCPL's own frontend receives.
3. Normalizes NCCPL's real client-type/sector names into this app's fixed
   category and sector buckets (see `nccpl.py`'s keyword tables) and returns
   one JSON object per day matching the Next.js app's `FipiLipiDay` shape.

`GET /fipi-lipi?date=YYYY-MM-DD` (date optional, defaults to today) returns
that day's data. Results are cached in memory for 6 hours since a trading
day's figures don't change once NCCPL publishes them.

## Deploying

Any host that runs a persistent container works (Railway, Render, Fly.io,
a VPS). It won't run in Vercel/AWS Lambda-style serverless — the browser
binary and cold-start time don't fit.

```bash
# Railway
railway init
railway up   # builds scraper/Dockerfile
railway variables set SCRAPER_API_KEY=<generate-a-random-secret>
railway domain   # get the public URL
```

The Dockerfile installs Playwright's Chromium + OS deps during build, so no
extra setup is needed beyond `railway up` (or `docker build .` / `docker run`
for any other host).

## Wiring it into the Next.js app

Set these on the Next.js app's deployment (Vercel project settings):

- `NCCPL_SCRAPER_URL` — the deployed service's base URL, e.g.
  `https://your-service.up.railway.app`
- `NCCPL_SCRAPER_API_KEY` — must match `SCRAPER_API_KEY` set on the scraper
  service (optional but recommended so randoms can't hit your scraper and run
  up its bandwidth/compute)

Once both are set, `lib/services/fipi-lipi.ts` will call this service for the
last 5 trading days on every cache refresh (older history stays sample-filled
until it's re-scraped — see `LIVE_SCRAPE_DAYS` in that file if you want more).

## Known limitations / things to watch

- **Cloudflare can still change its mind.** This works today (verified
  manually against the live site), but Cloudflare's bot-detection heuristics
  evolve. If scrapes start failing, check `GET /health` and the service logs
  first, then re-verify the tab/date-input/search-button element IDs and the
  `/api/*/data` endpoint contract haven't changed (open the site's Market
  Information page in DevTools > Network and repeat the FIPI Normal search).
- **Rate limiting.** Repeated automated requests in quick succession got a 403
  during testing even mid-session, so the scraper deliberately paces itself
  (~1-3s between actions). Don't lower `LIVE_SCRAPE_DAYS` aggressively or add
  concurrent scrape requests without similar pacing.
- **Category mapping is best-effort.** NCCPL's raw `CLIENT_TYPE`/`SECTOR_NAME`
  strings are matched into this app's fixed buckets by keyword (see
  `_FIPI_KEYWORDS` / `_LIPI_KEYWORDS` / `_SECTOR_KEYWORDS` in `nccpl.py`). If
  NCCPL adds a new sector or renames a category, unmatched sectors silently
  fall into "Others" — check `missingReports` in the response and the app
  logs periodically.
