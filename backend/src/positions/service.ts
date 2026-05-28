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
  takeProfitPrice?: string | null;
  stopLossPrice?: string | null;
};

export type CloseRequest = {
  userId: string;
  positionId: string;
};

export type UpdateStopsRequest = {
  userId: string;
  positionId: string;
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
};

export type PositionsService = {
  open: (req: OpenRequest) => Promise<Position>;
  close: (req: CloseRequest) => Promise<ClosedPosition>;
  closeAt: (
    position: Position,
    closePrice: string,
    reason: CloseReason,
  ) => Promise<ClosedPosition>;
  updateStops: (req: UpdateStopsRequest) => Promise<Position>;
  listOpen: (userId: string) => Promise<Position[]>;
  listHistory: (userId: string, limit: number) => Promise<ClosedPosition[]>;
};

export type Limits = {
  minMargin: number;
  maxLeverage: number;
};

// Validate stop levels against the reference (entry) price for a given side.
// Returns the normalized numeric strings, or null when not provided.
function validateStops(
  side: Side,
  referencePrice: string,
  takeProfit: string | null | undefined,
  stopLoss: string | null | undefined,
): { tp: string | null; sl: string | null } {
  const ref = Number(referencePrice);
  if (!Number.isFinite(ref) || ref <= 0) {
    throw new ValidationError("invalid reference price for stops");
  }
  let tp: string | null = null;
  if (takeProfit != null && takeProfit !== "") {
    const n = Number(takeProfit);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ValidationError("take profit must be a positive number");
    }
    if (side === "long" && n <= ref) {
      throw new ValidationError("take profit must be above entry for a long");
    }
    if (side === "short" && n >= ref) {
      throw new ValidationError("take profit must be below entry for a short");
    }
    tp = n.toFixed(8);
  }
  let sl: string | null = null;
  if (stopLoss != null && stopLoss !== "") {
    const n = Number(stopLoss);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ValidationError("stop loss must be a positive number");
    }
    if (side === "long" && n >= ref) {
      throw new ValidationError("stop loss must be below entry for a long");
    }
    if (side === "short" && n <= ref) {
      throw new ValidationError("stop loss must be above entry for a short");
    }
    sl = n.toFixed(8);
  }
  return { tp, sl };
}

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

    const { tp, sl } = validateStops(
      req.side,
      px.price,
      req.takeProfitPrice,
      req.stopLossPrice,
    );

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
        takeProfitPrice: tp,
        stopLossPrice: sl,
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

  async function updateStops(req: UpdateStopsRequest): Promise<Position> {
    const pos = await repo.findOpen(req.positionId);
    if (!pos || pos.user_id !== req.userId) throw new PositionNotFoundError();
    // Validate against entry price — the DB CHECK uses entry too, so this
    // matches and produces a friendlier error than the raw constraint trip.
    const { tp, sl } = validateStops(
      pos.side,
      pos.entry_price,
      req.takeProfitPrice,
      req.stopLossPrice,
    );
    const updated = await repo.updateStops({
      positionId: pos.id,
      userId: pos.user_id,
      takeProfitPrice: tp,
      stopLossPrice: sl,
    });
    logger.info(
      { userId: pos.user_id, positionId: pos.id, tp, sl },
      "position stops updated",
    );
    return updated;
  }

  return {
    open,
    close,
    closeAt,
    updateStops,
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
