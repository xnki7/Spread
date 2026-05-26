import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Candle, type Interval } from "../lib/api.js";
import { useStream } from "../lib/useStream.js";
import { Chart } from "../components/Chart.js";
import { OrderForm } from "../components/OrderForm.js";
import { Topbar } from "../components/Topbar.js";

export function Trader() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [interval, setInterval] = useState<Interval>("1m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

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
    </div>
  );
}
