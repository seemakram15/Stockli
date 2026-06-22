/** App-wide constants. */

export const APP_NAME = "Sahm";
export const APP_TAGLINE = "Track your PSX portfolio";

/** Price cache TTL in seconds (matches the open-source PSX ecosystem ~15 min). */
export const PRICE_CACHE_TTL_SECONDS = 15 * 60;

/** Client-side SWR poll interval (ms). Live-ish, backed by the server cache. */
export const CLIENT_REFRESH_MS = 30_000;

/** How fragile the free data is — surfaced to the user. */
export const DATA_DELAY_LABEL = "Delayed ~15 min";

/** Base currency. PSX trades in PKR only. */
export const BASE_CURRENCY = "PKR";
export const CURRENCY_SYMBOL = "Rs";

/** PSX trading hours (Pakistan Standard Time, UTC+5, no DST). */
export const PSX_TIMEZONE = "Asia/Karachi";
export const PSX_MARKET_OPEN = { hour: 9, minute: 30 };
export const PSX_MARKET_CLOSE = { hour: 15, minute: 30 };
/** Mon–Fri trading; Sat/Sun closed. (0 = Sunday) */
export const PSX_TRADING_DAYS = [1, 2, 3, 4, 5];

export const KSE100_SYMBOL = "KSE100";

/** Primary navigation. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/portfolios", label: "Portfolios", icon: "Wallet" },
  { href: "/watchlist", label: "Watchlist", icon: "Star" },
  { href: "/market", label: "Market", icon: "TrendingUp" },
  { href: "/alerts", label: "Alerts", icon: "Bell" },
] as const;
