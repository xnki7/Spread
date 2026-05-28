import { useState } from "react";
import { useAuth } from "../lib/auth.js";
import { useToast } from "../lib/toast.js";
import { positionsApi, type Side } from "../lib/positions.js";

type Props = {
  symbol: string;
  livePrice: number | null;
  onOpened?: () => void;
};

const MARGIN_PRESETS = [25, 100, 500, 1000];
const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100];

export function OrderForm({ symbol, livePrice, onOpened }: Props) {
  const { state, refreshMe } = useAuth();
  const toast = useToast();
  const [side, setSide] = useState<Side>("long");
  const [margin, setMargin] = useState("100");
  const [leverage, setLeverage] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marginN = Number(margin);
  const notional = marginN > 0 ? marginN * leverage : 0;
  const qty = notional > 0 && livePrice ? notional / livePrice : 0;
  const free =
    state.status === "signedIn" && state.wallet
      ? Number(state.wallet.balance) - Number(state.wallet.lockedMargin)
      : 0;
  const insufficient = marginN > 0 && marginN > free;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!symbol) return setError("pick a symbol first");
    if (marginN < 10) return setError("min margin is $10");
    if (insufficient) return setError("not enough free margin");
    setSubmitting(true);
    try {
      const pos = await positionsApi.open({ symbol, side, margin: marginN, leverage });
      await refreshMe();
      onOpened?.();
      toast.push({
        variant: "success",
        title: `${side === "long" ? "Long" : "Short"} ${pos.symbol} opened`,
        body: `${leverage}× · margin $${marginN.toFixed(2)} @ $${Number(pos.entryPrice).toFixed(4)}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "open failed";
      setError(msg);
      toast.push({ variant: "danger", title: "Open failed", body: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="order-panel">
      <h3 className="panel-title">Open position</h3>

      <div className="side-toggle">
        <button
          type="button"
          className={`buy ${side === "long" ? "active" : ""}`}
          onClick={() => setSide("long")}
        >
          Long
        </button>
        <button
          type="button"
          className={`sell ${side === "short" ? "active" : ""}`}
          onClick={() => setSide("short")}
        >
          Short
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Margin (USD)</label>
          <input
            inputMode="decimal"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="100"
            required
          />
          <div className="preset-row">
            {MARGIN_PRESETS.map((m) => (
              <button
                type="button"
                key={m}
                className={`preset ${marginN === m ? "active" : ""}`}
                onClick={() => setMargin(String(m))}
              >
                ${m}
              </button>
            ))}
          </div>
          <span className="hint mono">
            Free: ${free.toFixed(2)}
          </span>
        </div>

        <div className="field">
          <label>Leverage · {leverage}×</label>
          <input
            type="range"
            min={1}
            max={100}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="lev-range"
          />
          <div className="preset-row">
            {LEVERAGE_PRESETS.map((l) => (
              <button
                type="button"
                key={l}
                className={`preset ${leverage === l ? "active" : ""}`}
                onClick={() => setLeverage(l)}
              >
                {l}×
              </button>
            ))}
          </div>
        </div>

        <div className="order-summary">
          <div className="row">
            <span>Entry (market)</span>
            <span className="mono">
              {livePrice !== null ? `$${livePrice.toFixed(4)}` : "—"}
            </span>
          </div>
          <div className="row">
            <span>Position size</span>
            <span className="mono">${notional.toFixed(2)}</span>
          </div>
          <div className="row">
            <span>Quantity</span>
            <span className="mono">{qty > 0 ? qty.toFixed(6) : "—"}</span>
          </div>
          <div className="row">
            <span>Margin required</span>
            <span className="mono yellow">${marginN > 0 ? marginN.toFixed(2) : "0.00"}</span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button
          type="submit"
          className={`submit ${side === "long" ? "buy" : "sell"}`}
          disabled={submitting || !symbol || marginN <= 0 || livePrice === null}
        >
          {submitting
            ? "Opening…"
            : `${side === "long" ? "Long" : "Short"} ${symbol || ""} ${leverage}×`}
        </button>
      </form>
    </aside>
  );
}
