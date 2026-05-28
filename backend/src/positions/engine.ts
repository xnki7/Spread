import type Redis from "ioredis";
import { logger } from "../logger.js";
import { clampLoss, unrealizedPnl } from "./math.js";
import type { PriceCache } from "./pricing.js";
import type {
  CloseReason,
  PositionsService as PositionsRepo,
  Position,
} from "./repos.js";
import type { PositionsService } from "./service.js";

const PRICE_CHANNEL_PREFIX = "prices:trade:";
const POSITION_EVENT_PREFIX = "events:position:";

type TradeEvent = {
  kind: "trade";
  symbol: string;
  price: string;
  ts: number;
};

export type PnlEngine = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onPositionOpened: (p: Position) => void;
  onPositionUpdated: (p: Position) => void;
  onPositionClosed: (positionId: string, userId: string) => void;
  broadcastSnapshot: (userId: string) => Promise<void>;
};

export type EngineDeps = {
  repo: PositionsRepo;
  service: PositionsService;
  prices: PriceCache;
  subscriber: Redis;
  publisher: Redis;
};

// Returns the close reason if a stop should fire at the given price, else null.
// Long: TP triggers at price >= tp, SL at price <= sl.
// Short: TP triggers at price <= tp, SL at price >= sl.
function stopReason(p: Position, price: number): CloseReason | null {
  const tp = p.take_profit_price ? Number(p.take_profit_price) : null;
  const sl = p.stop_loss_price ? Number(p.stop_loss_price) : null;
  if (p.side === "long") {
    if (tp !== null && price >= tp) return "take_profit";
    if (sl !== null && price <= sl) return "stop_loss";
  } else {
    if (tp !== null && price <= tp) return "take_profit";
    if (sl !== null && price >= sl) return "stop_loss";
  }
  return null;
}

export function createPnlEngine(deps: EngineDeps): PnlEngine {
  const { repo, service, prices, subscriber, publisher } = deps;

  const bySymbol = new Map<string, Map<string, Position>>();
  const dirtyUsers = new Set<string>();
  let flushTimer: NodeJS.Timeout | null = null;
  const FLUSH_MS = 250;

  function addPosition(p: Position): void {
    let bucket = bySymbol.get(p.symbol);
    if (!bucket) {
      bucket = new Map();
      bySymbol.set(p.symbol, bucket);
    }
    bucket.set(p.id, p);
  }

  function removePosition(positionId: string): void {
    for (const [sym, bucket] of bySymbol) {
      if (bucket.delete(positionId) && bucket.size === 0) bySymbol.delete(sym);
    }
  }

  function markDirty(userId: string): void {
    dirtyUsers.add(userId);
    if (flushTimer === null) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const users = Array.from(dirtyUsers);
        dirtyUsers.clear();
        for (const u of users) void broadcastSnapshot(u);
      }, FLUSH_MS);
    }
  }

  async function broadcastSnapshot(userId: string): Promise<void> {
    const open: Position[] = [];
    for (const bucket of bySymbol.values()) {
      for (const p of bucket.values()) {
        if (p.user_id === userId) open.push(p);
      }
    }
    const items = open.map((p) => {
      const px = prices.get(p.symbol);
      const currentPrice = px?.price ?? p.entry_price;
      const raw = unrealizedPnl(p.side, p.qty, p.entry_price, currentPrice);
      const pnl = clampLoss(p.margin, raw);
      return {
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        qty: p.qty,
        entryPrice: p.entry_price,
        currentPrice,
        leverage: p.leverage,
        margin: p.margin,
        takeProfitPrice: p.take_profit_price,
        stopLossPrice: p.stop_loss_price,
        unrealizedPnl: pnl,
        openedAt: p.opened_at.getTime(),
      };
    });
    const payload = JSON.stringify({
      kind: "position_snapshot",
      userId,
      ts: Date.now(),
      positions: items,
    });
    try {
      await publisher.publish(`${POSITION_EVENT_PREFIX}${userId}`, payload);
    } catch (err) {
      logger.warn({ err, userId }, "position publish failed");
    }
  }

  async function processTick(symbol: string, price: string, ts: number): Promise<void> {
    prices.set(symbol, price, ts);
    const bucket = bySymbol.get(symbol);
    if (!bucket || bucket.size === 0) return;

    const priceN = Number(price);
    // Two-phase: stops fire before liquidations. A position can only close once
    // per tick, so once we tag a reason we don't also evaluate it for liquidation.
    type Pending = { pos: Position; reason: CloseReason };
    const pending: Pending[] = [];

    for (const p of bucket.values()) {
      markDirty(p.user_id);
      const stop = Number.isFinite(priceN) ? stopReason(p, priceN) : null;
      if (stop) {
        pending.push({ pos: p, reason: stop });
        continue;
      }
      const raw = unrealizedPnl(p.side, p.qty, p.entry_price, price);
      if (Number(raw) <= -Number(p.margin)) {
        pending.push({ pos: p, reason: "liquidation" });
      }
    }

    for (const { pos, reason } of pending) {
      try {
        await service.closeAt(pos, price, reason);
        bucket.delete(pos.id);
        logger.info(
          { userId: pos.user_id, positionId: pos.id, price, reason },
          "position auto-closed",
        );
      } catch (err) {
        logger.error({ err, positionId: pos.id, reason }, "auto-close failed");
      }
    }
    if (bucket.size === 0) bySymbol.delete(symbol);
  }

  async function start(): Promise<void> {
    const existing = await repo.listAllOpen();
    for (const p of existing) addPosition(p);
    logger.info({ count: existing.length }, "pnl engine hydrated open positions");

    await subscriber.psubscribe(`${PRICE_CHANNEL_PREFIX}*`);
    subscriber.on("pmessage", (_pattern, channel, message) => {
      if (!channel.startsWith(PRICE_CHANNEL_PREFIX)) return;
      const symbol = channel.slice(PRICE_CHANNEL_PREFIX.length);
      try {
        const ev = JSON.parse(message) as TradeEvent;
        if (ev.kind !== "trade") return;
        void processTick(symbol, ev.price, ev.ts);
      } catch (err) {
        logger.warn({ err, channel }, "bad trade event");
      }
    });
    logger.info("pnl engine started");
  }

  async function stop(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    try {
      await subscriber.punsubscribe(`${PRICE_CHANNEL_PREFIX}*`);
    } catch {
      // ignore
    }
  }

  return {
    start,
    stop,
    onPositionOpened: (p) => {
      addPosition(p);
      markDirty(p.user_id);
    },
    onPositionUpdated: (p) => {
      // Stops were edited — replace the cached row so the next tick uses the
      // new TP/SL levels without waiting for a full reload.
      const bucket = bySymbol.get(p.symbol);
      if (bucket && bucket.has(p.id)) bucket.set(p.id, p);
      markDirty(p.user_id);
    },
    onPositionClosed: (positionId, userId) => {
      removePosition(positionId);
      markDirty(userId);
    },
    broadcastSnapshot,
  };
}
