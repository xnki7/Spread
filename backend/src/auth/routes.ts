import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { password } from "./password.js";
import { tokens } from "./tokens.js";
import type { SessionsRepo, UsersRepo, WalletsRepo } from "./repos.js";

const REFRESH_COOKIE = "spread_refresh";

const Credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export type AuthDeps = {
  users: UsersRepo;
  wallets: WalletsRepo;
  sessions: SessionsRepo;
};

function cookieOptions(): Parameters<typeof setCookie>[3] {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "Lax",
    path: "/auth",
    maxAge: config.REFRESH_TOKEN_TTL_SEC,
    domain: config.COOKIE_DOMAIN,
  };
}

async function issueSession(
  deps: AuthDeps,
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  replacedById?: string,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const refreshToken = tokens.newRefreshToken();
  const refreshTokenHash = tokens.hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_SEC * 1000);

  const session = await deps.sessions.create({
    userId,
    refreshTokenHash,
    expiresAt,
    ip,
    userAgent,
    replacedById,
  });

  const accessToken = tokens.signAccess(userId, session.id);
  return { accessToken, refreshToken, sessionId: session.id };
}

export function createAuthRoutes(deps: AuthDeps): Hono {
  const app = new Hono();

  app.post("/signup", zValidator("json", Credentials), async (c) => {
    const { email, password: pw } = c.req.valid("json");
    const existing = await deps.users.findByEmail(email);
    if (existing) return c.json({ error: "email already in use" }, 409);

    const hash = await password.hash(pw);
    const user = await deps.users.create(email, hash);

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ua = c.req.header("user-agent");
    const { accessToken, refreshToken } = await issueSession(deps, user.id, ip, ua);
    setCookie(c, REFRESH_COOKIE, refreshToken, cookieOptions());

    const wallet = await deps.wallets.findByUserId(user.id);
    return c.json(
      {
        accessToken,
        user: { id: user.id, email: user.email },
        wallet: wallet
          ? { balance: wallet.balance, lockedMargin: wallet.locked_margin }
          : null,
      },
      201,
    );
  });

  app.post("/login", zValidator("json", Credentials), async (c) => {
    const { email, password: pw } = c.req.valid("json");
    const user = await deps.users.findByEmail(email);
    // constant-ish time: always run bcrypt verify even on missing user
    const dummy = "$2b$12$........................................................";
    const ok = user
      ? await password.verify(pw, user.password_hash)
      : (await password.verify(pw, dummy), false);
    if (!user || !ok) return c.json({ error: "invalid credentials" }, 401);

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ua = c.req.header("user-agent");
    const { accessToken, refreshToken } = await issueSession(deps, user.id, ip, ua);
    setCookie(c, REFRESH_COOKIE, refreshToken, cookieOptions());

    const wallet = await deps.wallets.findByUserId(user.id);
    return c.json({
      accessToken,
      user: { id: user.id, email: user.email },
      wallet: wallet
        ? { balance: wallet.balance, lockedMargin: wallet.locked_margin }
        : null,
    });
  });

  app.post("/refresh", async (c) => {
    const presented = getCookie(c, REFRESH_COOKIE);
    if (!presented) return c.json({ error: "no refresh token" }, 401);

    const presentedHash = tokens.hashRefreshToken(presented);
    const session = await deps.sessions.findByHash(presentedHash);
    if (!session) {
      deleteCookie(c, REFRESH_COOKIE, cookieOptions());
      return c.json({ error: "invalid refresh token" }, 401);
    }

    // Reuse detection: token previously revoked → assume theft, nuke all sessions.
    if (session.revoked_at !== null) {
      logger.warn(
        { userId: session.user_id, sessionId: session.id },
        "refresh token reuse detected — revoking all sessions",
      );
      await deps.sessions.revokeAllForUser(session.user_id);
      deleteCookie(c, REFRESH_COOKIE, cookieOptions());
      return c.json({ error: "session compromised" }, 401);
    }

    if (session.expires_at.getTime() < Date.now()) {
      await deps.sessions.revoke(session.id);
      deleteCookie(c, REFRESH_COOKIE, cookieOptions());
      return c.json({ error: "session expired" }, 401);
    }

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ua = c.req.header("user-agent");
    const issued = await issueSession(deps, session.user_id, ip, ua);
    await deps.sessions.revoke(session.id, issued.sessionId);
    setCookie(c, REFRESH_COOKIE, issued.refreshToken, cookieOptions());

    return c.json({ accessToken: issued.accessToken });
  });

  app.post("/logout", async (c) => {
    const presented = getCookie(c, REFRESH_COOKIE);
    if (presented) {
      const session = await deps.sessions.findByHash(tokens.hashRefreshToken(presented));
      if (session && session.revoked_at === null) await deps.sessions.revoke(session.id);
    }
    deleteCookie(c, REFRESH_COOKIE, cookieOptions());
    return c.json({ ok: true });
  });

  return app;
}
