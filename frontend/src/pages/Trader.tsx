import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Candle, type Interval } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { useStream } from "../lib/useStream.js";
import { useToast } from "../lib/toast.js";
import type { PositionSnapshotItem } from "../lib/types.js";
import { Chart } from "../components/Chart.js";
import { OrderForm } from "../components/OrderForm.js";
import { BottomPanel } from "../components/BottomPanel.js";
import { Topbar } from "../components/Topbar.js";

export function Trader() {
  const { state, refreshMe } = useAuth();
  const toast = useToast();
  const userId = state.status === "signedIn" ? state.user.id : null;

  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [interval, setInterval] = useState<Interval>("1m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [positionsSnapshot, setPositionsSnapshot] = useState<PositionSnapshotItem[] | null>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const prevPriceRef = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  // Track positions the user closed manually (or just opened) so we don't
  // mistake them for liquidations when they vanish from the snapshot.
  const knownClosedRef = useRef<Set<string>>(new Set());
  const prevSnapshotIdsRef = useRef<Set<string>>(new Set());
  const prevPositionsRef = useRef<Map<string, PositionSnapshotItem>>(new Map());

  const markManuallyClosed = useCallback((id: string) => {
    knownClosedRef.current.add(id);
  }, []);

  useEffect(() => {
    api.assets()
      .then((s) => {
        setSymbols(s);
        if (s.length > 0 && !symbol) setSymbol(s[0]!);
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setCandles([]);
    setLivePrice(null);
    prevPriceRef.current = null;
    setDir(null);
    api.candles(symbol, interval)
      .then((c) => { if (!cancelled) setCandles(c); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [symbol, interval]);

  const channels = useMemo(() => {
    const chs: string[] = [];
    if (symbol) {
      chs.push(`trade:${symbol}`);
      chs.push(`bookTicker:${symbol}`);
    }
    if (userId) chs.push(`position:${userId}`);
    return chs;
  }, [symbol, userId]);

  const { status, last } = useStream(channels);

  useEffect(() => {
    if (!last) return;
    if (last.kind === "trade" && last.symbol === symbol) {
      const next = Number(last.price);
      if (!Number.isFinite(next)) return;
      const prev = prevPriceRef.current;
      if (prev !== null && next !== prev) setDir(next > prev ? "up" : "down");
      prevPriceRef.current = next;
      setLivePrice(next);
      return;
    }
    if (last.kind === "bookTicker" && last.symbol === symbol) {
      const next = (Number(last.bid) + Number(last.ask)) / 2;
      if (!Number.isFinite(next)) return;
      const prev = prevPriceRef.current;
      if (prev !== null && next !== prev) setDir(next > prev ? "up" : "down");
      prevPriceRef.current = next;
      setLivePrice(next);
      return;
    }
    if (last.kind === "position_snapshot" && last.userId === userId) {
      const nextIds = new Set(last.positions.map((p) => p.id));
      const prevIds = prevSnapshotIdsRef.current;
      const disappeared: PositionSnapshotItem[] = [];
      for (const id of prevIds) {
        if (!nextIds.has(id)) {
          const prev = prevPositionsRef.current.get(id);
          if (prev) disappeared.push(prev);
        }
      }
      let triggeredReload = false;
      for (const p of disappeared) {
        if (knownClosedRef.current.has(p.id)) {
          knownClosedRef.current.delete(p.id);
          continue;
        }
        // Position vanished without the user closing it → liquidation.
        toast.push({
          variant: "danger",
          title: `${p.symbol} liquidated`,
          body: `${p.side.toUpperCase()} ${p.leverage}× — margin $${Number(p.margin).toFixed(2)} wiped`,
          ttl: 8000,
        });
        triggeredReload = true;
      }
      if (triggeredReload) {
        setHistoryReloadKey((k) => k + 1);
        void refreshMe();
      }
      const nextMap = new Map<string, PositionSnapshotItem>();
      for (const p of last.positions) nextMap.set(p.id, p);
      prevPositionsRef.current = nextMap;
      prevSnapshotIdsRef.current = nextIds;
      setPositionsSnapshot(last.positions);
    }
  }, [last, symbol, userId, toast, refreshMe]);

  return (
    <div className="app">
      <Topbar
        symbols={symbols}
        symbol={symbol}
        onSymbolChange={setSymbol}
        interval={interval}
        onIntervalChange={setInterval}
        livePrice={livePrice}
        dir={dir}
        wsStatus={status}
      />
      <div className="chart-panel">
        <Chart symbol={symbol} interval={interval} candles={candles} livePrice={livePrice} />
      </div>
      <OrderForm symbol={symbol} livePrice={livePrice} />
      <div className="positions-area">
        <BottomPanel
          snapshot={positionsSnapshot}
          reloadKey={historyReloadKey}
          onChange={() => setHistoryReloadKey((k) => k + 1)}
          onManualClose={markManuallyClosed}
        />
      </div>
    </div>
  );
}

export const __markClosed = (_id: string) => {
  // Re-exported helper would go here if needed by tests
};
