import { useMemo, useState } from "react";
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

// Quick %-from-entry buttons. TP is positive direction, SL is negative.
const TP_PRESETS = [5, 10, 25];
const SL_PRESETS = [2, 5, 10];

function tpFromPct(entry: number, side: Side, pct: number): number {
  return side === "long" ? entry * (1 + pct / 100) : entry * (1 - pct / 100);
}
function slFromPct(entry: number, side: Side, pct: number): number {
  return side === "long" ? entry * (1 - pct / 100) : entry * (1 + pct / 100);
}

function fmtTriggerPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export function OrderForm({ symbol, livePrice, onOpened }: Props) {
  const { state, refreshMe } = useAuth();
  const toast = useToast();
  const [side, setSide] = useState<Side>("long");
  const [margin, setMargin] = useState("100");
  const [leverage, setLeverage] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tpInput, setTpInput] = useState("");
  const [slInput, setSlInput] = useState("");
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

  const tpN = tpInput.trim() === "" ? null : Number(tpInput);
  const slN = slInput.trim() === "" ? null : Number(slInput);

  // Validate stops against the current live price (used as the entry estimate).
  const stopsError = useMemo(() => {
    if (livePrice === null) return null;
    if (tpN !== null) {
      if (!Number.isFinite(tpN) || tpN <= 0) return "TP must be a positive number";
      if (side === "long" && tpN <= livePrice) return "TP must be above entry for a long";
      if (side === "short" && tpN >= livePrice) return "TP must be below entry for a short";
    }
    if (slN !== null) {
      if (!Number.isFinite(slN) || slN <= 0) return "SL must be a positive number";
      if (side === "long" && slN >= livePrice) return "SL must be below entry for a long";
      if (side === "short" && slN <= livePrice) return "SL must be above entry for a short";
    }
    return null;
  }, [livePrice, side, tpN, slN]);

  // Project realized $ at each stop level so the trader sees the risk up-front.
  const tpProfit = useMemo(() => {
    if (tpN === null || livePrice === null || qty <= 0) return null;
    return side === "long" ? (tpN - livePrice) * qty : (livePrice - tpN) * qty;
  }, [tpN, livePrice, qty, side]);
  const slLoss = useMemo(() => {
    if (slN === null || livePrice === null || qty <= 0) return null;
    return side === "long" ? (slN - livePrice) * qty : (livePrice - slN) * qty;
  }, [slN, livePrice, qty, side]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!symbol) return setError("pick a symbol first");
    if (marginN < 10) return setError("min margin is $10");
    if (insufficient) return setError("not enough free margin");
    if (stopsError) return setError(stopsError);
    setSubmitting(true);
    try {
      const pos = await positionsApi.open({
        symbol,
        side,
        margin: marginN,
        leverage,
        takeProfitPrice: tpN,
        stopLossPrice: slN,
      });
      await refreshMe();
      onOpened?.();
      toast.push({
        variant: "success",
        title: `${side === "long" ? "Long" : "Short"} ${pos.symbol} opened`,
        body: `${leverage}× · margin $${marginN.toFixed(2)} @ $${Number(pos.entryPrice).toFixed(4)}`,
      });
      setTpInput("");
      setSlInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "open failed";
      setError(msg);
      toast.push({ variant: "danger", title: "Open failed", body: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function applyTpPct(pct: number) {
    if (livePrice === null) return;
    setTpInput(fmtTriggerPrice(tpFromPct(livePrice, side, pct)));
  }
  function applySlPct(pct: number) {
    if (livePrice === null) return;
    setSlInput(fmtTriggerPrice(slFromPct(livePrice, side, pct)));
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

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced((s) => !s)}
          aria-expanded={showAdvanced}
        >
          <span>{showAdvanced ? "▾" : "▸"} Take Profit / Stop Loss</span>
          {(tpN !== null || slN !== null) && !showAdvanced && (
            <span className="advanced-summary mono">
              {tpN !== null && <span className="up">TP {fmtTriggerPrice(tpN)}</span>}
              {tpN !== null && slN !== null && " · "}
              {slN !== null && <span className="down">SL {fmtTriggerPrice(slN)}</span>}
            </span>
          )}
        </button>

        {showAdvanced && (
          <div className="advanced-stops">
            <div className="field">
              <label>Take profit price</label>
              <input
                inputMode="decimal"
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                placeholder={livePrice ? `> ${fmtTriggerPrice(livePrice)}` : "—"}
              />
              <div className="preset-row">
                {TP_PRESETS.map((pct) => (
                  <button
                    type="button"
                    key={pct}
                    className="preset"
                    onClick={() => applyTpPct(pct)}
                    disabled={livePrice === null}
                  >
                    +{pct}%
                  </button>
                ))}
                {tpInput && (
                  <button
                    type="button"
                    className="preset"
                    onClick={() => setTpInput("")}
                  >
                    Clear
                  </button>
                )}
              </div>
              {tpProfit !== null && (
                <span className="hint mono up">
                  Profit at TP: +${tpProfit.toFixed(2)}
                </span>
              )}
            </div>

            <div className="field">
              <label>Stop loss price</label>
              <input
                inputMode="decimal"
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                placeholder={livePrice ? `< ${fmtTriggerPrice(livePrice)}` : "—"}
              />
              <div className="preset-row">
                {SL_PRESETS.map((pct) => (
                  <button
                    type="button"
                    key={pct}
                    className="preset"
                    onClick={() => applySlPct(pct)}
                    disabled={livePrice === null}
                  >
                    −{pct}%
                  </button>
                ))}
                {slInput && (
                  <button
                    type="button"
                    className="preset"
                    onClick={() => setSlInput("")}
                  >
                    Clear
                  </button>
                )}
              </div>
              {slLoss !== null && (
                <span className="hint mono down">
                  Loss at SL: ${slLoss.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

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

        {(error || stopsError) && <div className="form-error">{error ?? stopsError}</div>}

        <button
          type="submit"
          className={`submit ${side === "long" ? "buy" : "sell"}`}
          disabled={submitting || !symbol || marginN <= 0 || livePrice === null || !!stopsError}
        >
          {submitting
            ? "Opening…"
            : `${side === "long" ? "Long" : "Short"} ${symbol || ""} ${leverage}×`}
        </button>
      </form>
    </aside>
  );
}
