-- 0001 — cost precision (see docs/design/0005-reliability-and-money-math.md)
--
-- proxy_sessions.total_cost was numeric(10,4). The gateway updates it with
-- `total_cost = total_cost + <request cost>`, and Postgres rounds the result to
-- the column scale on every write, so any request cheaper than $0.00005 was
-- recorded as $0 and requests between $0.00005 and $0.0001 were recorded as
-- $0.0001. Widening both precision and scale is lossless for existing rows.
--
-- Safe to run more than once. Rewrites both tables; run off-peak on large logs.

BEGIN;
ALTER TABLE proxy_sessions ALTER COLUMN total_cost     TYPE numeric(18,8);
ALTER TABLE proxy_logs     ALTER COLUMN estimated_cost TYPE numeric(14,8);
COMMIT;

-- Recommended: rebuild each session's running total from its request log, which
-- was always stored at 6 decimals. Budget counters re-seed from total_cost, so
-- an under-recorded total would let sessions overspend their caps.
UPDATE proxy_sessions s
   SET total_cost = COALESCE((SELECT SUM(l.estimated_cost) FROM proxy_logs l WHERE l.session_id = s.id), 0);
