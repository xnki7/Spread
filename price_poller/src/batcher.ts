import type { Redis } from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  bufferSize,
  flushDuration,
  flushSize,
  messagesDropped,
} from "./metrics.js";
import type { StreamEvent } from "./schemas.js";

const TRADE_STREAM_KEY = "stream:trades";

export type Batcher = {
  enqueue: (event: StreamEvent) => void;
  flush: () => Promise<void>;
  drain: () => Promise<void>;
  size: () => number;
};

export function createBatcher(redis: Redis): Batcher {
  let buffer: StreamEvent[] = [];
  let timer: NodeJS.Timeout | null = null;
  let flushing = false;

  async function flush(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (flushing || buffer.length === 0) return;
    flushing = true;
    const batch = buffer;
    buffer = [];
    bufferSize.set(0);

    const endTimer = flushDuration.startTimer();
    try {
      const pipeline = redis.pipeline();
      for (const event of batch) {
        if (event.kind === "bookTicker") {
          pipeline.publish(
            `prices:bookTicker:${event.symbol}`,
            JSON.stringify(event),
          );
        } else {
          pipeline.publish(
            `prices:trade:${event.symbol}`,
            JSON.stringify(event),
          );
          pipeline.xadd(
            TRADE_STREAM_KEY,
            "MAXLEN",
            "~",
            config.STREAM_MAXLEN.toString(),
            "*",
            "symbol",
            event.symbol,
            "price",
            event.price,
            "qty",
            event.qty,
            "tradeId",
            event.tradeId.toString(),
            "ts",
            event.ts.toString(),
            "buyerIsMaker",
            event.buyerIsMaker ? "1" : "0",
          );
        }
      }
      await pipeline.exec();
      flushSize.observe(batch.length);
    } catch (err) {
      logger.error({ err, batchSize: batch.length }, "flush failed");
    } finally {
      endTimer();
      flushing = false;
    }
  }

  function enqueue(event: StreamEvent): void {
    if (buffer.length >= config.MAX_BUFFER_SIZE) {
      buffer.shift();
      messagesDropped.inc({ reason: "buffer_full" });
    }
    buffer.push(event);
    bufferSize.set(buffer.length);
    if (timer === null) {
      timer = setTimeout(() => {
        void flush();
      }, config.FLUSH_INTERVAL_MS);
    }
  }

  return {
    enqueue,
    flush,
    drain: flush,
    size: () => buffer.length,
  };
}
