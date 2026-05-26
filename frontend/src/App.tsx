import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Candle, type Interval } from "./lib/api.js";
import { useStream } from "./lib/useStream.js";
import { Chart } from "./components/Chart.js";
import { OrderForm } from "./components/OrderForm.js";

const INTERVALS: Interval[] = ["1m", "5m", "1h"];

export function App() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [interval, setInterval] = useState<Interval>("1m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    api.assets().then((s) => {
      setSymbols(s);
      if (s.length > 0 && !symbol) setSymbol(s[0]!);
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setCandles([]);
    api.candles(symbol, interval).then((c) => {
      if (!cancelled) setCandles(c);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [symbol, interval]);

  const channels = useMemo(
    () => (symbol ? [`trade:${symbol}`, `bookTicker:${symbol}`] : []),
    [symbol],
  );
  const { status, last } = useStream(channels);

  useEffect(() => {
    if (!last || last.symbol !== symbol) return;
    const next =
      last.kind === "trade"
        ? Number(last.price)
        : (Number(last.bid) + Number(last.ask)) / 2;
    if (!Number.isFinite(next)) return;
    const prev = prevPriceRef.current;
    if (prev !== null && next !== prev) setDir(next > prev ? "up" : "down");
    prevPriceRef.current = next;
    setLivePrice(next);
  }, [last, symbol]);

  return (
    <div className="app">
      <div className="topbar">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {symbols.length === 0 && <option value="">(no symbols)</option>}
          {symbols.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={interval}
          onChange={(e) => setInterval(e.target.value as Interval)}
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>

        <span className={`price ${dir ?? ""}`}>
          {livePrice !== null ? livePrice.toFixed(4) : "—"}
        </span>

        <span className="status-line">
          <span className={`dot ${status === "open" ? "ok" : "off"}`} />
          ws: {status}
        </span>
      </div>

      <div className="chart-panel">
        <Chart candles={candles} livePrice={livePrice} />
      </div>

      <OrderForm symbol={symbol} livePrice={livePrice} />
    </div>
  );
}
