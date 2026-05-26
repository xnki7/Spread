import "dotenv/config";
import { z } from "zod";

const Config = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8081),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;
