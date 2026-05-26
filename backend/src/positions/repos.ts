import type postgres from "postgres";

export type Side = "long" | "short";
export type CloseReason = "manual" | "liquidation";

export type Position = {
  id: string;
  user_id: string;
  symbol: string;
  side: Side;
  qty: string;
  entry_price: string;
  leverage: number;
  margin: string;
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
};

export type CloseInput = {
  positionId: string;
  userId: string;
  closePrice: string;
  realizedPnl: string;
  reason: CloseReason;
};

export type PositionsService = {
  open: (input: OpenInput) => Promise<Position>;
  close: (input: CloseInput) => Promise<ClosedPosition>;
  findOpen: (positionId: string) => Promise<Position | null>;
  listOpenByUser: (userId: string) => Promise<Position[]>;
  listAllOpen: () => Promise<Position[]>;
  listHistoryByUser: (userId: string, limit: number) => Promise<ClosedPosition[]>;
};

export function createPositionsService(sql: postgres.Sql): PositionsService {
  return {
    open: async ({ userId, symbol, side, qty, entryPrice, leverage, margin }) => {
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
        const rows = await tx<Position[]>`
          INSERT INTO positions (user_id, symbol, side, qty, entry_price, leverage, margin)
          VALUES (
            ${userId}, ${symbol}, ${side}::position_side,
            ${qty}::numeric, ${entryPrice}::numeric, ${leverage}, ${margin}::numeric
          )
          RETURNING id, user_id, symbol, side, qty::text, entry_price::text,
                    leverage, margin::text, opened_at
        `;
        return rows[0]!;
      });
    },

    close: async ({ positionId, userId, closePrice, realizedPnl, reason }) => {
      return await sql.begin(async (tx) => {
        const pos = await tx<Position[]>`
          DELETE FROM positions
          WHERE id = ${positionId} AND user_id = ${userId}
          RETURNING id, user_id, symbol, side, qty::text, entry_price::text,
                    leverage, margin::text, opened_at
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
            leverage, margin, realized_pnl, reason, opened_at
          )
          VALUES (
            ${p.id}, ${p.user_id}, ${p.symbol}, ${p.side}::position_side,
            ${p.qty}::numeric, ${p.entry_price}::numeric, ${closePrice}::numeric,
            ${p.leverage}, ${p.margin}::numeric, ${realizedPnl}::numeric,
            ${reason}::close_reason, ${p.opened_at}
          )
          RETURNING id, user_id, symbol, side, qty::text, entry_price::text,
                    close_price::text, leverage, margin::text,
                    realized_pnl::text, reason, opened_at, closed_at
        `;
        return rows[0]!;
      });
    },

    findOpen: async (positionId) => {
      const rows = await sql<Position[]>`
        SELECT id, user_id, symbol, side, qty::text, entry_price::text,
               leverage, margin::text, opened_at
        FROM positions WHERE id = ${positionId}
      `;
      return rows[0] ?? null;
    },

    listOpenByUser: async (userId) => {
      return await sql<Position[]>`
        SELECT id, user_id, symbol, side, qty::text, entry_price::text,
               leverage, margin::text, opened_at
        FROM positions
        WHERE user_id = ${userId}
        ORDER BY opened_at DESC
      `;
    },

    listAllOpen: async () => {
      return await sql<Position[]>`
        SELECT id, user_id, symbol, side, qty::text, entry_price::text,
               leverage, margin::text, opened_at
        FROM positions
      `;
    },

    listHistoryByUser: async (userId, limit) => {
      return await sql<ClosedPosition[]>`
        SELECT id, user_id, symbol, side, qty::text, entry_price::text,
               close_price::text, leverage, margin::text,
               realized_pnl::text, reason, opened_at, closed_at
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
