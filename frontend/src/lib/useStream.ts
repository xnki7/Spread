import { useEffect, useRef, useState } from "react";
import { config } from "./config.js";
import type { StreamEvent, WsEnvelope } from "./types.js";

export type StreamStatus = "connecting" | "open" | "closed";

export type UseStream = {
  status: StreamStatus;
  last: StreamEvent | null;
};

export function useStream(channels: string[]): UseStream {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [last, setLast] = useState<StreamEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const channelsKey = channels.slice().sort().join(",");

  useEffect(() => {
    if (channels.length === 0) return;
    let cancelled = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect(): void {
      if (cancelled) return;
      setStatus("connecting");
      const ws = new WebSocket(config.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setStatus("open");
        ws.send(JSON.stringify({ type: "subscribe", channels }));
      };

      ws.onmessage = (e) => {
        try {
          const env = JSON.parse(e.data) as WsEnvelope;
          if (env.data) setLast(env.data);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setStatus("closed");
        if (cancelled) return;
        const delay = Math.min(30_000, 500 * 2 ** retry++);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsKey]);

  return { status, last };
}
