import { useEffect, useRef } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../lib/api.js";

type Props = {
  candles: Candle[];
  livePrice: number | null;
};

function toSeries(candles: Candle[]): CandlestickData[] {
  return candles.map((c) => ({
    time: Math.floor(c.bucket / 1000) as UTCTimestamp,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

export function Chart({ candles, livePrice }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: { background: { color: "#131720" }, textColor: "#d6dae3" },
      grid: {
        vertLines: { color: "#1e2330" },
        horzLines: { color: "#1e2330" },
      },
      timeScale: { borderColor: "#1e2330", timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "#1e2330" },
      crosshair: { mode: 1 },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(toSeries(candles));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    if (!seriesRef.current || livePrice === null || candles.length === 0) return;
    const last = candles[candles.length - 1];
    if (!last) return;
    seriesRef.current.update({
      time: Math.floor(last.bucket / 1000) as UTCTimestamp,
      open: Number(last.open),
      high: Math.max(Number(last.high), livePrice),
      low: Math.min(Number(last.low), livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

  return <div ref={hostRef} className="chart-host" />;
}
