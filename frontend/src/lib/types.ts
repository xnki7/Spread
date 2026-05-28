export type BookTickerEvent = {
  kind: "bookTicker";
  symbol: string;
  updateId: number;
  bid: string;
  bidQty: string;
  ask: string;
  askQty: string;
  ts: number;
};

export type TradeEvent = {
  kind: "trade";
  symbol: string;
  tradeId: number;
  price: string;
  qty: string;
  ts: number;
  buyerIsMaker: boolean;
};

export type PositionSnapshotItem = {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: string;
  entryPrice: string;
  currentPrice: string;
  leverage: number;
  margin: string;
  unrealizedPnl: string;
  openedAt: number;
};

export type PositionSnapshotEvent = {
  kind: "position_snapshot";
  userId: string;
  ts: number;
  positions: PositionSnapshotItem[];
};

export type StreamEvent = BookTickerEvent | TradeEvent | PositionSnapshotEvent;

export type WsEnvelope = { channel: string; data: StreamEvent };
