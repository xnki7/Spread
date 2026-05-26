-- Trading / CFD paper-trading schema.
-- Money is NUMERIC(20,8) everywhere — never floats.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- users
-- --------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- wallets — one row per user; created automatically on user insert.
--   balance       = total paper $ the user has
--   locked_margin = how much of that is tied up in open positions
--   free          = balance - locked_margin (computed in queries)
-- --------------------------------------------------------------------------
CREATE TABLE wallets (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance        NUMERIC(20, 8) NOT NULL DEFAULT 5000,
  locked_margin  NUMERIC(20, 8) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (balance >= 0),
  CHECK (locked_margin >= 0),
  CHECK (locked_margin <= balance)
);

CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_create_wallet
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_wallet_for_user();

-- --------------------------------------------------------------------------
-- positions — open bets only. On close, row is moved to position_history.
-- --------------------------------------------------------------------------
CREATE TYPE position_side AS ENUM ('long', 'short');

CREATE TABLE positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  side        position_side NOT NULL,
  qty         NUMERIC(20, 8) NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  leverage    INTEGER NOT NULL,
  margin      NUMERIC(20, 8) NOT NULL,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (qty > 0),
  CHECK (entry_price > 0),
  CHECK (leverage BETWEEN 1 AND 100),
  CHECK (margin > 0)
);

CREATE INDEX positions_user_symbol_idx ON positions (user_id, symbol);
CREATE INDEX positions_symbol_idx      ON positions (symbol);

-- --------------------------------------------------------------------------
-- position_history — closed positions; the receipt.
-- --------------------------------------------------------------------------
CREATE TYPE close_reason AS ENUM ('manual', 'liquidation');

CREATE TABLE position_history (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  side          position_side NOT NULL,
  qty           NUMERIC(20, 8) NOT NULL,
  entry_price   NUMERIC(20, 8) NOT NULL,
  close_price   NUMERIC(20, 8) NOT NULL,
  leverage      INTEGER NOT NULL,
  margin        NUMERIC(20, 8) NOT NULL,
  realized_pnl  NUMERIC(20, 8) NOT NULL,
  reason        close_reason NOT NULL,
  opened_at     TIMESTAMPTZ NOT NULL,
  closed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX position_history_user_closed_idx
  ON position_history (user_id, closed_at DESC);
