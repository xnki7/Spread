import type { MiddlewareHandler } from "hono";
import { tokens } from "./tokens.js";

export type AuthContext = {
  Variables: { userId: string; sessionId: string };
};

export const requireAuth: MiddlewareHandler<AuthContext> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const claims = tokens.verifyAccess(header.slice(7));
  if (!claims) return c.json({ error: "unauthorized" }, 401);

  c.set("userId", claims.sub);
  c.set("sessionId", claims.sid);
  await next();
};
