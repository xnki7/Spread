import type { WebSocket } from "ws";
import { clientsConnected, messagesForwarded } from "./metrics.js";

export type Hub = {
  addClient: (id: string, ws: WebSocket) => void;
  removeClient: (id: string) => void;
  subscribe: (clientId: string, channels: string[]) => void;
  unsubscribe: (clientId: string, channels: string[]) => void;
  broadcast: (channel: string, payload: string) => number;
  clientCount: () => number;
  channelCount: () => number;
};

const WS_OPEN = 1;

export function createHub(): Hub {
  type Client = { ws: WebSocket; channels: Set<string> };
  const clients = new Map<string, Client>();
  const subscribers = new Map<string, Set<string>>();

  function addClient(id: string, ws: WebSocket): void {
    clients.set(id, { ws, channels: new Set() });
    clientsConnected.set(clients.size);
  }

  function removeClient(id: string): void {
    const client = clients.get(id);
    if (!client) return;
    for (const channel of client.channels) {
      const subs = subscribers.get(channel);
      if (!subs) continue;
      subs.delete(id);
      if (subs.size === 0) subscribers.delete(channel);
    }
    clients.delete(id);
    clientsConnected.set(clients.size);
  }

  function subscribe(clientId: string, channels: string[]): void {
    const client = clients.get(clientId);
    if (!client) return;
    for (const channel of channels) {
      client.channels.add(channel);
      let subs = subscribers.get(channel);
      if (!subs) {
        subs = new Set();
        subscribers.set(channel, subs);
      }
      subs.add(clientId);
    }
  }

  function unsubscribe(clientId: string, channels: string[]): void {
    const client = clients.get(clientId);
    if (!client) return;
    for (const channel of channels) {
      client.channels.delete(channel);
      const subs = subscribers.get(channel);
      if (!subs) continue;
      subs.delete(clientId);
      if (subs.size === 0) subscribers.delete(channel);
    }
  }

  function broadcast(channel: string, payload: string): number {
    const subs = subscribers.get(channel);
    if (!subs || subs.size === 0) return 0;
    const kind = channel.split(":")[0] ?? "unknown";
    let sent = 0;
    for (const clientId of subs) {
      const client = clients.get(clientId);
      if (!client || client.ws.readyState !== WS_OPEN) continue;
      client.ws.send(payload);
      sent++;
    }
    if (sent > 0) messagesForwarded.inc({ kind }, sent);
    return sent;
  }

  return {
    addClient,
    removeClient,
    subscribe,
    unsubscribe,
    broadcast,
    clientCount: () => clients.size,
    channelCount: () => subscribers.size,
  };
}
