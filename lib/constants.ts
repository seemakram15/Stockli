/** App-wide constants. */

export const APP_NAME = "Stockli";
export const APP_TAGLINE = "Track every market portfolio";

/** Price cache TTL in seconds. Keep holdings close to market-watch freshness. */
export const PRICE_CACHE_TTL_SECONDS = 60;

/** Client-side SWR poll interval (ms). Live-ish, backed by the server cache. */
export const CLIENT_REFRESH_MS = 30_000;

/** How fragile the free data is — surfaced to the user. */
export const DATA_DELAY_LABEL = "Delayed ~10 min";

/** Base currency. PSX trades in PKR only. */
export const BASE_CURRENCY = "PKR";
export const CURRENCY_SYMBOL = "Rs";

/** PSX trading hours (Pakistan Standard Time, UTC+5, no DST). */
export const PSX_TIMEZONE = "Asia/Karachi";
export const PSX_MARKET_OPEN = { hour: 9, minute: 32 };
export const PSX_MARKET_CLOSE = { hour: 15, minute: 30 };
/** Mon–Fri trading; Sat/Sun closed. (0 = Sunday) */
export const PSX_TRADING_DAYS = [1, 2, 3, 4, 5];

export const KSE100_SYMBOL = "KSE100";

/** Primary navigation. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/portfolios", label: "Portfolio", icon: "Wallet" },
  { href: "/market", label: "Market", icon: "TrendingUp" },
  { href: "/analysis/fundamentals", label: "Tools", icon: "FileText" },
  { href: "/explore/useful-links", label: "Explore", icon: "PlaySquare" },
  { href: "/watchlist", label: "Watchlist", icon: "Star" },
  { href: "/alerts", label: "Alerts", icon: "Bell" },
] as const;

export const TOOL_NAV_ITEMS = [
  {
    href: "/analysis/stock-analyzer",
    label: "Stock Analyzer",
    icon: "LineChart",
  },
  {
    href: "/analysis/portfolio-suggestions",
    label: "Portfolio Suggestions",
    icon: "Target",
  },
  {
    href: "/analysis/fundamentals",
    label: "Fundamentals & Comparison",
    icon: "FileText",
  },
  {
    href: "/analysis/pivot-points",
    label: "Stock Pivot Points",
    icon: "Target",
  },
] as const;

export const EXPLORE_NAV_ITEMS = [
  {
    href: "https://www.worldmonitor.app/dashboard?lat=28.1153&lon=14.2733&zoom=1.65&view=global&timeRange=7d&layers=conflicts%2Cbases%2Cmilitary",
    label: "World Monitor",
    icon: "Globe2",
    external: true,
  },
  {
    href: "/explore/useful-links",
    label: "Useful Links",
    icon: "Link2",
  },
  {
    href: "/explore/board-meetings",
    label: "Board Meetings",
    icon: "CalendarDays",
  },
  {
    href: "/explore/book-closures",
    label: "Book Closures",
    icon: "Gift",
  },
  {
    href: "/explore/dividend-history",
    label: "Dividend History",
    icon: "History",
  },
  {
    href: "/youtubers",
    label: "Youtuber Videos",
    icon: "PlaySquare",
  },
] as const;

export const MARKET_NAV_ITEMS = [
  {
    label: "Pakistan Stock Market",
    icon: "Landmark",
    children: [
      { href: "/market", label: "Stock Market", icon: "TrendingUp" },
      { href: "/market/sectors", label: "Sector Performance", icon: "LineChart" },
      { href: "/market/mutual-funds", label: "Mutual Funds", icon: "BadgePercent" },
      { href: "/market/funds-breakdown", label: "Funds Breakdown", icon: "PieChart" },
      { href: "/market/mf-top-holdings", label: "Top Holdings by MFs", icon: "Trophy" },
      { href: "/market/strategy", label: "Funds Daily Returns Report", icon: "Target" },
      { href: "/market/etfs", label: "Exchange Traded Funds", icon: "Layers3" },
    ],
  },
  {
    label: "International Markets",
    icon: "Globe2",
    children: [
      { href: "/market/us", label: "USA S&P 500", icon: "LineChart" },
      { href: "/market/india", label: "India Stock Market", icon: "CandlestickChart" },
      { href: "/market/world", label: "World View", icon: "Globe2" },
    ],
  },
  { href: "/market/oil", label: "Oil Market", icon: "Droplets" },
  { href: "/market/commodities", label: "Commodities", icon: "Boxes" },
  { href: "/market/crypto", label: "Crypto Market", icon: "Bitcoin" },
] as const;
