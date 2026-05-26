-- Auth: sessions table for refresh-token rotation.
-- Refresh tokens are opaque random strings; only their SHA-256 hash is stored.
-- Every refresh produces a new row, and the old one is marked replaced_by.
-- That chain lets us detect token reuse (= theft) and revoke everything.

CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  replaced_by_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  ip                  TEXT,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx           ON sessions (user_id);
CREATE INDEX sessions_token_hash_idx     ON sessions (refresh_token_hash);
CREATE INDEX sessions_active_user_idx    ON sessions (user_id) WHERE revoked_at IS NULL;
