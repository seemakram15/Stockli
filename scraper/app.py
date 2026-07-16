"""
Thin HTTP wrapper around nccpl.scrape_day(), deployed as a standalone service
(NCCPL's Cloudflare protection needs a real stealth browser, which doesn't fit
in the Next.js app's serverless functions). The Next.js app calls this over
HTTP and maps the response into its own FipiLipiData shape.
"""

import os
import threading
import time
from datetime import date as date_cls

from fastapi import FastAPI, Header, HTTPException

from nccpl import scrape_day

app = FastAPI(title="NCCPL FIPI/LIPI scraper")

API_KEY = os.environ.get("SCRAPER_API_KEY")

_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 6 * 60 * 60  # a trading day's data doesn't change once published


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/fipi-lipi")
def fipi_lipi(date: str | None = None, x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")

    target_date = date or date_cls.today().isoformat()

    with _cache_lock:
        cached = _cache.get(target_date)
        if cached and (time.time() - cached[0]) < CACHE_TTL_SECONDS:
            return cached[1]

    try:
        result = scrape_day(target_date)
    except Exception as exc:  # noqa: BLE001 - surface scraper failures as 502s
        raise HTTPException(status_code=502, detail=f"scrape failed: {exc}") from exc

    with _cache_lock:
        _cache[target_date] = (time.time(), result)

    return result
