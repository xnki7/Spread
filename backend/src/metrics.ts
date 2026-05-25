import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const requestsTotal = new Counter({
  name: "backend_requests_total",
  help: "HTTP requests by method, route, and status",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const requestDuration = new Histogram({
  name: "backend_request_duration_seconds",
  help: "Request duration",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});
