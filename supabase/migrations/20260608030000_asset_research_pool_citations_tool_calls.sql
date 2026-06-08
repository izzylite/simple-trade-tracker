-- Asset-research pool: carry Sources + tools-used attribution.
--
-- The per-user market_research handler used to populate metadata.citations
-- (a "Sources" pill) and metadata.tool_calls (an "N tools used" chip) on each
-- result card. The asset-pool refactor dropped both because the shared runner
-- had nowhere to store them. Add them to the pool row so run-asset-research can
-- compute them once per asset and the dispatcher's delivery phase can copy them
-- into every subscriber's result metadata.
ALTER TABLE asset_research_pool
  ADD COLUMN IF NOT EXISTS citations  JSONB,
  ADD COLUMN IF NOT EXISTS tool_calls JSONB;
