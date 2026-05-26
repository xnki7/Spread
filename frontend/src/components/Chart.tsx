import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, Interval } from "../lib/api.js";

type Props = {
  symbol: string;
  interval: Interval;
  candles: Candle[];
  livePrice: number | null;
};

type OHLC = {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  volume: number;
};

const BARS_PER_24H: Record<Interval, number> = {
  "1m": 1440,
  "5m": 288,
  "1h": 24,
};

function toCandle(c: Candle): CandlestickData {
  return {
    time: Math.floor(c.bucket / 1000) as UTCTimestamp,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  };
}

function toVolume(c: Candle): HistogramData {
  const up = Number(c.close) >= Number(c.open);
  return {
    time: Math.floor(c.bucket / 1000) as UTCTimestamp,
    value: Number(c.volume),
    color: up ? "rgba(22, 199, 132, 0.35)" : "rgba(234, 57, 67, 0.35)",
  };
}

function toOHLC(c: Candle): OHLC {
  return {
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    time: c.bucket,
    volume: Number(c.volume),
  };
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatVolume(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatTime(ms: number, interval: Interval): string {
  const d = new Date(ms);
  const pad = (x: number) => x.toString().padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (interval === "1h") return `${date} ${pad(d.getHours())}:00`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Chart({ symbol, interval, candles, livePrice }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);
  const candlesByTimeRef = useRef<Map<number, OHLC>>(new Map());

  const [hovered, setHovered] = useState<OHLC | null>(null);

  const latest = useMemo<OHLC | null>(() => {
    if (candles.length === 0) return null;
    const last = candles[candles.length - 1]!;
    const base = toOHLC(last);
    if (livePrice !== null && Number.isFinite(livePrice)) {
      return {
        ...base,
        high: Math.max(base.high, livePrice),
        low: Math.min(base.low, livePrice),
        close: livePrice,
      };
    }
    return base;
  }, [candles, livePrice]);

  const display = hovered ?? latest;
  const change = display ? display.close - display.open : 0;
  const changePct = display && display.open !== 0 ? (change / display.open) * 100 : 0;
  const up = change >= 0;

  const { high24, low24 } = useMemo(() => {
    if (candles.length === 0) return { high24: null, low24: null };
    const window = candles.slice(-BARS_PER_24H[interval]);
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of window) {
      const h = Number(c.high);
      const l = Number(c.low);
      if (h > hi) hi = h;
      if (l < lo) lo = l;
    }
    return { high24: hi, low24: lo };
  }, [candles, interval]);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#111111" },
        textColor: "#a3a3a3",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(38, 38, 38, 0.55)", style: 0 },
        horzLines: { color: "rgba(38, 38, 38, 0.55)", style: 0 },
      },
      timeScale: {
        borderColor: "#1f1f1f",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
      rightPriceScale: {
        borderColor: "#1f1f1f",
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#facc15", width: 1, style: 3, labelBackgroundColor: "#facc15" },
        horzLine: { color: "#facc15", width: 1, style: 3, labelBackgroundColor: "#facc15" },
      },
      watermark: {
        visible: true,
        text: symbol || "",
        fontSize: 72,
        color: "rgba(250, 204, 21, 0.04)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontStyle: "bold",
        horzAlign: "center",
        vertAlign: "center",
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#16c784",
      downColor: "#ea3943",
      borderUpColor: "#16c784",
      borderDownColor: "#ea3943",
      wickUpColor: "#16c784",
      wickDownColor: "#ea3943",
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
      priceLineColor: "#facc15",
      priceLineWidth: 1,
      priceLineStyle: 2,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const onCrosshair = (p: MouseEventParams) => {
      if (!p.time || !p.point) {
        setHovered(null);
        return;
      }
      const ts = Number(p.time) * 1000;
      const c = candlesByTimeRef.current.get(ts);
      setHovered(c ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      highLineRef.current = null;
      lowLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      watermark: {
        visible: true,
        text: symbol || "",
        fontSize: 72,
        color: "rgba(250, 204, 21, 0.04)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontStyle: "bold",
        horzAlign: "center",
        vertAlign: "center",
      },
    });
  }, [symbol]);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;
    candleRef.current.setData(candles.map(toCandle));
    volumeRef.current.setData(candles.map(toVolume));
    const m = new Map<number, OHLC>();
    for (const c of candles) m.set(c.bucket, toOHLC(c));
    candlesByTimeRef.current = m;
    if (candles.length > 0) chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    if (highLineRef.current) {
      series.removePriceLine(highLineRef.current);
      highLineRef.current = null;
    }
    if (lowLineRef.current) {
      series.removePriceLine(lowLineRef.current);
      lowLineRef.current = null;
    }
    if (high24 !== null && low24 !== null && Number.isFinite(high24) && Number.isFinite(low24)) {
      highLineRef.current = series.createPriceLine({
        price: high24,
        color: "rgba(22, 199, 132, 0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "24h H",
      });
      lowLineRef.current = series.createPriceLine({
        price: low24,
        color: "rgba(234, 57, 67, 0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "24h L",
      });
    }
  }, [high24, low24]);

  useEffect(() => {
    if (!candleRef.current || livePrice === null || candles.length === 0) return;
    const last = candles[candles.length - 1];
    if (!last) return;
    candleRef.current.update({
      time: Math.floor(last.bucket / 1000) as UTCTimestamp,
      open: Number(last.open),
      high: Math.max(Number(last.high), livePrice),
      low: Math.min(Number(last.low), livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

  const loading = candles.length === 0;

  return (
    <div className="chart-wrap">
      <div className="chart-ohlc">
        <div className="ohlc-left">
          <span className="ohlc-sym">{symbol || "—"}</span>
          <span className="ohlc-interval">{interval}</span>
          {display && (
            <span className="ohlc-time">{formatTime(display.time, interval)}</span>
          )}
        </div>
        {display ? (
          <div className="ohlc-values">
            <span className="ohlc-pair"><span className="ohlc-k">O</span><span className={`ohlc-v ${up ? "up" : "down"}`}>{formatPrice(display.open)}</span></span>
            <span className="ohlc-pair"><span className="ohlc-k">H</span><span className={`ohlc-v ${up ? "up" : "down"}`}>{formatPrice(display.high)}</span></span>
            <span className="ohlc-pair"><span className="ohlc-k">L</span><span className={`ohlc-v ${up ? "up" : "down"}`}>{formatPrice(display.low)}</span></span>
            <span className="ohlc-pair"><span className="ohlc-k">C</span><span className={`ohlc-v ${up ? "up" : "down"}`}>{formatPrice(display.close)}</span></span>
            <span className="ohlc-pair">
              <span className={`ohlc-change ${up ? "up" : "down"}`}>
                {up ? "+" : ""}{formatPrice(change)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
              </span>
            </span>
            <span className="ohlc-pair"><span className="ohlc-k">Vol</span><span className="ohlc-v">{formatVolume(display.volume)}</span></span>
          </div>
        ) : (
          <div className="ohlc-values ohlc-empty">awaiting data…</div>
        )}
      </div>

      <div className="chart-host-wrap">
        <div ref={hostRef} className="chart-host" />
        {loading && (
          <div className="chart-loading">
            <div className="spinner" />
            <span>loading {symbol || "market"}…</span>
          </div>
        )}
      </div>
    </div>
  );
}
