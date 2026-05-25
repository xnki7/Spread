import postgres from "postgres";
import { config } from "./config.js";

export function createDb(): postgres.Sql {
  return postgres(config.DATABASE_URL, { max: 10, onnotice: () => {} });
}
