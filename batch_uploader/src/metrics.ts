import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const batchesProcessed = new Counter({
  name: "batch_uploader_batches_total",
  help: "Number of batches processed",
  registers: [registry],
});

export const tradesInserted = new Counter({
  name: "batch_uploader_trades_inserted_total",
  help: "Number of trades inserted (rows attempted, may include ON CONFLICT skips)",
  registers: [registry],
});

export const tradesFailed = new Counter({
  name: "batch_uploader_trades_failed_total",
  help: "Trades that failed to parse from the stream",
  registers: [registry],
});

export const insertDuration = new Histogram({
  name: "batch_uploader_insert_duration_seconds",
  help: "Time spent inserting batches into Timescale",
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const batchSize = new Histogram({
  name: "batch_uploader_batch_size",
  help: "Number of trades per batch",
  buckets: [1, 10, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});

export const redisConnected = new Gauge({
  name: "batch_uploader_redis_connected",
  help: "Redis connection status",
  registers: [registry],
});

export const dbConnected = new Gauge({
  name: "batch_uploader_db_connected",
  help: "Postgres connection status",
  registers: [registry],
});
