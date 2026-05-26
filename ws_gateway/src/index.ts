import { logger } from "./logger.js";
import { createRedisSubscriber } from "./redis.js";
import { createHub } from "./hub.js";
import { startWsServer } from "./server.js";
import { startHttpServer } from "./server_http.js";
import { messagesReceived } from "./metrics.js";

const CHANNEL_PREFIXES = ["prices:", "events:"];

const hub = createHub();
const sub = createRedisSubscriber();
const wss = startWsServer(hub);

for (const prefix of CHANNEL_PREFIXES) {
  sub.psubscribe(`${prefix}*`, (err, count) => {
    if (err) {
      logger.fatal({ err, prefix }, "psubscribe failed");
      process.exit(1);
    }
    logger.info({ prefix, count }, "psubscribed");
  });
}

sub.on("pmessage", (_pattern, channel, message) => {
  let clientChannel = channel;
  for (const prefix of CHANNEL_PREFIXES) {
    if (channel.startsWith(prefix)) {
      clientChannel = channel.slice(prefix.length);
      break;
    }
  }
  const kind = clientChannel.split(":")[0] ?? "unknown";
  messagesReceived.inc({ kind });
  const wrapped = `{"channel":"${clientChannel}","data":${message}}`;
  hub.broadcast(clientChannel, wrapped);
});

const httpServer = startHttpServer(hub, () => sub.status === "ready");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  wss.close();
  httpServer.close();
  try {
    await sub.quit();
  } catch (err) {
    logger.error({ err }, "redis quit failed");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandled rejection");
});
