import WebSocket, { type RawData } from "ws";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  messagesReceived,
  parseErrors,
  reconnects,
  wsConnected,
} from "./metrics.js";
import { parseStreamMessage, type StreamEvent } from "./schemas.js";

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export type BinanceShard = {
  start: () => void;
  stop: () => void;
  isConnected: () => boolean;
};

export function createBinanceShard(
  shardId: number,
  symbols: string[],
  onEvent: (event: StreamEvent) => void,
): BinanceShard {
  let ws: WebSocket | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let shuttingDown = false;
  let lastMessageAt = Date.now();
  let watchdog: NodeJS.Timeout | null = null;
  let maxAgeTimer: NodeJS.Timeout | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function buildUrl(): string {
    const streams = symbols.flatMap((s) => {
      const sym = s.toLowerCase();
      return [`${sym}@bookTicker`, `${sym}@trade`];
    });
    return `${config.BINANCE_WS_URL}?streams=${streams.join("/")}`;
  }

  function stopWatchdog(): void {
    if (watchdog) {
      clearInterval(watchdog);
      watchdog = null;
    }
  }

  function startWatchdog(): void {
    stopWatchdog();
    const interval = Math.max(
      5_000,
      Math.floor(config.STALENESS_TIMEOUT_MS / 2),
    );
    watchdog = setInterval(() => {
      const idle = Date.now() - lastMessageAt;
      if (idle > config.STALENESS_TIMEOUT_MS) {
        logger.warn({ shardId, idleMs: idle }, "ws stale, forcing reconnect");
        reconnects.inc({ reason: "stale" });
        ws?.terminate();
      }
    }, interval);
  }

  function cancelMaxAgeRotation(): void {
    if (maxAgeTimer) {
      clearTimeout(maxAgeTimer);
      maxAgeTimer = null;
    }
  }

  function scheduleMaxAgeRotation(): void {
    cancelMaxAgeRotation();
    maxAgeTimer = setTimeout(() => {
      logger.info({ shardId }, "rotating ws connection (max age reached)");
      reconnects.inc({ reason: "max_age" });
      ws?.close(1000, "max age");
    }, config.CONNECTION_MAX_AGE_MS);
  }

  function clearTimers(): void {
    stopWatchdog();
    cancelMaxAgeRotation();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function handleMessage(raw: RawData): void {
    lastMessageAt = Date.now();
    try {
      const event = parseStreamMessage(JSON.parse(raw.toString()), Date.now());
      if (!event) return;
      messagesReceived.inc({ kind: event.kind });
      onEvent(event);
    } catch (err) {
      parseErrors.inc();
      logger.error({ err, shardId }, "parse error");
    }
  }

  function scheduleReconnect(): void {
    if (shuttingDown) return;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    logger.info({ shardId, delay }, "scheduling reconnect");
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect(): void {
    if (shuttingDown) return;
    const url = buildUrl();
    logger.info(
      { shardId, symbols: symbols.length },
      "connecting binance ws",
    );
    wsConnected.set({ shard: String(shardId) }, 0);
    ws = new WebSocket(url);

    ws.on("open", () => {
      logger.info({ shardId }, "binance ws open");
      backoffMs = INITIAL_BACKOFF_MS;
      lastMessageAt = Date.now();
      wsConnected.set({ shard: String(shardId) }, 1);
      startWatchdog();
      scheduleMaxAgeRotation();
    });

    ws.on("message", (raw) => handleMessage(raw));

    ws.on("close", (code, reason) => {
      wsConnected.set({ shard: String(shardId) }, 0);
      clearTimers();
      logger.warn(
        { shardId, code, reason: reason.toString() },
        "binance ws closed",
      );
      reconnects.inc({ reason: "close" });
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.error({ shardId, err }, "binance ws error");
    });
  }

  return {
    start: () => connect(),
    stop: () => {
      shuttingDown = true;
      clearTimers();
      ws?.close();
    },
    isConnected: () => ws?.readyState === WebSocket.OPEN,
  };
}

export function shardSymbols(symbols: string[], shardSize: number): string[][] {
  if (shardSize <= 0) throw new Error("shardSize must be positive");
  const shards: string[][] = [];
  for (let i = 0; i < symbols.length; i += shardSize) {
    shards.push(symbols.slice(i, i + shardSize));
  }
  return shards;
}
