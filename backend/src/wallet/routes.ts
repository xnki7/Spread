import { Hono } from "hono";
import type postgres from "postgres";
import { requireAuth, type AuthContext } from "../auth/middleware.js";
import { logger } from "../logger.js";

const STARTING_BALANCE = "5000";

export type WalletRoutesDeps = {
  sql: postgres.Sql;
};

export function createWalletRoutes(deps: WalletRoutesDeps): Hono {
  const app = new Hono();

  app.post("/reset", requireAuth, async (c) => {
    const ctx = c as unknown as { var: AuthContext["Variables"] };
    const userId = ctx.var.userId;
    try {
      const result = await deps.sql.begin(async (tx) => {
        const open = await tx<{ count: string }[]>`
          SELECT COUNT(*)::text AS count FROM positions WHERE user_id = ${userId}
        `;
        if (Number(open[0]?.count ?? 0) > 0) {
          return { ok: false as const, reason: "close open positions first" };
        }
        const rows = await tx<{ balance: string }[]>`
          UPDATE wallets
          SET balance = ${STARTING_BALANCE}::numeric,
              locked_margin = 0,
              updated_at = now()
          WHERE user_id = ${userId} AND balance < ${STARTING_BALANCE}::numeric
          RETURNING balance::text
        `;
        return { ok: true as const, balance: rows[0]?.balance ?? STARTING_BALANCE };
      });

      if (!result.ok) return c.json({ error: result.reason }, 400);
      logger.info({ userId }, "wallet reset");
      return c.json({ balance: result.balance });
    } catch (err) {
      logger.error({ err, userId }, "wallet reset failed");
      return c.json({ error: "reset failed" }, 500);
    }
  });

  return app;
}
