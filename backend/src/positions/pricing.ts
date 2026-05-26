import type postgres from "postgres";

export type LatestPrice = {
  price: string;
  ts: number;
};

export type PriceCache = {
  set: (symbol: string, price: string, ts: number) => void;
  get: (symbol: string) => LatestPrice | null;
  getOrFetch: (symbol: string) => Promise<LatestPrice | null>;
};

export function createPriceCache(sql: postgres.Sql): PriceCache {
  const cache = new Map<string, LatestPrice>();

  async function fetchFromDb(symbol: string): Promise<LatestPrice | null> {
    const rows = await sql<{ price: string; ts: Date }[]>`
      SELECT price::text, ts FROM trades
      WHERE symbol = ${symbol}
      ORDER BY ts DESC
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    return { price: r.price, ts: r.ts.getTime() };
  }

  return {
    set: (symbol, price, ts) => {
      const existing = cache.get(symbol);
      if (existing && existing.ts > ts) return;
      cache.set(symbol, { price, ts });
    },
    get: (symbol) => cache.get(symbol) ?? null,
    getOrFetch: async (symbol) => {
      const hit = cache.get(symbol);
      if (hit) return hit;
      const fresh = await fetchFromDb(symbol);
      if (fresh) cache.set(symbol, fresh);
      return fresh;
    },
  };
}
