import { describe, it, expect, vi } from "vitest";
import { createHub } from "../src/hub.js";

function makeWs(): { send: ReturnType<typeof vi.fn>; readyState: number } {
  return { send: vi.fn(), readyState: 1 };
}

describe("hub", () => {
  it("delivers messages only to subscribed clients", () => {
    const hub = createHub();
    const a = makeWs();
    const b = makeWs();
    hub.addClient("a", a as never);
    hub.addClient("b", b as never);
    hub.subscribe("a", ["trade:SOLUSDT"]);

    const sent = hub.broadcast("trade:SOLUSDT", "payload");

    expect(sent).toBe(1);
    expect(a.send).toHaveBeenCalledWith("payload");
    expect(b.send).not.toHaveBeenCalled();
  });

  it("fans out to multiple subscribers on the same channel", () => {
    const hub = createHub();
    const a = makeWs();
    const b = makeWs();
    hub.addClient("a", a as never);
    hub.addClient("b", b as never);
    hub.subscribe("a", ["bookTicker:BTCUSDT"]);
    hub.subscribe("b", ["bookTicker:BTCUSDT"]);

    expect(hub.broadcast("bookTicker:BTCUSDT", "x")).toBe(2);
  });

  it("skips clients whose socket is not OPEN", () => {
    const hub = createHub();
    const a = { send: vi.fn(), readyState: 3 };
    hub.addClient("a", a as never);
    hub.subscribe("a", ["trade:SOL"]);

    expect(hub.broadcast("trade:SOL", "x")).toBe(0);
    expect(a.send).not.toHaveBeenCalled();
  });

  it("unsubscribe stops delivery to that channel only", () => {
    const hub = createHub();
    const a = makeWs();
    hub.addClient("a", a as never);
    hub.subscribe("a", ["trade:SOL", "bookTicker:SOL"]);
    hub.unsubscribe("a", ["trade:SOL"]);

    expect(hub.broadcast("trade:SOL", "x")).toBe(0);
    expect(hub.broadcast("bookTicker:SOL", "y")).toBe(1);
    expect(a.send).toHaveBeenCalledTimes(1);
  });

  it("removeClient cleans up all subscriptions", () => {
    const hub = createHub();
    const a = makeWs();
    hub.addClient("a", a as never);
    hub.subscribe("a", ["c1", "c2", "c3"]);
    expect(hub.channelCount()).toBe(3);

    hub.removeClient("a");
    expect(hub.clientCount()).toBe(0);
    expect(hub.channelCount()).toBe(0);
    expect(hub.broadcast("c1", "x")).toBe(0);
  });

  it("subscribe to unknown client is a no-op", () => {
    const hub = createHub();
    hub.subscribe("ghost", ["c1"]);
    expect(hub.channelCount()).toBe(0);
  });
});
