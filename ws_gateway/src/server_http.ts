import http from "node:http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { registry } from "./metrics.js";
import type { Hub } from "./hub.js";

export function startHttpServer(
  hub: Hub,
  isHealthy: () => boolean,
): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === "/health") {
        const ok = isHealthy();
        res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            status: ok ? "ok" : "unhealthy",
            clients: hub.clientCount(),
            channels: hub.channelCount(),
          }),
        );
        return;
      }
      if (req.url === "/metrics") {
        res.writeHead(200, { "content-type": registry.contentType });
        res.end(await registry.metrics());
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (err) {
      logger.error({ err, url: req.url }, "http handler error");
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  server.listen(config.HTTP_PORT, () => {
    logger.info({ port: config.HTTP_PORT }, "http server listening");
  });
  return server;
}
