import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AssetsRepo, Candle, CandlesRepo } from "../src/repos.js";

function makeDeps(overrides: {
  candles?: Partial<CandlesRepo>;
  assets?: Partial<AssetsRepo>;
  isHealthy?: () => boolean;
} = {}) {
  return {
    candles: {
      fetch: vi.fn().mockResolvedValue([]),
      ...overrides.candles,
    } as CandlesRepo,
    assets: {
      list: vi.fn().mockResolvedValue([]),
      ...overrides.assets,
    } as AssetsRepo,
    isHealthy: overrides.isHealthy,
  };
}

const sampleCandle: Candle = {
  bucket: 1_700_000_000_000,
  open: "100",
  high: "101",
  low: "99",
  close: "100.5",
  volume: "5",
  trade_count: 42,
};

describe("GET /health", () => {
  it("returns ok when healthy", async () => {
    const app = createApp(makeDeps({ isHealthy: () => true }));
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 when unhealthy", async () => {
    const app = createApp(makeDeps({ isHealthy: () => false }));
    const res = await app.request("/health");
    expect(res.status).toBe(503);
  });
});

describe("GET /assets", () => {
  it("returns symbols from the repo", async () => {
    const app = createApp(
      makeDeps({ assets: { list: vi.fn().mockResolvedValue(["BTCUSDT", "SOLUSDT"]) } }),
    );
    const res = await app.request("/assets");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ symbols: ["BTCUSDT", "SOLUSDT"] });
  });
});

describe("GET /candles", () => {
  it("rejects missing symbol", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/candles?interval=1m");
    expect(res.status).toBe(400);
  });

  it("rejects invalid interval", async () => {
    const app = createApp(makeDeps());
    const res = await app.request("/candles?symbol=SOLUSDT&interval=2m");
    expect(res.status).toBe(400);
  });

  it("rejects from > to", async () => {
    const app = createApp(makeDeps());
    const res = await app.request(
      "/candles?symbol=SOLUSDT&interval=1m&from=2000&to=1000",
    );
    expect(res.status).toBe(400);
  });

  it("returns candles with the parsed query", async () => {
    const fetch = vi.fn().mockResolvedValue([sampleCandle]);
    const app = createApp(makeDeps({ candles: { fetch } }));
    const res = await app.request(
      "/candles?symbol=SOLUSDT&interval=1m&from=1000&to=2000&limit=100",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      symbol: "SOLUSDT",
      interval: "1m",
      candles: [sampleCandle],
    });
    expect(fetch).toHaveBeenCalledWith({
      symbol: "SOLUSDT",
      interval: "1m",
      from: new Date(1000),
      to: new Date(2000),
      limit: 100,
    });
  });

  it("defaults limit to 500 when omitted", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const app = createApp(makeDeps({ candles: { fetch } }));
    await app.request("/candles?symbol=SOLUSDT&interval=1m");
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 500 }),
    );
  });

  it("caps limit at 5000", async () => {
    const app = createApp(makeDeps());
    const res = await app.request(
      "/candles?symbol=SOLUSDT&interval=1m&limit=10000",
    );
    expect(res.status).toBe(400);
  });
});
