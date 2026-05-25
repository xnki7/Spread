import Redis from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { redisConnected } from "./metrics.js";

export function createRedis(): Redis {
  const r = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  r.on("error", (err) => logger.error({ err }, "redis error"));
  r.on("ready", () => {
    logger.info("redis ready");
    redisConnected.set(1);
  });
  r.on("close", () => redisConnected.set(0));
  r.on("end", () => redisConnected.set(0));
  r.on("reconnecting", () => logger.warn("redis reconnecting"));
  return r;
}
