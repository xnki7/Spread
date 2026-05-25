import "dotenv/config";
import { z } from "zod";

const Config = z.object({
  REDIS_URL: z.string().url(),
  BINANCE_WS_URL: z
    .string()
    .url()
    .default("wss://stream.binance.com:9443/stream"),
  SYMBOLS: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).nonempty()),
  LOG_LEVEL: z.string().default("info"),
  HTTP_PORT: z.coerce.number().int().positive().default(9090),
  STREAM_MAXLEN: z.coerce.number().int().positive().default(100_000),
  FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(50),
  MAX_BUFFER_SIZE: z.coerce.number().int().positive().default(10_000),
  STALENESS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CONNECTION_MAX_AGE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(23 * 60 * 60 * 1_000),
  SYMBOLS_PER_CONNECTION: z.coerce.number().int().positive().default(50),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;
