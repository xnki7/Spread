import { describe, it, expect } from "vitest";
import { parseStreamMessage } from "../src/schemas.js";

describe("parseStreamMessage", () => {
  it("parses a bookTicker payload", () => {
    const event = parseStreamMessage(
      {
        stream: "solusdt@bookTicker",
        data: { u: 42, s: "SOLUSDT", b: "100", B: "1", a: "101", A: "2" },
      },
      1_700_000_000_000,
    );
    expect(event).toEqual({
      kind: "bookTicker",
      symbol: "SOLUSDT",
      updateId: 42,
      bid: "100",
      bidQty: "1",
      ask: "101",
      askQty: "2",
      ts: 1_700_000_000_000,
    });
  });

  it("parses a trade payload", () => {
    const event = parseStreamMessage(
      {
        stream: "solusdt@trade",
        data: {
          e: "trade",
          E: 1,
          s: "SOLUSDT",
          t: 99,
          p: "100.5",
          q: "1.25",
          T: 1_700_000_000_000,
          m: true,
        },
      },
      0,
    );
    expect(event).toEqual({
      kind: "trade",
      symbol: "SOLUSDT",
      tradeId: 99,
      price: "100.5",
      qty: "1.25",
      ts: 1_700_000_000_000,
      buyerIsMaker: true,
    });
  });

  it("returns null for unknown stream suffixes", () => {
    expect(
      parseStreamMessage(
        { stream: "solusdt@kline_1m", data: {} },
        0,
      ),
    ).toBeNull();
  });

  it("throws for malformed envelopes", () => {
    expect(() => parseStreamMessage({}, 0)).toThrow();
  });

  it("throws when bookTicker fields are missing", () => {
    expect(() =>
      parseStreamMessage(
        { stream: "solusdt@bookTicker", data: { s: "SOLUSDT" } },
        0,
      ),
    ).toThrow();
  });
});
