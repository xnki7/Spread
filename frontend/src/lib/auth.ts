import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { config } from "./config.js";

export type User = { id: string; email: string };
export type Wallet = { balance: string; lockedMargin: string };
type AuthPayload = { accessToken: string; user: User; wallet: Wallet | null };

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "signedIn"; user: User; wallet: Wallet | null };

type AuthContextValue = {
  state: AuthState;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthCtx = createContext<AuthContextValue | null>(null);

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let onAuthCleared: (() => void) | null = null;

async function rawRefresh(): Promise<string | null> {
  const res = await fetch(`${config.apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

function refreshOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = rawRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const opts: RequestInit = { ...init, headers, credentials: "include" };

  let res = await fetch(`${config.apiUrl}${path}`, opts);
  if (res.status !== 401) return res;

  const fresh = await refreshOnce();
  if (!fresh) {
    accessToken = null;
    onAuthCleared?.();
    return res;
  }

  accessToken = fresh;
  headers.set("authorization", `Bearer ${fresh}`);
  res = await fetch(`${config.apiUrl}${path}`, { ...init, headers, credentials: "include" });
  return res;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof json.error === "string" ? json.error : `${path} → ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearAuth = useCallback(() => {
    accessToken = null;
    if (mountedRef.current) setState({ status: "anonymous" });
  }, []);

  useEffect(() => {
    onAuthCleared = clearAuth;
    return () => {
      onAuthCleared = null;
    };
  }, [clearAuth]);

  const refreshMe = useCallback(async () => {
    const res = await apiFetch("/me");
    if (!res.ok) {
      clearAuth();
      return;
    }
    const body = (await res.json()) as { user: User; wallet: Wallet | null };
    setState({ status: "signedIn", user: body.user, wallet: body.wallet });
  }, [clearAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fresh = await refreshOnce();
      if (cancelled) return;
      if (!fresh) {
        setState({ status: "anonymous" });
        return;
      }
      accessToken = fresh;
      await refreshMe();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const signup = useCallback(async (email: string, password: string) => {
    const body = await postJson<AuthPayload>("/auth/signup", { email, password });
    accessToken = body.accessToken;
    setState({ status: "signedIn", user: body.user, wallet: body.wallet });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const body = await postJson<AuthPayload>("/auth/login", { email, password });
    accessToken = body.accessToken;
    setState({ status: "signedIn", user: body.user, wallet: body.wallet });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${config.apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network error — clear local state anyway
    }
    clearAuth();
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signup, login, logout, refreshMe }),
    [state, signup, login, logout, refreshMe],
  );

  return createElement(AuthCtx.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
