-- ============================================================
-- Replace the 30-day blanket DELETE on orion_task_results with a tiered
-- cleanup that keeps Orion's queryable history alive while still bounding
-- storage growth from the high-frequency market_research stream.
--
-- Why this exists: get_recent_orion_briefings now exposes instrument and
-- date-range filters, so older briefings have real answer-value
-- ("what did you say about EUR around the March ECB hike?"). The previous
-- 30-day blanket DELETE killed that history.
--
-- Volume context: market_research fires every 15-30min; daily/weekly/monthly
-- task types are sparse and don't move the storage needle. Only
-- market_research is age-trimmed.
--
-- Tier transitions for market_research rows (other task types: kept
-- indefinitely):
--   0-30 days   : full row, visible in the UI feed
--   30-365 days : hidden_at set (removed from UI feed) + content_html
--                 stripped to free storage. content_plain + metadata stay
--                 so Orion can still summarise old briefings.
--   365+ days   : hard delete.
-- ============================================================

-- Drop the old blanket-DELETE cron (idempotent — returns false if absent)
SELECT cron.unschedule('cleanup-orion-task-results');

-- Tier 1 -> Tier 2: hide and strip HTML for old market_research briefings.
-- Idempotent: rows already stripped (content_html='') are not re-touched.
SELECT cron.schedule(
  'orion-results-strip-old-market-research',
  '0 3 * * *',
  $$UPDATE public.orion_task_results
       SET content_html = '',
           hidden_at = COALESCE(hidden_at, NOW())
     WHERE task_type = 'market_research'
       AND created_at < NOW() - INTERVAL '30 days'
       AND content_html <> '';$$
);

-- Tier 2 -> deleted: hard delete year-old market_research briefings.
-- Offset by 15 minutes from the strip job to avoid lock contention on the
-- same rows (the strip job touches 30-365d rows, this job 365d+).
SELECT cron.schedule(
  'orion-results-delete-ancient-market-research',
  '15 3 * * *',
  $$DELETE FROM public.orion_task_results
     WHERE task_type = 'market_research'
       AND created_at < NOW() - INTERVAL '365 days';$$
);

COMMENT ON TABLE public.orion_task_results IS
  'Stored outputs from Orion task executions. market_research briefings are '
  'visible 0-30d, stripped+hidden 30-365d (still Orion-queryable via '
  'content_plain), and deleted 365d+. Other task types kept indefinitely.';
