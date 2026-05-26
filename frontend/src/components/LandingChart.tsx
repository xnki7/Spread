import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

const BUCKET_SEC = 60;
const HISTORY = 80;
const START_PRICE = 67_500;

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function newWalk(): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const start = now - HISTORY * BUCKET_SEC;
  let price = START_PRICE;

  for (let i = 0; i < HISTORY; i++) {
    const time = (start + i * BUCKET_SEC) as UTCTimestamp;
    const drift = (Math.random() - 0.48) * price * 0.004;
    const open = price;
    const close = price + drift;
    const wick = Math.abs(drift) * (1 + Math.random());
    const high = Math.max(open, close) + Math.random() * wick;
    const low = Math.min(open, close) - Math.random() * wick;
    const volume = 80 + Math.random() * 220;
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

export function LandingChart() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const [price, setPrice] = useState(START_PRICE);
  const [change24h, setChange24h] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#737373",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(38, 38, 38, 0.35)" },
        horzLines: { color: "rgba(38, 38, 38, 0.35)" },
      },
      timeScale: {
        borderColor: "transparent",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "transparent",
        scaleMargins: { top: 0.1, bottom: 0.28 },
      },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#16c784",
      downColor: "#ea3943",
      borderUpColor: "#16c784",
      borderDownColor: "#ea3943",
      wickUpColor: "#16c784",
      wickDownColor: "#ea3943",
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const data = newWalk();
    candlesRef.current = data;
    candleSeries.setData(data.map(({ volume: _v, ...c }) => c as CandlestickData));
    volumeSeries.setData(
      data.map(
        (c): HistogramData => ({
          time: c.time,
          value: c.volume,
          color:
            c.close >= c.open
              ? "rgba(22, 199, 132, 0.35)"
              : "rgba(234, 57, 67, 0.35)",
        }),
      ),
    );
    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    setPrice(data[data.length - 1]!.close);
    const opening = data[Math.max(0, data.length - 24)]!.open;
    setChange24h(((data[data.length - 1]!.close - opening) / opening) * 100);

    let ticks = 0;
    const id = window.setInterval(() => {
      const arr = candlesRef.current;
      const last = arr[arr.length - 1];
      if (!last || !candleRef.current || !volumeRef.current) return;

      ticks += 1;
      const drift = (Math.random() - 0.5) * last.close * 0.0015;
      const newClose = last.close + drift;
      const next: Candle = {
        ...last,
        close: newClose,
        high: Math.max(last.high, newClose),
        low: Math.min(last.low, newClose),
        volume: last.volume + Math.random() * 8,
      };
      arr[arr.length - 1] = next;

      candleRef.current.update({
        time: next.time,
        open: next.open,
        high: next.high,
        low: next.low,
        close: next.close,
      });
      volumeRef.current.update({
        time: next.time,
        value: next.volume,
        color:
          next.close >= next.open
            ? "rgba(22, 199, 132, 0.35)"
            : "rgba(234, 57, 67, 0.35)",
      });

      setPrice(newClose);
      const opening = arr[Math.max(0, arr.length - 24)]!.open;
      setChange24h(((newClose - opening) / opening) * 100);

      // every 8 ticks, finalize and add a new candle
      if (ticks % 8 === 0) {
        const time = (next.time + BUCKET_SEC) as UTCTimestamp;
        const open = next.close;
        const fresh: Candle = {
          time,
          open,
          high: open,
          low: open,
          close: open,
          volume: 60 + Math.random() * 80,
        };
        arr.push(fresh);
        if (arr.length > HISTORY + 40) arr.shift();
        candleRef.current.update({
          time: fresh.time,
          open: fresh.open,
          high: fresh.high,
          low: fresh.low,
          close: fresh.close,
        });
        volumeRef.current.update({
          time: fresh.time,
          value: fresh.volume,
          color: "rgba(22, 199, 132, 0.35)",
        });
      }
    }, 700);

    return () => {
      window.clearInterval(id);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  const up = change24h >= 0;

  return (
    <div className="demo-chart">
      <div className="demo-chart-header">
        <div>
          <div className="demo-chart-symbol">BTC<span>USDT</span></div>
          <div className={`demo-chart-price ${up ? "up" : "down"}`}>
            ${price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span className="demo-chart-change">
              {up ? "▲" : "▼"} {up ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="demo-chart-live">
          <span className="live-pulse" />
          LIVE
        </div>
      </div>
      <div className="demo-chart-host" ref={hostRef} />
    </div>
  );
}
