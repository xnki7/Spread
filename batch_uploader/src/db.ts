import postgres from "postgres";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { dbConnected } from "./metrics.js";

export function createDb(): postgres.Sql {
  const sql = postgres(config.DATABASE_URL, {
    max: 5,
    onnotice: () => {},
  });
  // Probe the connection so we can flip the gauge.
  sql`SELECT 1`
    .then(() => {
      logger.info("postgres connected");
      dbConnected.set(1);
    })
    .catch((err) => {
      logger.error({ err }, "postgres connection probe failed");
      dbConnected.set(0);
    });
  return sql;
}
