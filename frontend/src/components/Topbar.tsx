import type { Interval } from "../lib/api.js";
import type { StreamStatus } from "../lib/useStream.js";
import { useAuth } from "../lib/auth.js";
import { Brand } from "./Brand.js";

type Props = {
  symbols: string[];
  symbol: string;
  onSymbolChange: (s: string) => void;
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
  livePrice: number | null;
  dir: "up" | "down" | null;
  wsStatus: StreamStatus;
};

const INTERVALS: Interval[] = ["1m", "5m", "1h"];

export function Topbar({
  symbols,
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  livePrice,
  dir,
  wsStatus,
}: Props) {
  const { state, logout } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  const wallet = state.status === "signedIn" ? state.wallet : null;
  const priceClass = dir ?? "neutral";

  return (
    <header className="topbar">
      <div className="left">
        <Brand size="sm" />
        <div className="divider-v" />

        <select
          className="symbol-select"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
        >
          {symbols.length === 0 && <option value="">(no symbols)</option>}
          {symbols.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="interval-group">
          {INTERVALS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIntervalChange(i)}
              className={interval === i ? "active" : ""}
            >
              {i}
            </button>
          ))}
        </div>

        <span className={`live-price ${priceClass}`}>
          {livePrice !== null ? livePrice.toFixed(4) : "—"}
        </span>

        <div className="ws-status">
          <span className={`dot ${wsStatus === "open" ? "ok" : ""}`} />
          {wsStatus}
        </div>
      </div>

      <div className="right">
        {user && wallet && (
          <div className="wallet-chip">
            <span className="email">{user.email}</span>
            <span className="balance">${Number(wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        <button type="button" className="icon-btn danger" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </header>
  );
}
