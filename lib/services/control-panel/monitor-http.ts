import "server-only";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class MonitorHttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function monitorFetchJson<T = unknown>(
  url: string,
  init: {
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 25_000);
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      body: init.body,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const message =
        typeof data === "object" && data && "message" in data
          ? String((data as { message: unknown }).message)
          : `HTTP ${res.status}`;
      throw new MonitorHttpError(res.status, message, data);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = abs / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${bytes < 0 ? "-" : ""}${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
}

export function lastSeriesValue(
  series: Array<{ x?: string; y?: number }> | null | undefined
): number | null {
  if (!Array.isArray(series) || series.length === 0) return null;
  const last = series[series.length - 1];
  return typeof last?.y === "number" ? last.y : null;
}

export function sumSeries(
  series: Array<{ x?: string; y?: number }> | null | undefined
): number {
  if (!Array.isArray(series)) return 0;
  return series.reduce((acc, point) => acc + (typeof point.y === "number" ? point.y : 0), 0);
}

export type MonitorSeriesPoint = { t: string; v: number };

export function normalizeSeries(
  series: Array<{ x?: string; y?: number }> | null | undefined,
  limit = 60
): MonitorSeriesPoint[] {
  if (!Array.isArray(series)) return [];
  return series
    .filter((p) => typeof p?.y === "number")
    .slice(-limit)
    .map((p) => ({ t: String(p.x ?? ""), v: Number(p.y) }));
}
