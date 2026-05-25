import type postgres from "postgres";

export type Interval = "1m" | "5m" | "1h";

const INTERVAL_TABLES: Record<Interval, string> = {
  "1m": "trades_1m",
  "5m": "trades_5m",
  "1h": "trades_1h",
};

export type Candle = {
  bucket: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trade_count: number;
};

export type CandlesQuery = {
  symbol: string;
  interval: Interval;
  from?: Date;
  to?: Date;
  limit: number;
};

export type CandlesRepo = {
  fetch: (q: CandlesQuery) => Promise<Candle[]>;
};

export type AssetsRepo = {
  list: () => Promise<string[]>;
};

type CandleRow = {
  bucket: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trade_count: string;
};

export function createCandlesRepo(sql: postgres.Sql): CandlesRepo {
  return {
    fetch: async ({ symbol, interval, from, to, limit }) => {
      const table = INTERVAL_TABLES[interval];
      const rows = await sql<CandleRow[]>`
        SELECT bucket, open, high, low, close, volume, trade_count
        FROM ${sql(table)}
        WHERE symbol = ${symbol}
          ${from ? sql`AND bucket >= ${from}` : sql``}
          ${to ? sql`AND bucket <= ${to}` : sql``}
        ORDER BY bucket ASC
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        bucket: r.bucket.getTime(),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
        trade_count: Number(r.trade_count),
      }));
    },
  };
}

export function createAssetsRepo(sql: postgres.Sql): AssetsRepo {
  return {
    list: async () => {
      const rows = await sql<{ symbol: string }[]>`
        SELECT DISTINCT symbol FROM trades_1m ORDER BY symbol ASC
      `;
      return rows.map((r) => r.symbol);
    },
  };
}
