import { describe, it, expect } from "vitest";
import { shardSymbols } from "../src/binance.js";

describe("shardSymbols", () => {
  it("returns a single shard when count fits", () => {
    expect(shardSymbols(["A", "B", "C"], 50)).toEqual([["A", "B", "C"]]);
  });

  it("splits symbols across shards of given size", () => {
    expect(shardSymbols(["A", "B", "C", "D", "E"], 2)).toEqual([
      ["A", "B"],
      ["C", "D"],
      ["E"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(shardSymbols([], 10)).toEqual([]);
  });

  it("throws when shard size is non-positive", () => {
    expect(() => shardSymbols(["A"], 0)).toThrow();
  });
});
