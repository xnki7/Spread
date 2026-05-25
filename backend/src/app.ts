import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { logger } from "./logger.js";
import { registry, requestDuration, requestsTotal } from "./metrics.js";
import type { AssetsRepo, CandlesRepo, Interval } from "./repos.js";

const CandlesQuery = z.object({
  symbol: z.string().regex(/^[A-Z0-9]+$/, "symbol must be uppercase alphanumeric"),
  interval: z.enum(["1m", "5m", "1h"]),
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(5_000).default(500),
});

export type Deps = {
  candles: CandlesRepo;
  assets: AssetsRepo;
  isHealthy?: () => boolean;
};

export function createApp(deps: Deps): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const endTimer = requestDuration.startTimer({ method: c.req.method });
    await next();
    const route = c.req.routePath || "unknown";
    endTimer({ method: c.req.method, route });
    requestsTotal.inc({
      method: c.req.method,
      route,
      status: String(c.res.status),
    });
  });

  app.onError((err, c) => {
    logger.error({ err, path: c.req.path }, "request error");
    return c.json({ error: "internal error" }, 500);
  });

  app.get("/health", (c) => {
    const ok = deps.isHealthy ? deps.isHealthy() : true;
    return c.json({ status: ok ? "ok" : "unhealthy" }, ok ? 200 : 503);
  });

  app.get("/metrics", async (c) => {
    const body = await registry.metrics();
    return c.text(body, 200, { "content-type": registry.contentType });
  });

  app.get("/assets", async (c) => {
    const symbols = await deps.assets.list();
    return c.json({ symbols });
  });

  app.get("/candles", zValidator("query", CandlesQuery), async (c) => {
    const { symbol, interval, from, to, limit } = c.req.valid("query");
    if (from !== undefined && to !== undefined && from > to) {
      return c.json({ error: "from must be <= to" }, 400);
    }
    const candles = await deps.candles.fetch({
      symbol,
      interval: interval as Interval,
      from: from !== undefined ? new Date(from) : undefined,
      to: to !== undefined ? new Date(to) : undefined,
      limit,
    });
    return c.json({ symbol, interval, candles });
  });

  return app;
}
