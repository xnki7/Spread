import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AccessClaims = { sub: string; sid: string };

export const tokens = {
  signAccess(userId: string, sessionId: string): string {
    return jwt.sign({ sub: userId, sid: sessionId } satisfies AccessClaims, config.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: config.ACCESS_TOKEN_TTL_SEC,
    });
  },

  verifyAccess(token: string): AccessClaims | null {
    try {
      const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
      if (typeof payload === "string") return null;
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
      return { sub: payload.sub, sid: payload.sid };
    } catch {
      return null;
    }
  },

  newRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  },

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  },
};
