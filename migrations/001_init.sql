CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS trades (
    ts             TIMESTAMPTZ      NOT NULL,
    symbol         TEXT             NOT NULL,
    trade_id       BIGINT           NOT NULL,
    price          NUMERIC(20, 8)   NOT NULL,
    qty            NUMERIC(20, 8)   NOT NULL,
    buyer_is_maker BOOLEAN          NOT NULL,
    PRIMARY KEY (symbol, trade_id, ts)
);

SELECT create_hypertable(
    'trades',
    'ts',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists       => TRUE
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_ts ON trades (symbol, ts DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', ts) AS bucket,
    symbol,
    first(price, ts) AS open,
    max(price)       AS high,
    min(price)       AS low,
    last(price, ts)  AS close,
    sum(qty)         AS volume,
    count(*)         AS trade_count
FROM trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'trades_1m',
    start_offset      => INTERVAL '2 hours',
    end_offset        => INTERVAL '1 minute',
    schedule_interval => INTERVAL '30 seconds',
    if_not_exists     => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', ts) AS bucket,
    symbol,
    first(price, ts) AS open,
    max(price)       AS high,
    min(price)       AS low,
    last(price, ts)  AS close,
    sum(qty)         AS volume,
    count(*)         AS trade_count
FROM trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'trades_5m',
    start_offset      => INTERVAL '6 hours',
    end_offset        => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists     => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', ts) AS bucket,
    symbol,
    first(price, ts) AS open,
    max(price)       AS high,
    min(price)       AS low,
    last(price, ts)  AS close,
    sum(qty)         AS volume,
    count(*)         AS trade_count
FROM trades
GROUP BY bucket, symbol
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'trades_1h',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists     => TRUE
);

ALTER TABLE trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby   = 'ts DESC'
);

SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('trades', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('trades_1m', INTERVAL '1 year', if_not_exists => TRUE);
