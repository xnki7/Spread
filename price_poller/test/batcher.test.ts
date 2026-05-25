import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBatcher } from "../src/batcher.js";
import type { StreamEvent } from "../src/schemas.js";

type MockPipeline = {
  publish: ReturnType<typeof vi.fn>;
  xadd: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function makeRedisMock(): {
  redis: { pipeline: () => MockPipeline };
  pipelineFns: MockPipeline;
} {
  const pipelineFns: MockPipeline = {
    publish: vi.fn(),
    xadd: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  };
  pipelineFns.publish.mockReturnValue(pipelineFns);
  pipelineFns.xadd.mockReturnValue(pipelineFns);
  return {
    redis: { pipeline: () => pipelineFns },
    pipelineFns,
  };
}

const bookTicker: StreamEvent = {
  kind: "bookTicker",
  symbol: "SOLUSDT",
  updateId: 1,
  bid: "100",
  bidQty: "1",
  ask: "101",
  askQty: "2",
  ts: 1,
};

const trade: StreamEvent = {
  kind: "trade",
  symbol: "SOLUSDT",
  tradeId: 42,
  price: "100.5",
  qty: "1.25",
  ts: 1,
  buyerIsMaker: false,
};

describe("Batcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pipelines a bookTicker as one PUBLISH", async () => {
    const { redis, pipelineFns } = makeRedisMock();
    const b = createBatcher(redis as never);
    b.enqueue(bookTicker);
    await b.drain();
    expect(pipelineFns.publish).toHaveBeenCalledTimes(1);
    expect(pipelineFns.publish).toHaveBeenCalledWith(
      "prices:bookTicker:SOLUSDT",
      expect.stringContaining("SOLUSDT"),
    );
    expect(pipelineFns.xadd).not.toHaveBeenCalled();
    expect(pipelineFns.exec).toHaveBeenCalledTimes(1);
  });

  it("pipelines a trade as PUBLISH + XADD", async () => {
    const { redis, pipelineFns } = makeRedisMock();
    const b = createBatcher(redis as never);
    b.enqueue(trade);
    await b.drain();
    expect(pipelineFns.publish).toHaveBeenCalledTimes(1);
    expect(pipelineFns.xadd).toHaveBeenCalledTimes(1);
    expect(pipelineFns.exec).toHaveBeenCalledTimes(1);
  });

  it("flushes on the timer without explicit drain", async () => {
    const { redis, pipelineFns } = makeRedisMock();
    const b = createBatcher(redis as never);
    b.enqueue(trade);
    expect(b.size()).toBe(1);
    await vi.runAllTimersAsync();
    expect(pipelineFns.exec).toHaveBeenCalledTimes(1);
    expect(b.size()).toBe(0);
  });

  it("batches multiple events into a single pipeline.exec call", async () => {
    const { redis, pipelineFns } = makeRedisMock();
    const b = createBatcher(redis as never);
    for (let i = 0; i < 5; i++) b.enqueue(trade);
    await b.drain();
    expect(pipelineFns.exec).toHaveBeenCalledTimes(1);
    expect(pipelineFns.publish).toHaveBeenCalledTimes(5);
    expect(pipelineFns.xadd).toHaveBeenCalledTimes(5);
  });

  it("drain on empty buffer is a no-op", async () => {
    const { redis, pipelineFns } = makeRedisMock();
    const b = createBatcher(redis as never);
    await b.drain();
    expect(pipelineFns.exec).not.toHaveBeenCalled();
  });
});
