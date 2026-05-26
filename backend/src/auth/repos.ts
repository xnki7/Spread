import type postgres from "postgres";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
};

export type Wallet = {
  user_id: string;
  balance: string;
  locked_margin: string;
};

export type Session = {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
};

export type UsersRepo = {
  create: (email: string, passwordHash: string) => Promise<User>;
  findByEmail: (email: string) => Promise<User | null>;
  findById: (id: string) => Promise<User | null>;
};

export type WalletsRepo = {
  findByUserId: (userId: string) => Promise<Wallet | null>;
};

export type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  replacedById?: string;
};

export type SessionsRepo = {
  create: (input: CreateSessionInput) => Promise<Session>;
  findByHash: (hash: string) => Promise<Session | null>;
  revoke: (id: string, replacedById?: string) => Promise<void>;
  revokeAllForUser: (userId: string) => Promise<void>;
};

export function createUsersRepo(sql: postgres.Sql): UsersRepo {
  return {
    create: async (email, passwordHash) => {
      const rows = await sql<User[]>`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id, email, password_hash, created_at
      `;
      return rows[0]!;
    },
    findByEmail: async (email) => {
      const rows = await sql<User[]>`
        SELECT id, email, password_hash, created_at FROM users WHERE email = ${email}
      `;
      return rows[0] ?? null;
    },
    findById: async (id) => {
      const rows = await sql<User[]>`
        SELECT id, email, password_hash, created_at FROM users WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },
  };
}

export function createWalletsRepo(sql: postgres.Sql): WalletsRepo {
  return {
    findByUserId: async (userId) => {
      const rows = await sql<Wallet[]>`
        SELECT user_id, balance::text, locked_margin::text FROM wallets WHERE user_id = ${userId}
      `;
      return rows[0] ?? null;
    },
  };
}

export function createSessionsRepo(sql: postgres.Sql): SessionsRepo {
  return {
    create: async ({ userId, refreshTokenHash, expiresAt, ip, userAgent, replacedById }) => {
      const rows = await sql<Session[]>`
        INSERT INTO sessions (user_id, refresh_token_hash, expires_at, ip, user_agent, replaced_by_id)
        VALUES (${userId}, ${refreshTokenHash}, ${expiresAt}, ${ip ?? null}, ${userAgent ?? null}, ${replacedById ?? null})
        RETURNING id, user_id, refresh_token_hash, expires_at, revoked_at, replaced_by_id
      `;
      return rows[0]!;
    },
    findByHash: async (hash) => {
      const rows = await sql<Session[]>`
        SELECT id, user_id, refresh_token_hash, expires_at, revoked_at, replaced_by_id
        FROM sessions WHERE refresh_token_hash = ${hash}
      `;
      return rows[0] ?? null;
    },
    revoke: async (id, replacedById) => {
      await sql`
        UPDATE sessions
        SET revoked_at = now(),
            replaced_by_id = ${replacedById ?? null}
        WHERE id = ${id} AND revoked_at IS NULL
      `;
    },
    revokeAllForUser: async (userId) => {
      await sql`
        UPDATE sessions
        SET revoked_at = now()
        WHERE user_id = ${userId} AND revoked_at IS NULL
      `;
    },
  };
}
