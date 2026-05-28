import type postgres from "postgres";

export type Side = "long" | "short";
export type CloseReason = "manual" | "liquidation" | "take_profit" | "stop_loss";

export type Position = {
  id: string;
  user_id: string;
  symbol: string;
  side: Side;
  qty: string;
  entry_price: string;
  leverage: number;
  margin: string;
  take_profit_price: string | null;
  stop_loss_price: string | null;
  opened_at: Date;
};

export type ClosedPosition = {
  id: string;
  user_id: string;
  symbol: string;
  side: Side;
  qty: string;
  entry_price: string;
  close_price: string;
  leverage: number;
  margin: string;
  realized_pnl: string;
  reason: CloseReason;
  take_profit_price: string | null;
  stop_loss_price: string | null;
  opened_at: Date;
  closed_at: Date;
};

export type OpenInput = {
  userId: string;
  symbol: string;
  side: Side;
  qty: string;
  entryPrice: string;
  leverage: number;
  margin: string;
  takeProfitPrice?: string | null;
  stopLossPrice?: string | null;
};

export type CloseInput = {
  positionId: string;
  userId: string;
  closePrice: string;
  realizedPnl: string;
  reason: CloseReason;
};

export type UpdateStopsInput = {
  positionId: string;
  userId: string;
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
};

export type PositionsService = {
  open: (input: OpenInput) => Promise<Position>;
  close: (input: CloseInput) => Promise<ClosedPosition>;
  updateStops: (input: UpdateStopsInput) => Promise<Position>;
  findOpen: (positionId: string) => Promise<Position | null>;
  listOpenByUser: (userId: string) => Promise<Position[]>;
  listAllOpen: () => Promise<Position[]>;
  listHistoryByUser: (userId: string, limit: number) => Promise<ClosedPosition[]>;
};

const OPEN_COLS = `
  id, user_id, symbol, side, qty::text, entry_price::text,
  leverage, margin::text,
  take_profit_price::text, stop_loss_price::text,
  opened_at
`;

const CLOSED_COLS = `
  id, user_id, symbol, side, qty::text, entry_price::text,
  close_price::text, leverage, margin::text,
  realized_pnl::text, reason,
  take_profit_price::text, stop_loss_price::text,
  opened_at, closed_at
`;

export function createPositionsService(sql: postgres.Sql): PositionsService {
  return {
    open: async ({
      userId,
      symbol,
      side,
      qty,
      entryPrice,
      leverage,
      margin,
      takeProfitPrice,
      stopLossPrice,
    }) => {
      return await sql.begin(async (tx) => {
        const updated = await tx<{ ok: boolean }[]>`
          UPDATE wallets
          SET locked_margin = locked_margin + ${margin}::numeric,
              updated_at = now()
          WHERE user_id = ${userId}
            AND (balance - locked_margin) >= ${margin}::numeric
          RETURNING true AS ok
        `;
        if (updated.length === 0) {
          throw new InsufficientFundsError();
        }
        const tp = takeProfitPrice ?? null;
        const sl = stopLossPrice ?? null;
        const rows = await tx<Position[]>`
          INSERT INTO positions (
            user_id, symbol, side, qty, entry_price, leverage, margin,
            take_profit_price, stop_loss_price
          )
          VALUES (
            ${userId}, ${symbol}, ${side}::position_side,
            ${qty}::numeric, ${entryPrice}::numeric, ${leverage}, ${margin}::numeric,
            ${tp}::numeric, ${sl}::numeric
          )
          RETURNING ${tx.unsafe(OPEN_COLS)}
        `;
        return rows[0]!;
      });
    },

    close: async ({ positionId, userId, closePrice, realizedPnl, reason }) => {
      return await sql.begin(async (tx) => {
        const pos = await tx<Position[]>`
          DELETE FROM positions
          WHERE id = ${positionId} AND user_id = ${userId}
          RETURNING ${tx.unsafe(OPEN_COLS)}
        `;
        const p = pos[0];
        if (!p) throw new PositionNotFoundError();

        const settled = await tx<{ ok: boolean }[]>`
          UPDATE wallets
          SET balance = balance + ${realizedPnl}::numeric,
              locked_margin = locked_margin - ${p.margin}::numeric,
              updated_at = now()
          WHERE user_id = ${userId}
          RETURNING true AS ok
        `;
        if (settled.length === 0) throw new WalletUpdateError();

        const rows = await tx<ClosedPosition[]>`
          INSERT INTO position_history (
            id, user_id, symbol, side, qty, entry_price, close_price,
            leverage, margin, realized_pnl, reason,
            take_profit_price, stop_loss_price, opened_at
          )
          VALUES (
            ${p.id}, ${p.user_id}, ${p.symbol}, ${p.side}::position_side,
            ${p.qty}::numeric, ${p.entry_price}::numeric, ${closePrice}::numeric,
            ${p.leverage}, ${p.margin}::numeric, ${realizedPnl}::numeric,
            ${reason}::close_reason,
            ${p.take_profit_price}::numeric, ${p.stop_loss_price}::numeric,
            ${p.opened_at}
          )
          RETURNING ${tx.unsafe(CLOSED_COLS)}
        `;
        return rows[0]!;
      });
    },

    updateStops: async ({ positionId, userId, takeProfitPrice, stopLossPrice }) => {
      const rows = await sql<Position[]>`
        UPDATE positions
        SET take_profit_price = ${takeProfitPrice}::numeric,
            stop_loss_price   = ${stopLossPrice}::numeric
        WHERE id = ${positionId} AND user_id = ${userId}
        RETURNING ${sql.unsafe(OPEN_COLS)}
      `;
      const p = rows[0];
      if (!p) throw new PositionNotFoundError();
      return p;
    },

    findOpen: async (positionId) => {
      const rows = await sql<Position[]>`
        SELECT ${sql.unsafe(OPEN_COLS)}
        FROM positions WHERE id = ${positionId}
      `;
      return rows[0] ?? null;
    },

    listOpenByUser: async (userId) => {
      return await sql<Position[]>`
        SELECT ${sql.unsafe(OPEN_COLS)}
        FROM positions
        WHERE user_id = ${userId}
        ORDER BY opened_at DESC
      `;
    },

    listAllOpen: async () => {
      return await sql<Position[]>`
        SELECT ${sql.unsafe(OPEN_COLS)}
        FROM positions
      `;
    },

    listHistoryByUser: async (userId, limit) => {
      return await sql<ClosedPosition[]>`
        SELECT ${sql.unsafe(CLOSED_COLS)}
        FROM position_history
        WHERE user_id = ${userId}
        ORDER BY closed_at DESC
        LIMIT ${limit}
      `;
    },
  };
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("insufficient free margin");
    this.name = "InsufficientFundsError";
  }
}
export class PositionNotFoundError extends Error {
  constructor() {
    super("position not found");
    this.name = "PositionNotFoundError";
  }
}
export class WalletUpdateError extends Error {
  constructor() {
    super("wallet update failed");
    this.name = "WalletUpdateError";
  }
}
