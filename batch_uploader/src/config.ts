import "dotenv/config";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const Config = z.object({
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  STREAM_KEY: z.string().default("stream:trades"),
  CONSUMER_GROUP: z.string().default("uploader"),
  BATCH_SIZE: z.coerce.number().int().positive().default(200),
  BLOCK_MS: z.coerce.number().int().positive().default(5_000),
  HTTP_PORT: z.coerce.number().int().positive().default(9092),
  LOG_LEVEL: z.string().default("info"),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;

export const CONSUMER_NAME = `${os.hostname()}-${randomUUID().slice(0, 8)}`;
