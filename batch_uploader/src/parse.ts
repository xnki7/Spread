import { z } from "zod";

const TradeFields = z.object({
  symbol: z.string(),
  price: z.string(),
  qty: z.string(),
  tradeId: z.string().regex(/^\d+$/),
  ts: z.string().regex(/^\d+$/),
  buyerIsMaker: z.enum(["0", "1"]),
});

export type TradeRow = {
  ts: Date;
  symbol: string;
  trade_id: string;
  price: string;
  qty: string;
  buyer_is_maker: boolean;
};

export function fieldsToObject(fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i];
    const v = fields[i + 1];
    if (k !== undefined && v !== undefined) obj[k] = v;
  }
  return obj;
}

export function parseStreamEntry(fields: string[]): TradeRow {
  const t = TradeFields.parse(fieldsToObject(fields));
  return {
    ts: new Date(Number(t.ts)),
    symbol: t.symbol,
    trade_id: t.tradeId,
    price: t.price,
    qty: t.qty,
    buyer_is_maker: t.buyerIsMaker === "1",
  };
}
