import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createDb } from "./db.js";
import { createAssetsRepo, createCandlesRepo } from "./repos.js";
import { createApp } from "./app.js";

const sql = createDb();
let dbHealthy = false;

sql`SELECT 1`
  .then(() => {
    dbHealthy = true;
    logger.info("postgres connected");
  })
  .catch((err) => logger.error({ err }, "postgres connection probe failed"));

const app = createApp({
  candles: createCandlesRepo(sql),
  assets: createAssetsRepo(sql),
  isHealthy: () => dbHealthy,
});

const server = serve(
  { fetch: app.fetch, port: config.PORT },
  ({ port }) => logger.info({ port }, "backend listening"),
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  server.close();
  try {
    await sql.end({ timeout: 5 });
  } catch (err) {
    logger.error({ err }, "postgres shutdown failed");
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
