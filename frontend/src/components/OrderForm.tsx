import { useState } from "react";

type Side = "buy" | "sell";

type Props = {
  symbol: string;
  livePrice: number | null;
};

export function OrderForm({ symbol, livePrice }: Props) {
  const [side, setSide] = useState<Side>("buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState("1");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const order = {
      symbol,
      side,
      qty: Number(qty),
      price: Number(price || livePrice || 0),
      leverage: Number(leverage),
    };
    console.log("[order:stub]", order);
    alert(
      `Stub: ${side.toUpperCase()} ${order.qty} ${symbol} @ ${order.price} (${leverage}×)`,
    );
  }

  const qtyN = Number(qty);
  const priceN = Number(price || livePrice || 0);
  const lev = Math.max(1, Number(leverage) || 1);
  const notional = qtyN > 0 && priceN > 0 ? qtyN * priceN : 0;
  const margin = notional > 0 ? notional / lev : 0;

  return (
    <aside className="order-panel">
      <h3 className="panel-title">Place order</h3>

      <div className="side-toggle">
        <button
          type="button"
          className={`buy ${side === "buy" ? "active" : ""}`}
          onClick={() => setSide("buy")}
        >
          Long
        </button>
        <button
          type="button"
          className={`sell ${side === "sell" ? "active" : ""}`}
          onClick={() => setSide("sell")}
        >
          Short
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Quantity</label>
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="field">
          <label>Price (limit)</label>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={livePrice !== null ? livePrice.toFixed(4) : "0.00"}
          />
          {livePrice !== null && (
            <span className="hint mono">Market · {livePrice.toFixed(4)}</span>
          )}
        </div>

        <div className="field">
          <label>Leverage</label>
          <input
            type="number"
            min={1}
            max={100}
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
          />
          <span className="hint">1× — 100×</span>
        </div>

        <div style={{
          padding: "10px 12px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          margin: "6px 0 14px",
          fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
            <span>Position size</span>
            <span className="mono" style={{ color: "var(--text)" }}>${notional.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginTop: 4 }}>
            <span>Margin required</span>
            <span className="mono" style={{ color: "var(--yellow)" }}>${margin.toFixed(2)}</span>
          </div>
        </div>

        <button type="submit" className={`submit ${side}`}>
          {side === "buy" ? "Buy / Long" : "Sell / Short"} {symbol}
        </button>
      </form>
    </aside>
  );
}
