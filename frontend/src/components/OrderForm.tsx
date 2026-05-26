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

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const order = {
      symbol,
      side,
      qty: Number(qty),
      price: Number(price || livePrice || 0),
    };
    // matching engine not wired yet
    console.log("[order:stub]", order);
    alert(`Stub: ${side.toUpperCase()} ${order.qty} ${symbol} @ ${order.price}`);
  }

  return (
    <form className="order-panel" onSubmit={onSubmit}>
      <h3>Place order</h3>
      <div className="side-toggle">
        <button
          type="button"
          className={`buy ${side === "buy" ? "active" : ""}`}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={`sell ${side === "sell" ? "active" : ""}`}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

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
        <label>Price {livePrice !== null && <span style={{ color: "#6b7280" }}>(mkt {livePrice})</span>}</label>
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={livePrice !== null ? String(livePrice) : "0.00"}
        />
      </div>

      <button type="submit" className={`submit ${side}`}>
        {side === "buy" ? "Buy" : "Sell"} {symbol}
      </button>
    </form>
  );
}
