import { config } from "./config.js";
import { logger } from "./logger.js";
import { redis } from "./redis.js";
import { createBatcher } from "./batcher.js";
import { createBinanceShard, shardSymbols } from "./binance.js";
import { startHttpServer } from "./server.js";

const batcher = createBatcher(redis);

const shards = shardSymbols(config.SYMBOLS, config.SYMBOLS_PER_CONNECTION).map(
  (symbols, i) => createBinanceShard(i, symbols, batcher.enqueue),
);

for (const shard of shards) shard.start();

const httpServer = startHttpServer(
  () => redis.status === "ready" && shards.some((s) => s.isConnected()),
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  for (const shard of shards) shard.stop();
  httpServer.close();

  try {
    await batcher.drain();
  } catch (err) {
    logger.error({ err }, "drain failed");
  }
  try {
    await redis.quit();
  } catch (err) {
    logger.error({ err }, "redis quit failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandled rejection");
});
