import { apiFetch } from "./auth.js";

export type Interval = "1m" | "5m" | "1h";

export type Candle = {
  bucket: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trade_count: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  assets: () => get<{ symbols: string[] }>("/assets").then((r) => r.symbols),
  candles: (symbol: string, interval: Interval, limit = 500) =>
    get<{ candles: Candle[] }>(
      `/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    ).then((r) => r.candles),
};
