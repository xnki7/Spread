import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const messagesReceived = new Counter({
  name: "price_poller_messages_received_total",
  help: "Messages received from Binance, by kind",
  labelNames: ["kind"] as const,
  registers: [registry],
});

export const messagesDropped = new Counter({
  name: "price_poller_messages_dropped_total",
  help: "Messages dropped due to buffer overflow",
  labelNames: ["reason"] as const,
  registers: [registry],
});

export const parseErrors = new Counter({
  name: "price_poller_parse_errors_total",
  help: "Number of message parse errors",
  registers: [registry],
});

export const reconnects = new Counter({
  name: "price_poller_reconnects_total",
  help: "WS reconnects, by reason",
  labelNames: ["reason"] as const,
  registers: [registry],
});

export const flushDuration = new Histogram({
  name: "price_poller_flush_duration_seconds",
  help: "Time taken to flush buffer to Redis",
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

export const flushSize = new Histogram({
  name: "price_poller_flush_batch_size",
  help: "Number of events per flush",
  buckets: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry],
});

export const bufferSize = new Gauge({
  name: "price_poller_buffer_size",
  help: "Current buffered messages awaiting flush",
  registers: [registry],
});

export const wsConnected = new Gauge({
  name: "price_poller_ws_connected",
  help: "WS shard connection status (1=connected, 0=disconnected)",
  labelNames: ["shard"] as const,
  registers: [registry],
});
