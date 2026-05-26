import { serve } from "@hono/node-server";
import Redis from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createDb } from "./db.js";
import { createAssetsRepo, createCandlesRepo } from "./repos.js";
import { createApp } from "./app.js";
import { createSessionsRepo, createUsersRepo, createWalletsRepo } from "./auth/repos.js";
import { createPositionsService as createPositionsRepo } from "./positions/repos.js";
import { createPriceCache } from "./positions/pricing.js";
import { createPositionsService } from "./positions/service.js";
import { createPnlEngine } from "./positions/engine.js";

const sql = createDb();
let dbHealthy = false;

sql`SELECT 1`
  .then(() => {
    dbHealthy = true;
    logger.info("postgres connected");
  })
  .catch((err) => logger.error({ err }, "postgres connection probe failed"));

const redisSub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const redisPub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
redisSub.on("error", (err) => logger.error({ err }, "redis sub error"));
redisPub.on("error", (err) => logger.error({ err }, "redis pub error"));
redisSub.on("ready", () => logger.info("redis sub ready"));
redisPub.on("ready", () => logger.info("redis pub ready"));

const positionsRepo = createPositionsRepo(sql);
const priceCache = createPriceCache(sql);
const positionsService = createPositionsService(positionsRepo, priceCache, {
  minMargin: config.MIN_MARGIN_USD,
  maxLeverage: 100,
});
const engine = createPnlEngine({
  repo: positionsRepo,
  service: positionsService,
  prices: priceCache,
  subscriber: redisSub,
  publisher: redisPub,
});

engine.start().catch((err) => logger.error({ err }, "engine start failed"));

const app = createApp({
  candles: createCandlesRepo(sql),
  assets: createAssetsRepo(sql),
  auth: {
    users: createUsersRepo(sql),
    wallets: createWalletsRepo(sql),
    sessions: createSessionsRepo(sql),
  },
  positions: {
    service: positionsService,
    prices: priceCache,
    engine,
  },
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
    await engine.stop();
  } catch (err) {
    logger.error({ err }, "engine stop failed");
  }
  try {
    await redisSub.quit();
    await redisPub.quit();
  } catch (err) {
    logger.error({ err }, "redis quit failed");
  }
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
