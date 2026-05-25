import "dotenv/config";
import { z } from "zod";

const Config = z.object({
  REDIS_URL: z.string().url(),
  WS_PORT: z.coerce.number().int().positive().default(8080),
  HTTP_PORT: z.coerce.number().int().positive().default(9091),
  LOG_LEVEL: z.string().default("info"),
  PING_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;
