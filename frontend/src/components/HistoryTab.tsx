import { useCallback, useEffect, useState } from "react";
import { positionsApi, type ClosedPosition } from "../lib/positions.js";

type Props = {
  reloadKey?: number;
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

function fmtAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HistoryTab({ reloadKey }: Props) {
  const [rows, setRows] = useState<ClosedPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await positionsApi.history(100);
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "history failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (rows === null && !error) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <div className="empty-sub">loading history…</div>
      </div>
    );
  }

  if (error) {
    return <div className="form-error" style={{ margin: "12px 16px" }}>{error}</div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <div className="empty-text">No closed positions yet</div>
        <div className="empty-sub">Your trade history will appear here</div>
      </div>
    );
  }

  return (
    <div className="positions-table" role="table">
      <div className="pos-row pos-header history-row" role="row">
        <div role="columnheader">Symbol</div>
        <div role="columnheader">Entry</div>
        <div role="columnheader">Close</div>
        <div role="columnheader">Margin</div>
        <div role="columnheader">Realized PnL</div>
        <div role="columnheader">Closed</div>
      </div>
      {rows.map((p) => {
        const pnl = Number(p.realizedPnl);
        const up = pnl >= 0;
        const pct = Number(p.margin) > 0 ? (pnl / Number(p.margin)) * 100 : 0;
        return (
          <div key={p.id} className="pos-row history-row" role="row">
            <div className="pos-symbol">
              <span className="sym">{p.symbol}</span>
              <span className={`badge ${p.side}`}>
                {p.side.toUpperCase()} {p.leverage}×
              </span>
              {p.reason === "liquidation" && (
                <span className="badge liquidation">LIQ</span>
              )}
              {p.reason === "take_profit" && (
                <span className="badge take-profit">TP</span>
              )}
              {p.reason === "stop_loss" && (
                <span className="badge stop-loss">SL</span>
              )}
            </div>
            <div className="mono">{fmtPrice(p.entryPrice)}</div>
            <div className="mono">{fmtPrice(p.closePrice)}</div>
            <div className="mono">{fmtMoney(p.margin)}</div>
            <div className={`mono pnl ${up ? "up" : "down"}`}>
              <div>{up ? "+" : ""}{fmtMoney(pnl)}</div>
              <div className="pnl-pct">{up ? "+" : ""}{pct.toFixed(2)}%</div>
            </div>
            <div className="mono closed-at">{fmtAgo(p.closedAt)}</div>
          </div>
        );
      })}
    </div>
  );
}
