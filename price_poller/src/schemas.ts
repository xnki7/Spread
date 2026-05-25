import { z } from "zod";

const BookTickerData = z.object({
  u: z.number(),
  s: z.string(),
  b: z.string(),
  B: z.string(),
  a: z.string(),
  A: z.string(),
});

const TradeData = z.object({
  e: z.literal("trade"),
  E: z.number(),
  s: z.string(),
  t: z.number(),
  p: z.string(),
  q: z.string(),
  T: z.number(),
  m: z.boolean(),
});

const Envelope = z.object({
  stream: z.string(),
  data: z.unknown(),
});

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

export function parseStreamMessage(
  raw: unknown,
  now: number,
): StreamEvent | null {
  const env = Envelope.parse(raw);
  const type = env.stream.split("@")[1];

  if (type === "bookTicker") {
    const t = BookTickerData.parse(env.data);
    return {
      kind: "bookTicker",
      symbol: t.s,
      updateId: t.u,
      bid: t.b,
      bidQty: t.B,
      ask: t.a,
      askQty: t.A,
      ts: now,
    };
  }

  if (type === "trade") {
    const t = TradeData.parse(env.data);
    return {
      kind: "trade",
      symbol: t.s,
      tradeId: t.t,
      price: t.p,
      qty: t.q,
      ts: t.T,
      buyerIsMaker: t.m,
    };
  }

  return null;
}
