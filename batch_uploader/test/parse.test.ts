import { describe, it, expect } from "vitest";
import { fieldsToObject, parseStreamEntry } from "../src/parse.js";

describe("fieldsToObject", () => {
  it("converts flat key/value pairs into an object", () => {
    expect(fieldsToObject(["a", "1", "b", "2"])).toEqual({ a: "1", b: "2" });
  });

  it("handles empty input", () => {
    expect(fieldsToObject([])).toEqual({});
  });
});

describe("parseStreamEntry", () => {
  it("parses a well-formed trade entry", () => {
    const row = parseStreamEntry([
      "symbol",
      "SOLUSDT",
      "price",
      "100.5",
      "qty",
      "1.25",
      "tradeId",
      "999",
      "ts",
      "1700000000000",
      "buyerIsMaker",
      "1",
    ]);
    expect(row.symbol).toBe("SOLUSDT");
    expect(row.price).toBe("100.5");
    expect(row.qty).toBe("1.25");
    expect(row.trade_id).toBe("999");
    expect(row.ts.getTime()).toBe(1_700_000_000_000);
    expect(row.buyer_is_maker).toBe(true);
  });

  it("maps buyerIsMaker '0' to false", () => {
    const row = parseStreamEntry([
      "symbol",
      "X",
      "price",
      "1",
      "qty",
      "1",
      "tradeId",
      "1",
      "ts",
      "1",
      "buyerIsMaker",
      "0",
    ]);
    expect(row.buyer_is_maker).toBe(false);
  });

  it("throws on missing required fields", () => {
    expect(() =>
      parseStreamEntry(["symbol", "SOL", "price", "100"]),
    ).toThrow();
  });

  it("throws on invalid buyerIsMaker value", () => {
    expect(() =>
      parseStreamEntry([
        "symbol",
        "X",
        "price",
        "1",
        "qty",
        "1",
        "tradeId",
        "1",
        "ts",
        "1",
        "buyerIsMaker",
        "yes",
      ]),
    ).toThrow();
  });
});
