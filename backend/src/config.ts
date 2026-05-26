import "dotenv/config";
import { z } from "zod";

const Config = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PORT: z.coerce.number().int().positive().default(8081),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(30 * 24 * 60 * 60),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_DOMAIN: z.string().optional(),
  MAINTENANCE_MARGIN_RATIO: z.coerce.number().min(0).max(1).default(0),
  MIN_MARGIN_USD: z.coerce.number().positive().default(10),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;
