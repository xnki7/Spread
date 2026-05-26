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

export type StreamEvent = BookTickerEvent | TradeEvent;

export type WsEnvelope = { channel: string; data: StreamEvent };
