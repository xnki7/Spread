import { logger } from "../logger.js";
import {
  clampLoss,
  qtyFromMarginLeverage,
  unrealizedPnl,
} from "./math.js";
import type { PriceCache } from "./pricing.js";
import {
  type CloseReason,
  type ClosedPosition,
  type PositionsService as PositionsRepo,
  type Position,
  type Side,
  InsufficientFundsError,
  PositionNotFoundError,
} from "./repos.js";

export type OpenRequest = {
  userId: string;
  symbol: string;
  side: Side;
  margin: string;
  leverage: number;
};

export type CloseRequest = {
  userId: string;
  positionId: string;
};

export type PositionsService = {
  open: (req: OpenRequest) => Promise<Position>;
  close: (req: CloseRequest) => Promise<ClosedPosition>;
  closeAt: (
    position: Position,
    closePrice: string,
    reason: CloseReason,
  ) => Promise<ClosedPosition>;
  listOpen: (userId: string) => Promise<Position[]>;
  listHistory: (userId: string, limit: number) => Promise<ClosedPosition[]>;
};

export type Limits = {
  minMargin: number;
  maxLeverage: number;
};

export function createPositionsService(
  repo: PositionsRepo,
  prices: PriceCache,
  limits: Limits,
): PositionsService {
  async function open(req: OpenRequest): Promise<Position> {
    if (req.leverage < 1 || req.leverage > limits.maxLeverage) {
      throw new ValidationError(`leverage must be 1..${limits.maxLeverage}`);
    }
    const marginNum = Number(req.margin);
    if (!Number.isFinite(marginNum) || marginNum < limits.minMargin) {
      throw new ValidationError(`margin must be at least $${limits.minMargin}`);
    }
    const px = await prices.getOrFetch(req.symbol);
    if (!px) throw new ValidationError(`no price available for ${req.symbol}`);

    const qty = qtyFromMarginLeverage(req.margin, req.leverage, px.price);
    if (Number(qty) <= 0) throw new ValidationError("computed qty is zero");

    try {
      return await repo.open({
        userId: req.userId,
        symbol: req.symbol,
        side: req.side,
        qty,
        entryPrice: px.price,
        leverage: req.leverage,
        margin: req.margin,
      });
    } catch (err) {
      if (err instanceof InsufficientFundsError) throw err;
      throw err;
    }
  }

  async function closeAt(
    position: Position,
    closePrice: string,
    reason: CloseReason,
  ): Promise<ClosedPosition> {
    const raw = unrealizedPnl(
      position.side,
      position.qty,
      position.entry_price,
      closePrice,
    );
    const realized = clampLoss(position.margin, raw);
    return await repo.close({
      positionId: position.id,
      userId: position.user_id,
      closePrice,
      realizedPnl: realized,
      reason,
    });
  }

  async function close(req: CloseRequest): Promise<ClosedPosition> {
    const pos = await repo.findOpen(req.positionId);
    if (!pos || pos.user_id !== req.userId) throw new PositionNotFoundError();
    const px = await prices.getOrFetch(pos.symbol);
    if (!px) throw new ValidationError(`no price available for ${pos.symbol}`);
    const closed = await closeAt(pos, px.price, "manual");
    logger.info(
      { userId: req.userId, positionId: pos.id, pnl: closed.realized_pnl },
      "position closed",
    );
    return closed;
  }

  return {
    open,
    close,
    closeAt,
    listOpen: (userId) => repo.listOpenByUser(userId),
    listHistory: (userId, limit) => repo.listHistoryByUser(userId, limit),
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
