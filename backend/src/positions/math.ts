import type { Side } from "./repos.js";

const SCALE = 1e8;
const SCALE_BI = 10_000_000n * 10n;

function toBi(numStr: string): bigint {
  const n = numStr.trim();
  const neg = n.startsWith("-");
  const s = neg ? n.slice(1) : n;
  const [whole, frac = ""] = s.split(".");
  const fracPad = (frac + "00000000").slice(0, 8);
  const result = BigInt(whole || "0") * SCALE_BI + BigInt(fracPad || "0");
  return neg ? -result : result;
}

function fromBi(bi: bigint): string {
  const neg = bi < 0n;
  const abs = neg ? -bi : bi;
  const whole = abs / SCALE_BI;
  const frac = abs % SCALE_BI;
  const fracStr = frac.toString().padStart(8, "0");
  return `${neg ? "-" : ""}${whole}.${fracStr}`;
}

export function unrealizedPnl(
  side: Side,
  qty: string,
  entryPrice: string,
  currentPrice: string,
): string {
  const q = toBi(qty);
  const ep = toBi(entryPrice);
  const cp = toBi(currentPrice);
  const diff = side === "long" ? cp - ep : ep - cp;
  // pnl = qty * diff. Both have 8 decimals; product has 16, need to scale back down.
  const product = (q * diff) / SCALE_BI;
  return fromBi(product);
}

export function liquidationPrice(
  side: Side,
  qty: string,
  entryPrice: string,
  margin: string,
  maintenanceMarginRatio: number,
): string {
  const q = toBi(qty);
  if (q === 0n) return entryPrice;
  const ep = toBi(entryPrice);
  const m = toBi(margin);
  const mm = toBi((Number(margin) * maintenanceMarginRatio).toFixed(8));
  // We liquidate when pnl <= -(margin - maintenance). i.e. usable buffer = m - mm
  const buffer = m - mm;
  // For long: pnl = qty * (cp - ep) → cp = ep - buffer/qty
  // For short: pnl = qty * (ep - cp) → cp = ep + buffer/qty
  const delta = (buffer * SCALE_BI) / q;
  const liq = side === "long" ? ep - delta : ep + delta;
  return fromBi(liq < 0n ? 0n : liq);
}

export function qtyFromMarginLeverage(
  margin: string,
  leverage: number,
  price: string,
): string {
  const m = toBi(margin);
  const p = toBi(price);
  if (p === 0n) return "0";
  const notional = m * BigInt(leverage);
  const qScaled = (notional * SCALE_BI) / p;
  return fromBi(qScaled);
}

export function clampLoss(margin: string, pnl: string): string {
  const m = toBi(margin);
  const p = toBi(pnl);
  if (p < -m) return fromBi(-m);
  return fromBi(p);
}

export const _internal = { toBi, fromBi };
