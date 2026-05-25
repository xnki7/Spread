import "dotenv/config";
import { z } from "zod";

const Config = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8081),
  LOG_LEVEL: z.string().default("info"),
});

export const config = Config.parse(process.env);
export type AppConfig = z.infer<typeof Config>;
