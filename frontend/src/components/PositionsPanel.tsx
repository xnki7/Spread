import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth.js";
import {
  positionsApi,
  type OpenPosition,
} from "../lib/positions.js";
import type { PositionSnapshotItem } from "../lib/types.js";

type Props = {
  snapshot: PositionSnapshotItem[] | null;
  onChange?: () => void;
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

function fmtPrice(s: string): string {
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

export function PositionsPanel({ snapshot, onChange }: Props) {
  const { refreshMe } = useAuth();
  const [rest, setRest] = useState<OpenPosition[]>([]);
  const [closing, setClosing] = useState<Set<string>>(new Set());
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

  // Prefer live snapshot if available; otherwise fall back to REST + zero PnL.
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
      unrealizedPnl: p.unrealizedPnl ?? "0",
      openedAt: p.openedAt,
    }));

  async function handleClose(id: string) {
    if (closing.has(id)) return;
    setError(null);
    setClosing((s) => new Set(s).add(id));
    try {
      await positionsApi.close(id);
      setRest((r) => r.filter((p) => p.id !== id));
      await refreshMe();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "close failed");
    } finally {
      setClosing((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="positions-panel positions-empty">
        <div className="panel-title">Open positions</div>
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
      </div>
    );
  }

  return (
    <div className="positions-panel">
      <div className="positions-head">
        <div className="panel-title">Open positions · {rows.length}</div>
        {error && <span className="form-error inline">{error}</span>}
      </div>
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
          return (
            <div key={p.id} className="pos-row" role="row">
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
          );
        })}
      </div>
    </div>
  );
}
