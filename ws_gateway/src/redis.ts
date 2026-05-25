import Redis from "ioredis";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { redisConnected } from "./metrics.js";

export function createRedisSubscriber(): Redis {
  const sub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  sub.on("error", (err) => logger.error({ err }, "redis subscriber error"));
  sub.on("ready", () => {
    logger.info("redis subscriber ready");
    redisConnected.set(1);
  });
  sub.on("close", () => redisConnected.set(0));
  sub.on("end", () => redisConnected.set(0));
  sub.on("reconnecting", () => logger.warn("redis subscriber reconnecting"));
  return sub;
}
