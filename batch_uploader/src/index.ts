import { logger } from "./logger.js";
import { createRedis } from "./redis.js";
import { createDb } from "./db.js";
import { createConsumer } from "./consumer.js";
import { startHttpServer } from "./server.js";

const redis = createRedis();
const sql = createDb();
const consumer = createConsumer(redis, sql);

const httpServer = startHttpServer(() => redis.status === "ready");

consumer.start().catch((err) => {
  logger.fatal({ err }, "consumer crashed");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  consumer.stop();
  httpServer.close();

  try {
    await sql.end({ timeout: 5 });
  } catch (err) {
    logger.error({ err }, "postgres shutdown failed");
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
