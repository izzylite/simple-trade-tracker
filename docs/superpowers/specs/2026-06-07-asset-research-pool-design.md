# Asset Research Pool — Shared Market Research Design

**Date:** 2026-06-07
**Status:** Approved, pending implementation

## Problem

Market research (Orion tasks) currently makes one Gemini call per user per sweep. Cost is O(users × active assets). At 1,000 users all watching EURUSD, that is 1,000 identical Gemini calls per hour. Search is already cached cross-user via `searchNewsMultipleCached`; only the briefing generation is per-user.

## Solution Summary

Shift dispatch from user-centric to asset-centric. One Gemini call per active asset per refresh cycle (default 1h). All subscribers read the shared result. Gemini cost becomes O(unique active assets), independent of user count. User delivery remains O(users) but is pure SQL — no LLM.

## Approach: Asset-Pool Dispatch (Hybrid)

Keep `orion_tasks` for user preferences (frequency, significance, subscribed assets). Strip task config to just those fields — no macro query picker. Add `asset_research_pool` as the shared Gemini output layer. Redesign only the dispatcher internals; task infrastructure, result storage, and notification delivery are preserved.

---

## Data Model

### New table: `asset_research_pool`

Shared Gemini output, one active row per asset.

```sql
CREATE TABLE asset_research_pool (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'fresh' | 'failed'
  refreshed_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,                        -- refreshed_at + 1h when fresh
  briefing_html  TEXT,
  briefing_plain TEXT,
  significance   TEXT,                            -- 'low'|'medium'|'high'|'critical'
  queries_used   TEXT[],                          -- audit log
  error_detail   TEXT,                            -- populated on failure
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per asset, ever (upserted in place)
CREATE UNIQUE INDEX asset_research_pool_asset ON asset_research_pool (asset);
```

`processing` status acts as a concurrency sentinel — the dispatcher upserts `status='processing'` using `ON CONFLICT (asset) DO NOTHING`, so only one tick can claim an asset per cycle.

One row per asset, ever — the runner updates it in place (processing → fresh or failed). No row accumulation.

Failed rows use exponential backoff: `expires_at = now() + interval '15 minutes'` on first failure, doubling up to 2h max.

### New table: `asset_macro_queries`

Fixed queries per asset, seeded from `macro_query_catalog` via migration. Admin-editable without a code deploy.

```sql
CREATE TABLE asset_macro_queries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset         TEXT NOT NULL,      -- broker format: 'EURUSD', 'XAUUSD', 'BTCUSD'
  query         TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX asset_macro_queries_asset ON asset_macro_queries (asset) WHERE is_enabled = true;
```

**Seeding logic:** For each asset in `instrumentCatalog`, collect all `macro_query_catalog` entries where:
- `is_market_wide = true` AND the asset's market class is in `markets` (universal entries like Fed FOMC → every forex pair)
- OR the asset's Yahoo Finance symbol is in `symbols` (asset-specific entries)

A symbol mapping table in the migration handles the format difference between broker symbols (`EURUSD`) and Yahoo Finance symbols (`EURUSD=X`, `GC=F`, `BTC-USD`).

### `orion_tasks.config` changes (market_research type)

| Field | Before | After |
|---|---|---|
| `macro_queries` | `string[]` — user-selected queries | **Removed** |
| `watchlist_symbols` | `string[]` — Yahoo Finance symbols | **Removed** |
| `subscribed_assets` | — | `string[]` — broker symbols e.g. `["EURUSD","XAUUSD"]` |
| `frequency_minutes` | kept | kept |
| `min_significance` | kept | kept |

`orion_task_results` is unchanged — delivery still writes a result row per user task, populated from pool data.

---

## Dispatcher Redesign (`dispatch-orion-tasks`)

The dispatcher runs every 5 minutes via pg_cron. It gains a two-phase structure.

### Phase 1 — Asset refresh

Runs first, once per tick.

```
1. Collect distinct active assets:
   SELECT DISTINCT jsonb_array_elements_text(config->'subscribed_assets') AS asset
   FROM orion_tasks
   WHERE type = 'market_research' AND status = 'active'

2. For each unique asset:
   a. Check asset_research_pool:
      - Row exists with status='fresh' AND expires_at > now() → SKIP (already fresh)
      - Row exists with status='processing' → SKIP (in flight)
      - Row exists with status='failed' AND expires_at > now() → SKIP (backoff)
      - Otherwise → proceed to b

   b. INSERT sentinel row (status='processing') using ON CONFLICT DO NOTHING
      - If insert returns 0 rows → another tick claimed it, SKIP
      - If insert succeeds → fire run-orion-task with { type: 'asset_research', asset }
```

### Phase 2 — User delivery

Runs after Phase 1 completes.

```
1. Find tasks due: next_notify_at <= now() AND type='market_research' AND status='active'

2. For each task:
   a. Check pool for each asset in config.subscribed_assets
      WHERE status='fresh' AND expires_at > now()

   b. For each subscribed asset with fresh research AND significance >= task.min_significance:
      → Write one orion_task_results row per qualifying asset (briefing_html/plain copied from pool)
      → Users see separate result cards per asset, not one combined card

   c. Advance next_notify_at by frequency_minutes regardless of whether cards were written
      (If all assets are below threshold or no fresh results: next_notify_at advances but no cards — same as current suppression behavior)
```

**Cost at scale:**
- 1,000 users watching EURUSD → 1 Gemini call, 1,000 SQL writes
- 10 unique assets across all users → max 10 Gemini calls per hour

---

## Asset Research Runner (`run-orion-task`, new `asset_research` type)

```
1. Fetch fixed queries: SELECT query FROM asset_macro_queries
   WHERE asset = $asset AND is_enabled = true ORDER BY display_order

2. Fetch economic events for the asset's currencies (reuse existing getCurrenciesForInstrument)

3. Run searches via searchNewsMultipleCached (existing Tavily/Serper stack, unchanged)

4. Single Gemini call with asset-centric system prompt:
   "Provide a market briefing for [ASSET]. What are the key drivers and catalysts
    right now? Focus on price-relevant developments only."
   No user context, no portfolio mentions, no trade references.

5. Upsert into asset_research_pool:
   UPDATE asset_research_pool SET
     status = 'fresh',
     refreshed_at = now(),
     expires_at = now() + interval '1 hour',
     briefing_html = $html,
     briefing_plain = $plain,
     significance = $significance,
     queries_used = $queries
   WHERE asset = $asset AND status = 'processing'
```

**On failure:** set `status = 'failed'`, `error_detail = $message`, `expires_at = now() + backoff_interval`. Delivery phase skips failed rows automatically via the sentinel check.

**If all searches return empty:** write a `significance='low'` result so the pool row exists and the processing sentinel is cleared. Users with `min_significance` above `'low'` will have this suppressed at delivery; no user gets stuck waiting for a result that never comes.

---

## Frontend Changes

### `MarketResearchSettingsPanel`

- **Remove:** macro query picker, market selector, symbol selector (all driven by `macro_queries` + `watchlist_symbols`)
- **Add:** asset multi-select grouped by class (Forex / Commodities / Crypto / Indices), sourced from `instrumentCatalog.ts`
- **Keep:** frequency slider, significance threshold — unchanged

### Files removed

- `src/features/orion/services/macroQueryCatalogService.ts`
- `src/features/orion/data/macroQueryCatalog.ts` (type helpers + filter logic)
- Macro query picker component(s) inside `MarketResearchSettingsPanel`

---

## Migration Path

Three steps, deployed in order.

### Step 1 — DB migrations (non-breaking, deploy first)

1. Create `asset_research_pool` table
2. Create `asset_macro_queries` table
3. Seed `asset_macro_queries` from `macro_query_catalog` using market→asset mapping + Yahoo↔broker symbol map
4. Data migration on `orion_tasks`: for each market_research task, map `watchlist_symbols` → `subscribed_assets` (broker format), drop `macro_queries` and `watchlist_symbols` from config

### Step 2 — Backend (deploy together)

1. Update `dispatch-orion-tasks`: add Phase 1 (asset refresh) before Phase 2 (user delivery)
2. Add `asset_research` execution path in `run-orion-task/market-research.ts`
3. Remove old per-user Gemini path (or gate behind `subscribed_assets` check)

### Step 3 — Frontend

1. Swap macro query picker for asset multi-select in `MarketResearchSettingsPanel`
2. Remove `macroQueryCatalogService.ts` and data helpers
3. Update task display card to show "Watching: EURUSD, XAUUSD" instead of query list

### `macro_query_catalog`

Table and RLS stay in place — not read at runtime after this change, but kept as the source of truth for query content. Formally deprecate after migration is confirmed stable.

---

## What Does NOT Change

- `orion_task_results` table — same schema, same delivery mechanism
- `dispatch-orion-tasks` scheduling (every 5 min via pg_cron)
- `advance_orion_tasks_next_run_at()` RPC
- `searchNewsMultipleCached` search layer
- Significance threshold enforcement (per-user, at delivery time)
- `orion_tasks` status lifecycle (active / paused / etc.)
- Other task types (daily_analysis etc.) — only market_research is affected

---

## Cost Model

| Users watching same asset | Gemini calls/hour (before) | Gemini calls/hour (after) |
|---|---|---|
| 1 | 1 | 1 |
| 10 | 10 | 1 |
| 100 | 100 | 1 |
| 1,000 | 1,000 | 1 |

Cost per hour scales with **unique active assets**, not users. At 10 watched assets across 1,000 users: 10 Gemini calls/hour regardless of user count.
