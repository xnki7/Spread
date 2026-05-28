import { apiFetch } from "./auth.js";

export type Side = "long" | "short";
export type CloseReason = "manual" | "liquidation" | "take_profit" | "stop_loss";

export type OpenPosition = {
  id: string;
  symbol: string;
  side: Side;
  qty: string;
  entryPrice: string;
  leverage: number;
  margin: string;
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
  openedAt: number;
  currentPrice?: string;
  unrealizedPnl?: string;
};

export type ClosedPosition = {
  id: string;
  symbol: string;
  side: Side;
  qty: string;
  entryPrice: string;
  closePrice: string;
  leverage: number;
  margin: string;
  realizedPnl: string;
  reason: CloseReason;
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
  openedAt: number;
  closedAt: number;
};

export type OpenRequest = {
  symbol: string;
  side: Side;
  margin: number;
  leverage: number;
  takeProfitPrice?: number | null;
  stopLossPrice?: number | null;
};

export type StopsRequest = {
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
};

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? fallback);
  }
  return res.json() as Promise<T>;
}

export const positionsApi = {
  open: async (req: OpenRequest): Promise<OpenPosition> => {
    const res = await apiFetch("/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const body = await json<{ position: OpenPosition }>(res, "open failed");
    return body.position;
  },

  close: async (positionId: string): Promise<ClosedPosition> => {
    const res = await apiFetch(`/positions/${positionId}/close`, { method: "POST" });
    const body = await json<{ position: ClosedPosition }>(res, "close failed");
    return body.position;
  },

  updateStops: async (positionId: string, req: StopsRequest): Promise<OpenPosition> => {
    const res = await apiFetch(`/positions/${positionId}/stops`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const body = await json<{ position: OpenPosition }>(res, "stops update failed");
    return body.position;
  },

  list: async (): Promise<OpenPosition[]> => {
    const res = await apiFetch("/positions");
    const body = await json<{ positions: OpenPosition[] }>(res, "list failed");
    return body.positions;
  },

  history: async (limit = 50): Promise<ClosedPosition[]> => {
    const res = await apiFetch(`/positions/history?limit=${limit}`);
    const body = await json<{ positions: ClosedPosition[] }>(res, "history failed");
    return body.positions;
  },
};
