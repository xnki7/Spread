-- Take-profit and stop-loss orders attached to open positions.
-- Stops are absolute price levels checked by the engine on every tick.
-- A long takes profit ABOVE entry and stops out BELOW; a short is the mirror.
-- When a stop fires, the position closes with the corresponding close_reason.

ALTER TABLE positions
  ADD COLUMN take_profit_price NUMERIC(20, 8),
  ADD COLUMN stop_loss_price   NUMERIC(20, 8),
  ADD CONSTRAINT positions_tp_positive CHECK (take_profit_price IS NULL OR take_profit_price > 0),
  ADD CONSTRAINT positions_sl_positive CHECK (stop_loss_price   IS NULL OR stop_loss_price   > 0),
  ADD CONSTRAINT positions_stops_sided CHECK (
    (side = 'long'  AND (take_profit_price IS NULL OR take_profit_price > entry_price)
                    AND (stop_loss_price   IS NULL OR stop_loss_price   < entry_price))
    OR
    (side = 'short' AND (take_profit_price IS NULL OR take_profit_price < entry_price)
                    AND (stop_loss_price   IS NULL OR stop_loss_price   > entry_price))
  );

ALTER TYPE close_reason ADD VALUE IF NOT EXISTS 'take_profit';
ALTER TYPE close_reason ADD VALUE IF NOT EXISTS 'stop_loss';

-- History keeps the configured stop levels (NULL if none) for audit / UI.
ALTER TABLE position_history
  ADD COLUMN take_profit_price NUMERIC(20, 8),
  ADD COLUMN stop_loss_price   NUMERIC(20, 8);
