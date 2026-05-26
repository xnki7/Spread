import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AssetsRepo, CandlesRepo } from "../src/repos.js";
import type {
  Session,
  SessionsRepo,
  User,
  UsersRepo,
  WalletsRepo,
} from "../src/auth/repos.js";
import { password } from "../src/auth/password.js";
import { tokens } from "../src/auth/tokens.js";

type Stores = {
  users: Map<string, User>;
  sessions: Map<string, Session>;
};

function makeStores(): Stores {
  return { users: new Map(), sessions: new Map() };
}

function makeAuthRepos(stores: Stores): {
  users: UsersRepo;
  wallets: WalletsRepo;
  sessions: SessionsRepo;
} {
  let userSeq = 0;
  let sessionSeq = 0;

  return {
    users: {
      create: async (email, password_hash) => {
        const id = `u${++userSeq}`;
        const user: User = { id, email, password_hash, created_at: new Date() };
        stores.users.set(id, user);
        return user;
      },
      findByEmail: async (email) => {
        for (const u of stores.users.values()) if (u.email === email) return u;
        return null;
      },
      findById: async (id) => stores.users.get(id) ?? null,
    },
    wallets: {
      findByUserId: async (userId) =>
        stores.users.has(userId)
          ? { user_id: userId, balance: "5000.00000000", locked_margin: "0.00000000" }
          : null,
    },
    sessions: {
      create: async ({ userId, refreshTokenHash, expiresAt, replacedById }) => {
        const id = `s${++sessionSeq}`;
        const session: Session = {
          id,
          user_id: userId,
          refresh_token_hash: refreshTokenHash,
          expires_at: expiresAt,
          revoked_at: null,
          replaced_by_id: replacedById ?? null,
        };
        stores.sessions.set(id, session);
        return session;
      },
      findByHash: async (hash) => {
        for (const s of stores.sessions.values())
          if (s.refresh_token_hash === hash) return s;
        return null;
      },
      revoke: async (id, replacedById) => {
        const s = stores.sessions.get(id);
        if (!s || s.revoked_at) return;
        s.revoked_at = new Date();
        if (replacedById) s.replaced_by_id = replacedById;
      },
      revokeAllForUser: async (userId) => {
        for (const s of stores.sessions.values()) {
          if (s.user_id === userId && !s.revoked_at) s.revoked_at = new Date();
        }
      },
    },
  };
}

function makeApp(stores: Stores) {
  const candles: CandlesRepo = { fetch: vi.fn().mockResolvedValue([]) };
  const assets: AssetsRepo = { list: vi.fn().mockResolvedValue([]) };
  return createApp({
    candles,
    assets,
    auth: makeAuthRepos(stores),
    positions: {
      service: {
        open: vi.fn(),
        close: vi.fn(),
        closeAt: vi.fn(),
        listOpen: vi.fn().mockResolvedValue([]),
        listHistory: vi.fn().mockResolvedValue([]),
      },
      prices: {
        set: vi.fn(),
        get: vi.fn().mockReturnValue(null),
        getOrFetch: vi.fn().mockResolvedValue(null),
      },
      engine: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        onPositionOpened: vi.fn(),
        onPositionClosed: vi.fn(),
        broadcastSnapshot: vi.fn().mockResolvedValue(undefined),
      },
    },
  });
}

function refreshCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const m = setCookie.match(/spread_refresh=([^;]+)/);
  return m?.[1] ?? null;
}

describe("auth: signup", () => {
  let stores: Stores;
  beforeEach(() => {
    stores = makeStores();
  });

  it("creates a user, returns access token + refresh cookie", async () => {
    const app = makeApp(stores);
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accessToken: string; user: { email: string } };
    expect(body.user.email).toBe("a@b.com");
    expect(tokens.verifyAccess(body.accessToken)).not.toBeNull();
    expect(refreshCookie(res)).toBeTruthy();
    expect(stores.users.size).toBe(1);
    expect(stores.sessions.size).toBe(1);
  });

  it("rejects duplicate email", async () => {
    const app = makeApp(stores);
    const body = JSON.stringify({ email: "a@b.com", password: "supersecret" });
    const init = { method: "POST", headers: { "content-type": "application/json" }, body };
    await app.request("/auth/signup", init);
    const res = await app.request("/auth/signup", init);
    expect(res.status).toBe(409);
  });

  it("rejects short password", async () => {
    const app = makeApp(stores);
    const res = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("auth: login", () => {
  it("succeeds with correct password", async () => {
    const stores = makeStores();
    stores.users.set("u1", {
      id: "u1",
      email: "a@b.com",
      password_hash: await password.hash("supersecret"),
      created_at: new Date(),
    });
    const app = makeApp(stores);
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const stores = makeStores();
    stores.users.set("u1", {
      id: "u1",
      email: "a@b.com",
      password_hash: await password.hash("supersecret"),
      created_at: new Date(),
    });
    const app = makeApp(stores);
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unknown email", async () => {
    const app = makeApp(makeStores());
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nope@b.com", password: "supersecret" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("auth: /me", () => {
  it("rejects missing token", async () => {
    const res = await makeApp(makeStores()).request("/me");
    expect(res.status).toBe(401);
  });

  it("returns user + wallet with valid token", async () => {
    const stores = makeStores();
    const app = makeApp(stores);
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    const { accessToken } = (await signup.json()) as { accessToken: string };

    const res = await app.request("/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { email: string };
      wallet: { balance: string };
    };
    expect(body.user.email).toBe("a@b.com");
    expect(body.wallet.balance).toBe("5000.00000000");
  });

  it("rejects garbage token", async () => {
    const res = await makeApp(makeStores()).request("/me", {
      headers: { authorization: "Bearer notatoken" },
    });
    expect(res.status).toBe(401);
  });
});

describe("auth: refresh + rotation", () => {
  it("issues a new access token and rotates the refresh cookie", async () => {
    const stores = makeStores();
    const app = makeApp(stores);
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    const refresh1 = refreshCookie(signup)!;

    const res = await app.request("/auth/refresh", {
      method: "POST",
      headers: { cookie: `spread_refresh=${refresh1}` },
    });
    expect(res.status).toBe(200);
    const refresh2 = refreshCookie(res);
    expect(refresh2).toBeTruthy();
    expect(refresh2).not.toBe(refresh1);
    expect(stores.sessions.size).toBe(2);
  });

  it("detects refresh-token reuse and nukes all sessions", async () => {
    const stores = makeStores();
    const app = makeApp(stores);
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    const stolen = refreshCookie(signup)!;

    await app.request("/auth/refresh", {
      method: "POST",
      headers: { cookie: `spread_refresh=${stolen}` },
    });
    // attacker tries the same (now revoked) cookie
    const replay = await app.request("/auth/refresh", {
      method: "POST",
      headers: { cookie: `spread_refresh=${stolen}` },
    });
    expect(replay.status).toBe(401);
    // every session for this user should now be revoked
    for (const s of stores.sessions.values()) expect(s.revoked_at).not.toBeNull();
  });

  it("rejects missing refresh cookie", async () => {
    const res = await makeApp(makeStores()).request("/auth/refresh", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

describe("auth: logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const stores = makeStores();
    const app = makeApp(stores);
    const signup = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "supersecret" }),
    });
    const cookie = refreshCookie(signup)!;
    const res = await app.request("/auth/logout", {
      method: "POST",
      headers: { cookie: `spread_refresh=${cookie}` },
    });
    expect(res.status).toBe(200);
    for (const s of stores.sessions.values()) expect(s.revoked_at).not.toBeNull();
    // subsequent refresh must fail
    const after = await app.request("/auth/refresh", {
      method: "POST",
      headers: { cookie: `spread_refresh=${cookie}` },
    });
    expect(after.status).toBe(401);
  });
});
