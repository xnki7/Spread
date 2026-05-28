import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "../lib/auth.js";
import { positionsApi, type ClosedPosition } from "../lib/positions.js";
import type { PositionSnapshotItem } from "../lib/types.js";

type Props = {
  snapshot: PositionSnapshotItem[] | null;
  reloadKey?: number;
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isToday(ms: number): boolean {
  const d = new Date(ms);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function WalletTab({ snapshot, reloadKey }: Props) {
  const { state, refreshMe } = useAuth();
  const [history, setHistory] = useState<ClosedPosition[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await positionsApi.history(500);
      setHistory(list);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (state.status !== "signedIn" || !state.wallet) {
    return <div className="empty-state"><div className="empty-sub">loading…</div></div>;
  }

  const balance = Number(state.wallet.balance);
  const locked = Number(state.wallet.lockedMargin);
  const free = balance - locked;

  const unrealized = (snapshot ?? []).reduce(
    (sum, p) => sum + Number(p.unrealizedPnl || 0),
    0,
  );
  const equity = balance + unrealized;

  const realizedAll = history.reduce((sum, p) => sum + Number(p.realizedPnl), 0);
  const realizedToday = history
    .filter((p) => isToday(p.closedAt))
    .reduce((sum, p) => sum + Number(p.realizedPnl), 0);

  const tradeCount = history.length;
  const winCount = history.filter((p) => Number(p.realizedPnl) > 0).length;
  const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

  const openCount = snapshot?.length ?? 0;
  const canReset = openCount === 0 && balance < 5000;

  async function handleReset() {
    if (resetting || !canReset) return;
    setResetError(null);
    setResetting(true);
    try {
      const res = await apiFetch("/wallet/reset", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "reset failed");
      }
      await refreshMe();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="wallet-tab">
      <div className="wallet-grid">
        <Stat label="Equity" value={fmtMoney(equity)} accent />
        <Stat label="Balance" value={fmtMoney(balance)} />
        <Stat label="Free margin" value={fmtMoney(free)} />
        <Stat label="Locked margin" value={fmtMoney(locked)} muted />
        <Stat
          label="Unrealized PnL"
          value={fmtMoney(unrealized)}
          tone={unrealized >= 0 ? "up" : "down"}
        />
        <Stat
          label="Realized today"
          value={fmtMoney(realizedToday)}
          tone={realizedToday >= 0 ? "up" : "down"}
        />
        <Stat
          label="Realized all-time"
          value={fmtMoney(realizedAll)}
          tone={realizedAll >= 0 ? "up" : "down"}
        />
        <Stat
          label={`Win rate (${tradeCount} trades)`}
          value={tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}
        />
      </div>

      <div className="wallet-reset">
        <div className="reset-text">
          <div className="reset-title">Reset balance</div>
          <div className="reset-sub">
            Restores your account to $5,000. Only available with no open positions.
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={handleReset}
          disabled={!canReset || resetting}
        >
          {resetting ? "Resetting…" : "Reset to $5,000"}
        </button>
      </div>
      {resetError && (
        <div className="form-error" style={{ margin: "8px 16px 0" }}>{resetError}</div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
  tone?: "up" | "down";
}) {
  const cls = [
    "wallet-stat",
    accent ? "accent" : "",
    muted ? "muted" : "",
    tone ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="wallet-stat-label">{label}</div>
      <div className="wallet-stat-value mono">{value}</div>
    </div>
  );
}
