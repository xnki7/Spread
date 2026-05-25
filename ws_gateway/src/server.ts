import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { invalidClientMessages } from "./metrics.js";
import type { Hub } from "./hub.js";

const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    channels: z.array(z.string()).nonempty(),
  }),
  z.object({
    type: z.literal("unsubscribe"),
    channels: z.array(z.string()).nonempty(),
  }),
]);

export function startWsServer(hub: Hub): WebSocketServer {
  const wss = new WebSocketServer({ port: config.WS_PORT });

  wss.on("listening", () => {
    logger.info({ port: config.WS_PORT }, "ws server listening");
  });

  wss.on("connection", (ws) => {
    const id = randomUUID();
    let isAlive = true;
    hub.addClient(id, ws);
    logger.info({ clientId: id, total: hub.clientCount() }, "client connected");

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        logger.warn({ clientId: id }, "client unresponsive, terminating");
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, config.PING_INTERVAL_MS);

    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg = ClientMessage.parse(JSON.parse(data.toString()));
        if (msg.type === "subscribe") hub.subscribe(id, msg.channels);
        else hub.unsubscribe(id, msg.channels);
      } catch (err) {
        invalidClientMessages.inc();
        logger.warn({ err, clientId: id }, "invalid client message");
        ws.send(JSON.stringify({ error: "invalid message" }));
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      hub.removeClient(id);
      logger.info(
        { clientId: id, total: hub.clientCount() },
        "client disconnected",
      );
    });

    ws.on("error", (err) => {
      logger.warn({ err, clientId: id }, "client ws error");
    });
  });

  return wss;
}
