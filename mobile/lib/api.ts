import { supabase } from "./supabase";

const BASE = process.env.EXPO_PUBLIC_SITE_URL ?? "";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const MOBILE_UA = "StockliApp/1.0 (Mobile; React-Native)";

async function get<T>(path: string, isPrivate = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": MOBILE_UA };
  if (isPrivate) Object.assign(headers, await authHeaders());
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, isPrivate = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": MOBILE_UA };
  if (isPrivate) Object.assign(headers, await authHeaders());
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  market: {
    public: () => get<{ data: unknown }>("/api/public/market"),
    search: (q: string) =>
      get<{ results: unknown[] }>(`/api/search?q=${encodeURIComponent(q)}`),
    sectorLeaders: () => get<{ data: unknown }>("/api/public/sector-leaders"),
    globalMarket: () => get<{ data: unknown }>("/api/public/global-market"),
    fipiLipi: () => get<{ data: unknown }>("/api/public/fipi-lipi"),
    mufap: (q?: string) =>
      get<{ data: unknown }>(`/api/public/mufap${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    stockFundamentals: (symbol: string) =>
      get<{ data: unknown }>(`/api/public/stock-fundamentals?symbol=${symbol}`),
    stockFinancials: (symbol: string) =>
      get<{ data: unknown }>(`/api/public/stock-financials?symbol=${symbol}`),
    pivotPoints: (symbol: string) =>
      get<{ data: unknown }>(`/api/public/pivot-points?symbol=${symbol}`),
    dividendHistory: (symbol?: string) =>
      get<{ data: unknown }>(
        `/api/public/dividend-history${symbol ? `?symbol=${symbol}` : ""}`
      ),
    boardMeetings: () => get<{ data: unknown }>("/api/public/board-meetings"),
    bookClosures: () => get<{ data: unknown }>("/api/public/book-closures"),
    youtubers: () => get<{ data: unknown }>("/api/public/youtubers"),
    usefulLinks: () => get<{ data: unknown }>("/api/public/useful-links"),
    worldMonitor: () => get<{ data: unknown }>("/api/public/world-monitor"),
  },

  portfolio: {
    dashboard: () => get<{ data: unknown }>("/api/private/dashboard", true),
    portfolios: () => get<{ data: unknown }>("/api/private/portfolios", true),
    suggestions: (id: string) =>
      get<{ data: unknown }>(`/api/private/portfolio-suggestions?id=${id}`, true),
    command: (payload: unknown) =>
      post<{ ok: boolean }>("/api/private/portfolio-command", payload, true),
    performance: (id: string) =>
      get<{ data: unknown }>(`/api/private/portfolio-performance?id=${id}`, true),
  },
};
