import type { Redis } from "ioredis";
import type postgres from "postgres";
import { config, CONSUMER_NAME } from "./config.js";
import { logger } from "./logger.js";
import {
  batchSize,
  batchesProcessed,
  insertDuration,
  tradesFailed,
  tradesInserted,
} from "./metrics.js";
import { parseStreamEntry, type TradeRow } from "./parse.js";

type StreamEntry = [id: string, fields: string[]];
type StreamResult = [streamName: string, entries: StreamEntry[]][];

export type Consumer = {
  start: () => Promise<void>;
  stop: () => void;
};

export function createConsumer(redis: Redis, sql: postgres.Sql): Consumer {
  let stopping = false;

  async function ensureGroup(): Promise<void> {
    try {
      await redis.xgroup(
        "CREATE",
        config.STREAM_KEY,
        config.CONSUMER_GROUP,
        "$",
        "MKSTREAM",
      );
      logger.info({ group: config.CONSUMER_GROUP }, "consumer group created");
    } catch (err) {
      if (err instanceof Error && err.message.includes("BUSYGROUP")) return;
      throw err;
    }
  }

  async function insertAndAck(entries: StreamEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const rows: TradeRow[] = [];
    for (const [, fields] of entries) {
      try {
        rows.push(parseStreamEntry(fields));
      } catch (err) {
        tradesFailed.inc();
        logger.warn({ err }, "skipping malformed trade entry");
      }
    }

    if (rows.length > 0) {
      const endTimer = insertDuration.startTimer();
      try {
        await sql`
          INSERT INTO trades ${sql(
            rows,
            "ts",
            "symbol",
            "trade_id",
            "price",
            "qty",
            "buyer_is_maker",
          )}
          ON CONFLICT (symbol, trade_id, ts) DO NOTHING
        `;
        tradesInserted.inc(rows.length);
        batchSize.observe(rows.length);
        batchesProcessed.inc();
      } finally {
        endTimer();
      }
    }

    const ids = entries.map(([id]) => id);
    await redis.xack(config.STREAM_KEY, config.CONSUMER_GROUP, ...ids);
  }

  async function drainPending(): Promise<void> {
    while (!stopping) {
      const raw = (await redis.xreadgroup(
        "GROUP",
        config.CONSUMER_GROUP,
        CONSUMER_NAME,
        "COUNT",
        config.BATCH_SIZE,
        "STREAMS",
        config.STREAM_KEY,
        "0",
      )) as StreamResult | null;
      if (!raw) return;
      const entries = raw[0]?.[1] ?? [];
      if (entries.length === 0) return;
      await insertAndAck(entries);
    }
  }

  async function consumeNew(): Promise<void> {
    while (!stopping) {
      try {
        const raw = (await redis.xreadgroup(
          "GROUP",
          config.CONSUMER_GROUP,
          CONSUMER_NAME,
          "COUNT",
          config.BATCH_SIZE,
          "BLOCK",
          config.BLOCK_MS,
          "STREAMS",
          config.STREAM_KEY,
          ">",
        )) as StreamResult | null;
        if (!raw) continue;
        const entries = raw[0]?.[1] ?? [];
        if (entries.length === 0) continue;
        await insertAndAck(entries);
      } catch (err) {
        logger.error({ err }, "consume loop error");
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  }

  return {
    start: async () => {
      await ensureGroup();
      logger.info({ consumer: CONSUMER_NAME }, "starting consumer");
      await drainPending();
      logger.info("pending drained, switching to new messages");
      await consumeNew();
    },
    stop: () => {
      stopping = true;
    },
  };
}
