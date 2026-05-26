import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth, type AuthContext } from "../auth/middleware.js";
import { logger } from "../logger.js";
import { unrealizedPnl, clampLoss } from "./math.js";
import type { PriceCache } from "./pricing.js";
import {
  InsufficientFundsError,
  PositionNotFoundError,
} from "./repos.js";
import type { PnlEngine } from "./engine.js";
import { ValidationError, type PositionsService } from "./service.js";

const OpenBody = z.object({
  symbol: z.string().regex(/^[A-Z0-9]+$/),
  side: z.enum(["long", "short"]),
  margin: z.coerce.number().positive(),
  leverage: z.coerce.number().int().min(1).max(100),
});

const HistoryQuery = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export type PositionsRoutesDeps = {
  service: PositionsService;
  prices: PriceCache;
  engine: PnlEngine;
};

function readUserId(c: { var: AuthContext["Variables"] }): string {
  return c.var.userId;
}

export function createPositionsRoutes(deps: PositionsRoutesDeps): Hono {
  const app = new Hono();

  app.post("/", requireAuth, zValidator("json", OpenBody), async (c) => {
    const userId = readUserId(c as unknown as { var: AuthContext["Variables"] });
    const body = c.req.valid("json");
    try {
      const pos = await deps.service.open({
        userId,
        symbol: body.symbol,
        side: body.side,
        margin: body.margin.toFixed(8),
        leverage: body.leverage,
      });
      deps.engine.onPositionOpened(pos);
      logger.info(
        { userId, positionId: pos.id, symbol: pos.symbol, side: pos.side },
        "position opened",
      );
      return c.json({ position: serializeOpen(pos) }, 201);
    } catch (err) {
      if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
      if (err instanceof InsufficientFundsError) return c.json({ error: err.message }, 400);
      throw err;
    }
  });

  app.post("/:id/close", requireAuth, async (c) => {
    const userId = readUserId(c as unknown as { var: AuthContext["Variables"] });
    const id = c.req.param("id");
    try {
      const closed = await deps.service.close({ userId, positionId: id });
      deps.engine.onPositionClosed(closed.id, userId);
      return c.json({ position: serializeClosed(closed) });
    } catch (err) {
      if (err instanceof PositionNotFoundError) return c.json({ error: err.message }, 404);
      if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
      throw err;
    }
  });

  app.get("/", requireAuth, async (c) => {
    const userId = readUserId(c as unknown as { var: AuthContext["Variables"] });
    const open = await deps.service.listOpen(userId);
    const positions = open.map((p) => {
      const px = deps.prices.get(p.symbol);
      const currentPrice = px?.price ?? p.entry_price;
      const raw = unrealizedPnl(p.side, p.qty, p.entry_price, currentPrice);
      const pnl = clampLoss(p.margin, raw);
      return {
        ...serializeOpen(p),
        currentPrice,
        unrealizedPnl: pnl,
      };
    });
    return c.json({ positions });
  });

  app.get("/history", requireAuth, zValidator("query", HistoryQuery), async (c) => {
    const userId = readUserId(c as unknown as { var: AuthContext["Variables"] });
    const { limit } = c.req.valid("query");
    const rows = await deps.service.listHistory(userId, limit);
    return c.json({ positions: rows.map(serializeClosed) });
  });

  return app;
}

function serializeOpen(p: {
  id: string;
  symbol: string;
  side: string;
  qty: string;
  entry_price: string;
  leverage: number;
  margin: string;
  opened_at: Date;
}) {
  return {
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    qty: p.qty,
    entryPrice: p.entry_price,
    leverage: p.leverage,
    margin: p.margin,
    openedAt: p.opened_at.getTime(),
  };
}

function serializeClosed(p: {
  id: string;
  symbol: string;
  side: string;
  qty: string;
  entry_price: string;
  close_price: string;
  leverage: number;
  margin: string;
  realized_pnl: string;
  reason: string;
  opened_at: Date;
  closed_at: Date;
}) {
  return {
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    qty: p.qty,
    entryPrice: p.entry_price,
    closePrice: p.close_price,
    leverage: p.leverage,
    margin: p.margin,
    realizedPnl: p.realized_pnl,
    reason: p.reason,
    openedAt: p.opened_at.getTime(),
    closedAt: p.closed_at.getTime(),
  };
}
