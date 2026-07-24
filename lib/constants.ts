/** App-wide constants. */

export const APP_NAME = "MyStockli";
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

/** Accent tokens for shell nav icons (mirrors `Accent` in components/ui/accent). */
export type NavAccent =
  | "primary"
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "teal"
  | "indigo"
  | "orange"
  | "slate";

/** Primary navigation. Every leaf item uses a unique Lucide icon name. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", accent: "emerald" },
  { href: "/portfolios", label: "Portfolio", icon: "Wallet", accent: "sky" },
  { href: "/market", label: "Market", icon: "CandlestickChart", accent: "teal" },
  { href: "/analysis/fundamentals", label: "Tools", icon: "Wrench", accent: "violet" },
  { href: "/explore/useful-links", label: "Explore", icon: "Compass", accent: "indigo" },
  { href: "/news", label: "Latest News", icon: "Newspaper", accent: "rose" },
  { href: "/watchlist", label: "Watchlist", icon: "Star", accent: "amber" },
  { href: "/alerts", label: "Alerts", icon: "Bell", accent: "orange" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
}>;

export const TOOL_NAV_ITEMS = [
  {
    href: "/analysis/prediction",
    label: "Next Day Prediction",
    icon: "Sparkles",
    accent: "violet",
  },
  {
    href: "/analysis/stock-analyzer",
    label: "Stock Analyzer",
    icon: "LineChart",
    accent: "sky",
  },
  {
    href: "/analysis/portfolio-suggestions",
    label: "Portfolio Suggestions",
    icon: "Target",
    accent: "emerald",
  },
  {
    href: "/analysis/fundamentals",
    label: "Fundamentals & Comparison",
    icon: "Scale",
    accent: "teal",
  },
  {
    href: "/analysis/pivot-points",
    label: "Stock Pivot Points",
    icon: "Crosshair",
    accent: "amber",
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
}>;

export const EXPLORE_NAV_ITEMS = [
  {
    href: "https://www.worldmonitor.app/dashboard?lat=28.1153&lon=14.2733&zoom=1.65&view=global&timeRange=7d&layers=conflicts%2Cbases%2Cmilitary",
    label: "World Monitor",
    icon: "Radar",
    accent: "sky",
    external: true,
  },
  {
    href: "/explore/useful-links",
    label: "Useful Links",
    icon: "Link2",
    accent: "indigo",
  },
  {
    href: "/explore/board-meetings",
    label: "Board Meetings",
    icon: "CalendarDays",
    accent: "violet",
  },
  {
    href: "/explore/book-closures",
    label: "Book Closures",
    icon: "Gift",
    accent: "rose",
  },
  {
    href: "/explore/dividend-history",
    label: "Dividend History",
    icon: "History",
    accent: "amber",
  },
  {
    href: "/youtubers",
    label: "Youtuber Videos",
    icon: "PlaySquare",
    accent: "orange",
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
  external?: boolean;
}>;

/** Superadmin-only Control Panel links (not shown under Explore). */
export const CONTROL_PANEL_NAV_ITEMS = [
  { href: "/control-panel/users", label: "All Users", icon: "Users", accent: "slate" },
  {
    href: "/control-panel/edit-funds-holdings",
    label: "Edit Funds Holdings",
    icon: "FolderKanban",
    accent: "violet",
  },
  {
    href: "/control-panel/lock-public-pages",
    label: "Lock Public Pages",
    icon: "Lock",
    accent: "indigo",
  },
  { href: "/control-panel/servers", label: "Servers", icon: "Server", accent: "sky" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
}>;

/** @deprecated Use CONTROL_PANEL_NAV_ITEMS */
export const ADMIN_NAV_ITEMS = CONTROL_PANEL_NAV_ITEMS;

export const MARKET_NAV_ITEMS = [
  {
    label: "Pakistan Stock Market",
    icon: "Landmark",
    accent: "emerald",
    children: [
      { href: "/market", label: "Stock Market", icon: "TrendingUp", accent: "emerald" },
      { href: "/market/sectors", label: "Sector Performance", icon: "BarChart3", accent: "sky" },
      { href: "/market/mutual-funds", label: "Mutual Funds", icon: "BadgePercent", accent: "violet" },
      { href: "/market/funds-breakdown", label: "Funds Breakdown", icon: "PieChart", accent: "amber" },
      { href: "/market/mf-top-holdings", label: "Top Holdings by MFs", icon: "Trophy", accent: "orange" },
      {
        href: "/market/strategy",
        label: "Funds Daily Returns Report",
        icon: "Activity",
        accent: "teal",
      },
      { href: "/market/fipi-lipi", label: "FIPI / LIPI Data", icon: "ArrowLeftRight", accent: "indigo" },
      { href: "/market/etfs", label: "Exchange Traded Funds", icon: "Layers3", accent: "rose" },
    ],
  },
  {
    label: "International Markets",
    icon: "Globe2",
    accent: "sky",
    children: [
      { href: "/market/us", label: "USA S&P 500", icon: "Flag", accent: "indigo" },
      { href: "/market/india", label: "India Stock Market", icon: "Map", accent: "orange" },
      { href: "/market/world", label: "World View", icon: "Earth", accent: "teal" },
    ],
  },
  { href: "/market/oil", label: "Oil Market", icon: "Droplets", accent: "slate" },
  { href: "/market/commodities", label: "Commodities", icon: "Boxes", accent: "amber" },
  { href: "/market/crypto", label: "Crypto Market", icon: "Bitcoin", accent: "orange" },
] as const;
