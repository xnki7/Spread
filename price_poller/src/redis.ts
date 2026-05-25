import Redis from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("error", (err) => logger.error({ err }, "redis error"));
redis.on("connect", () => logger.info("redis connected"));
redis.on("reconnecting", () => logger.warn("redis reconnecting"));
