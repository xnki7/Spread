import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth.js";
import { useToast } from "../lib/toast.js";
import {
  positionsApi,
  type OpenPosition,
  type Side,
} from "../lib/positions.js";
import type { PositionSnapshotItem } from "../lib/types.js";

type Props = {
  snapshot: PositionSnapshotItem[] | null;
  onChange?: () => void;
  onManualClose?: (id: string) => void;
};

function fmtMoney(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  if (!Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPrice(s: string | null | undefined): string {
  if (s == null) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtQty(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(6);
}

function pnlPct(unrealized: string, margin: string): number {
  const u = Number(unrealized);
  const m = Number(margin);
  if (!m) return 0;
  return (u / m) * 100;
}

export function PositionsTab({ snapshot, onChange, onManualClose }: Props) {
  const { refreshMe } = useAuth();
  const toast = useToast();
  const [rest, setRest] = useState<OpenPosition[]>([]);
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    positionsApi
      .list()
      .then((p) => {
        if (!cancelled) setRest(p);
      })
      .catch(() => {
        // best-effort; live snapshot will fill in
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: PositionSnapshotItem[] =
    snapshot ??
    rest.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      qty: p.qty,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice ?? p.entryPrice,
      leverage: p.leverage,
      margin: p.margin,
      takeProfitPrice: p.takeProfitPrice,
      stopLossPrice: p.stopLossPrice,
      unrealizedPnl: p.unrealizedPnl ?? "0",
      openedAt: p.openedAt,
    }));

  async function handleClose(id: string) {
    if (closing.has(id)) return;
    setError(null);
    setClosing((s) => new Set(s).add(id));
    onManualClose?.(id);
    const row = rows.find((r) => r.id === id);
    try {
      const result = await positionsApi.close(id);
      setRest((r) => r.filter((p) => p.id !== id));
      await refreshMe();
      onChange?.();
      const pnl = Number(result?.realizedPnl ?? row?.unrealizedPnl ?? 0);
      const sign = pnl >= 0 ? "+" : "-";
      toast.push({
        variant: pnl >= 0 ? "success" : "warn",
        title: `${row?.symbol ?? "Position"} closed`,
        body: `Realized ${sign}$${Math.abs(pnl).toFixed(2)}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "close failed");
      toast.push({
        variant: "danger",
        title: "Close failed",
        body: err instanceof Error ? err.message : "unknown error",
      });
    } finally {
      setClosing((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleSaveStops(
    id: string,
    tp: number | null,
    sl: number | null,
  ) {
    try {
      const updated = await positionsApi.updateStops(id, {
        takeProfitPrice: tp,
        stopLossPrice: sl,
      });
      setRest((r) => r.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      setEditing(null);
      toast.push({
        variant: "success",
        title: "Stops updated",
        body:
          tp === null && sl === null
            ? "TP and SL cleared"
            : `${tp !== null ? `TP ${fmtPrice(String(tp))}` : ""}${tp !== null && sl !== null ? " · " : ""}${sl !== null ? `SL ${fmtPrice(String(sl))}` : ""}`,
      });
    } catch (err) {
      toast.push({
        variant: "danger",
        title: "Stops update failed",
        body: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 4 4 6-6" />
          </svg>
        </div>
        <div className="empty-text">No open positions</div>
        <div className="empty-sub">Place an order to get started</div>
      </div>
    );
  }

  return (
    <>
      {error && <div className="form-error" style={{ margin: "0 16px 8px" }}>{error}</div>}
      <div className="positions-table" role="table">
        <div className="pos-row pos-header" role="row">
          <div role="columnheader">Symbol</div>
          <div role="columnheader">Size</div>
          <div role="columnheader">Entry</div>
          <div role="columnheader">Mark</div>
          <div role="columnheader">Margin</div>
          <div role="columnheader">PnL</div>
          <div role="columnheader"></div>
        </div>
        {rows.map((p) => {
          const pnl = Number(p.unrealizedPnl);
          const pct = pnlPct(p.unrealizedPnl, p.margin);
          const up = pnl >= 0;
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className="pos-row-wrap">
              <div className="pos-row" role="row">
                <div className="pos-symbol">
                  <span className="sym">{p.symbol}</span>
                  <span className={`badge ${p.side}`}>
                    {p.side.toUpperCase()} {p.leverage}×
                  </span>
                </div>
                <div className="mono">{fmtQty(p.qty)}</div>
                <div className="mono">{fmtPrice(p.entryPrice)}</div>
                <div className="mono">{fmtPrice(p.currentPrice)}</div>
                <div className="mono">{fmtMoney(p.margin)}</div>
                <div className={`mono pnl ${up ? "up" : "down"}`}>
                  <div>{up ? "+" : ""}{fmtMoney(pnl)}</div>
                  <div className="pnl-pct">{up ? "+" : ""}{pct.toFixed(2)}%</div>
                </div>
                <div>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={() => handleClose(p.id)}
                    disabled={closing.has(p.id)}
                  >
                    {closing.has(p.id) ? "…" : "Close"}
                  </button>
                </div>
              </div>
              <div className="pos-stops-row">
                <StopChip
                  kind="tp"
                  value={p.takeProfitPrice}
                  active={isEditing}
                  onClick={() => setEditing(isEditing ? null : p.id)}
                />
                <StopChip
                  kind="sl"
                  value={p.stopLossPrice}
                  active={isEditing}
                  onClick={() => setEditing(isEditing ? null : p.id)}
                />
              </div>
              {isEditing && (
                <StopsEditor
                  side={p.side}
                  entryPrice={p.entryPrice}
                  initialTp={p.takeProfitPrice}
                  initialSl={p.stopLossPrice}
                  onCancel={() => setEditing(null)}
                  onSave={(tp, sl) => handleSaveStops(p.id, tp, sl)}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StopChip({
  kind,
  value,
  active,
  onClick,
}: {
  kind: "tp" | "sl";
  value: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const has = value != null;
  const label = kind === "tp" ? "TP" : "SL";
  const cls = ["stop-chip", kind, has ? "set" : "unset", active ? "active" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} onClick={onClick}>
      <span className="stop-chip-label">{label}</span>
      <span className="stop-chip-value mono">
        {has ? fmtPrice(value) : "Set"}
      </span>
    </button>
  );
}

function StopsEditor({
  side,
  entryPrice,
  initialTp,
  initialSl,
  onCancel,
  onSave,
}: {
  side: Side;
  entryPrice: string;
  initialTp: string | null;
  initialSl: string | null;
  onCancel: () => void;
  onSave: (tp: number | null, sl: number | null) => void | Promise<void>;
}) {
  const entry = Number(entryPrice);
  const [tp, setTp] = useState(initialTp ?? "");
  const [sl, setSl] = useState(initialSl ?? "");

  const tpN = tp.trim() === "" ? null : Number(tp);
  const slN = sl.trim() === "" ? null : Number(sl);

  const error = useMemo(() => {
    if (!Number.isFinite(entry) || entry <= 0) return null;
    if (tpN !== null) {
      if (!Number.isFinite(tpN) || tpN <= 0) return "TP must be > 0";
      if (side === "long" && tpN <= entry) return "TP must be above entry";
      if (side === "short" && tpN >= entry) return "TP must be below entry";
    }
    if (slN !== null) {
      if (!Number.isFinite(slN) || slN <= 0) return "SL must be > 0";
      if (side === "long" && slN >= entry) return "SL must be below entry";
      if (side === "short" && slN <= entry) return "SL must be above entry";
    }
    return null;
  }, [entry, side, tpN, slN]);

  function handleSave() {
    if (error) return;
    void onSave(tpN, slN);
  }

  return (
    <div className="stops-editor">
      <div className="stops-editor-fields">
        <label className="stops-editor-field">
          <span>Take profit</span>
          <input
            inputMode="decimal"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder={side === "long" ? `> ${fmtPrice(entryPrice)}` : `< ${fmtPrice(entryPrice)}`}
            autoFocus
          />
        </label>
        <label className="stops-editor-field">
          <span>Stop loss</span>
          <input
            inputMode="decimal"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder={side === "long" ? `< ${fmtPrice(entryPrice)}` : `> ${fmtPrice(entryPrice)}`}
          />
        </label>
      </div>
      {error && <div className="stops-editor-error">{error}</div>}
      <div className="stops-editor-actions">
        <button type="button" className="icon-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            setTp("");
            setSl("");
          }}
        >
          Clear both
        </button>
        <button
          type="button"
          className="submit buy"
          disabled={!!error}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}
