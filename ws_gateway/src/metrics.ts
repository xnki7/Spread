import {
  Counter,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const clientsConnected = new Gauge({
  name: "ws_gateway_clients_connected",
  help: "Current number of WS clients connected",
  registers: [registry],
});

export const messagesReceived = new Counter({
  name: "ws_gateway_messages_received_total",
  help: "Messages received from Redis pub/sub",
  labelNames: ["kind"] as const,
  registers: [registry],
});

export const messagesForwarded = new Counter({
  name: "ws_gateway_messages_forwarded_total",
  help: "Messages forwarded to WS clients",
  labelNames: ["kind"] as const,
  registers: [registry],
});

export const invalidClientMessages = new Counter({
  name: "ws_gateway_invalid_client_messages_total",
  help: "Invalid messages received from clients",
  registers: [registry],
});

export const redisConnected = new Gauge({
  name: "ws_gateway_redis_connected",
  help: "Redis subscriber connection status (1=connected, 0=not)",
  registers: [registry],
});
