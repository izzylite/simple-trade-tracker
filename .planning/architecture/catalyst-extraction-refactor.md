# Catalyst Extraction Refactor — Deferred Until Launch

**Status:** Designed, NOT implemented. Deferred to pre-launch hardening.
**Designed:** 2026-05-17
**Trigger to revisit:** Whichever hits first —
- 1 month before public launch
- User count crosses 5
- A second LLM-heavy task type is added (e.g., scheduled daily_analysis at scale)
- Gemini pricing changes by >25% in either direction

---

## The problem this solves

Today the Gemini briefing call in `run-orion-task/market-research.ts` is **per user, per sweep**. Search (Tavily/Serper) is already cached cross-user via the canonical macro-query catalog + cached instrument templates — those costs are constant regardless of user count. **The Gemini call itself is the linear-scaling cost we haven't addressed.**

The blocker for sharing a generated briefing across users is the `recentBriefings` block in the prompt — it tells Gemini what to suppress for the specific user. Two users with identical news inputs but different recent-history get different briefings. Caching the output across users would leak User A's dedup state to User B.

### Cost projection without this refactor

Assumes users on 1h cadence. Longer cadences (2h/4h/6h/24h are now selectable) scale down proportionally — a 24h-cadence user costs 1/24 of an hourly user. Real-world cost is somewhere between hourly and 6h average; numbers below are worst-case.

| Users | Gemini cost/day | Notes |
|---|---|---|
| 1 (today) | $0.66 | 24 hourly sweeps × ~$0.025 |
| 10 | $6.60 | Linear |
| 100 | $66 | Linear |
| 1,000 | $660 | Linear (~$20k/mo) |

### Cost projection with this refactor

| Users | Gemini cost/day |
|---|---|
| 1 | $1.30 (slightly worse — explicit cache storage fee) |
| 10 | $1.30 |
| 100 | ~$2 |
| 1,000 | ~$2 |
| 10,000 | ~$3 (write throughput dominates) |

**Crossover: ~2-3 users.** Below that the current architecture is cheaper. Above that the savings grow without bound.

---

## Why we deferred

- **No code rot risk.** Code that exists but isn't running tends to break silently (deps shift, schemas evolve around it). Better to write fresh against current reality at launch.
- **Gemini ecosystem changes fast.** `text-embedding-004` was deprecated 2026-01-14. New features ship monthly. Building 5 months early means re-validating assumptions at launch anyway.
- **Single-user scale doesn't need it.** Current Gemini cost at 1 user = $0.66/day. Not material until 10+ users.
- **The prerequisite work is already shipped** (catalog-driven macro queries, search caching, drain-one API key pool). When we resume, only the extraction pipeline + per-user assembly is new work.

---

## Architecture (synthesized, red-team-validated)

### Stage 1 — Shared catalyst extraction

**One Gemini 2.5 Pro call per `(news_hash, hour_bucket)`**, protected by a claim row to prevent concurrent-extraction waste.

```
Claim row in catalyst_extraction_jobs (INSERT ... ON CONFLICT DO NOTHING)
  → Race winners proceed; losers wait and re-read cache

Gemini 2.5 Pro
  - response_mime_type: "application/json"
  - response_schema: Catalyst[] with body maxLength: 600
  - affected_assets: closed enum (fiat USD/EUR/... + crypto BTC/ETH/... + equity tickers/indices)
  - explicit context cache (named, 1h, keyed by news_hash + hour_bucket)
  - temporal context at END of prompt (NOT top — would break implicit cache)

Zod validation on output → reject malformed, log to parse_failures table

Fingerprint = sha256(
  array_to_string(sort(canonical_assets), ',')
  + '||' + date_bucket(daily)
)
  ← NO title (varies)
  ← NO significance (drifts across sweeps)
  ← assets = fiat + crypto + equity tickers (see fix #4 below)

INSERT ON CONFLICT (fingerprint) DO NOTHING → cross-sweep dedup automatic

Async: embed (title + body[:500]) via gemini-embedding-001 (768d)
  Store with embedding_model_version column → future-proof against model upgrade

Cosine ≥ 0.93 against last 7d catalysts + numeric-diff guard
  ← "25bps" vs "50bps" must never collapse — CATASTROPHIC for trading product
```

### Stage 2 — Per-user delivery (NO LLM)

Sweep window matters: a user on 4h/24h cadence must fetch catalysts from
their full window, not just the current hour. App code computes the window
from `user.frequency_minutes`.

```sql
-- $1 = user_id
-- $2 = window_start (now() - user.frequency_minutes)
-- $3 = $user_assets — array of asset tags from symbolsToAssets(user.watchlist)
--      see fix #4 below: rename currencies → assets, extend enum
-- $4 = $user_min_significance_rank — integer 1=low / 2=medium / 3=high

SELECT * FROM extracted_catalysts ec
WHERE ec.created_at >= $2                             -- full sweep window, not single hour_bucket
  AND ec.expires_at > now()
  AND CASE ec.significance
        WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1
      END >= $4                                       -- integer rank, not text >= text (broken)
  AND (
    ec.affected_assets && $3
    OR cardinality(ec.affected_assets) = 0            -- market-wide
  )
  AND NOT EXISTS (
    SELECT 1 FROM catalyst_exposures ce
    WHERE ce.catalyst_id = ec.id AND ce.user_id = $1
  )
ORDER BY CASE ec.significance
           WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1
         END DESC,
         ec.created_at
LIMIT 6;
```

Then:
1. If zero rows: emit synthetic `low` "Quiet sweep — N headlines scanned, no surprises detected" catalyst (preserves transparency for `min_significance: 'low'` users)
2. Templated HTML assembly from `catalyst.body` + user's price snapshot + augmented citations
3. INSERT briefing into `orion_task_results` (existing UI path unchanged)
4. INSERT delivered catalyst IDs into `catalyst_exposures` (junction)

### Schema

```sql
CREATE TABLE extracted_catalysts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_hash               text NOT NULL,
  hour_bucket             timestamptz NOT NULL,
  title                   text NOT NULL,
  body                    text NOT NULL CHECK (char_length(body) <= 600),
  significance            text NOT NULL CHECK (significance IN ('low','medium','high')),
  affected_assets         text[] NOT NULL DEFAULT '{}',  -- closed enum: fiat (USD/EUR/...) + crypto tickers (BTC/ETH/...) + equity tickers (AAPL/^GSPC/...). See fix #4.
  affected_assets_raw     text[] NOT NULL DEFAULT '{}',  -- LLM-emitted, display only
  fingerprint             text NOT NULL UNIQUE,
  embedding               vector(768),
  embedding_model_version text,
  source_urls             text[] NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL
);
CREATE UNIQUE INDEX ON extracted_catalysts (news_hash, hour_bucket);
CREATE INDEX ON extracted_catalysts USING hnsw (embedding vector_cosine_ops)
  WHERE expires_at > now() - interval '7 days';

CREATE TABLE catalyst_extraction_jobs (
  news_hash     text NOT NULL,
  hour_bucket   timestamptz NOT NULL,
  state         text NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress','done','failed')),
  attempt_count int  NOT NULL DEFAULT 1,
  next_retry_at timestamptz,
  claimed_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_hash, hour_bucket)
);

CREATE TABLE catalyst_exposures (
  catalyst_id uuid NOT NULL REFERENCES extracted_catalysts(id) ON DELETE CASCADE,
  user_id     text NOT NULL,  -- NOT FK — survive GDPR account deletion for audit
  task_id     uuid REFERENCES orion_tasks(id) ON DELETE SET NULL,
  exposed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (catalyst_id, user_id)
);
CREATE INDEX ON catalyst_exposures (user_id, exposed_at DESC);
```

---

## Frozen decisions (made 2026-05-17)

1. **No per-user LLM in v1 hot path.** Templated assembly only. Schema reserves a `polished_body` column for future Flash polish if templates feel too rigid.
2. **Cosine threshold = 0.93 + mandatory numeric-diff guard.** Single threshold, debuggable. Numeric guard non-negotiable.
3. **Synthetic "quiet sweep" catalyst** on empty extraction. Preserves transparency for `min_significance: 'low'` users.
4. **Aggressive single-cutover, no shadow phase.** Single-user (or low-user) launch doesn't need 7-day A/B. Feature flag in env (`ORION_USE_CATALYST_PIPELINE=true|false`) is the rollback.
5. **`user_id` as `text` (no FK)** on `catalyst_exposures` — survives account deletion for audit trail.

---

## Critical red-team fixes to NOT forget

The full red-team review found 15 failure modes. The catastrophic ones the implementation MUST address:

1. **Drop title from fingerprint.** Gemini emits varying titles — `"Fed Holds Rates"` vs `"Fed holds rates."` break UNIQUE constraint silently. Use currencies + date bucket only.
2. **Cosine 0.93 + numeric guard.** `"25bps"` vs `"50bps"` at 0.88 cosine collapses → wrong magnitude in briefing → CATASTROPHIC for a trading product.
3. **Concurrent extraction claim** via `catalyst_extraction_jobs` table. Without it, 100 users firing at same instant all start Gemini extraction simultaneously → cost spike + UNIQUE constraint storm in logs.
4. **`news_hash = sha256(sorted unique URLs only)`.** Including snippets/dates makes cache key vary trivially → cache hit rate craters silently from 95% → 30%.
5. **Implicit caching is fragile — use EXPLICIT caching.** `buildTemporalContext()` currently sits at TOP of user prompt with ms-precision timestamps → would void implicit cache hits. Use explicit named cache keyed on `(news_hash, hour_bucket)`.
6. **`affected_assets` MUST be closed enum.** Free-form LLM output (`"EUR/USD"` vs `"EURUSD"` vs `"euro dollar"`) breaks intersection filter silently → users miss legitimate catalysts. Enum covers fiat + crypto + equity tickers; see Q1 below.
7. **Drop significance from fingerprint, compute at delivery.** Same news graded differently across sweeps → same catalyst stored twice → user's threshold filter flips inconsistently.
8. **Zod validate before insert.** `response_schema` enforces shape, not semantics. Bad rows must be rejected + logged, not silently NULL-poisoning.
9. **Expires-filtered HNSW search.** Use partial index `WHERE expires_at > now() - interval '7 days'` to avoid returning expired catalysts via embedding similarity.
10. **`embedding_model_version` column.** When gemini-embedding-001 → -002 happens, cosine distances become incomparable. Filter by version; backfill on upgrade.

Full red-team output preserved in conversation history from 2026-05-17 design session.

---

## Open design questions (resolve during Phase 1, before writing code)

These were caught in the final pre-defer review but deliberately left open
because resolution depends on whether other parts of the product have
shifted by launch time.

### Q1 — Asset enum scope

`affected_assets` is a closed enum. Initial population: USD/EUR/GBP/JPY/CHF/AUD/NZD/CAD/CNH (fiat) + BTC/ETH/SOL/BNB/XRP/ADA/DOGE/AVAX/LINK/LTC (crypto from YAHOO_SYMBOL_CATALOG) + key equity tickers/indices (AAPL/MSFT/NVDA/TSLA/^GSPC/^IXIC/^DJI/^VIX) + commodity tickers (GC=F/SI=F/CL=F/BZ=F/NG=F/HG=F).

**Map symbol → asset tag(s):** extend `symbolsToCurrencies` in `supabase/functions/run-orion-task/symbols.ts` to a new `symbolsToAssets` that returns both fiat AND asset ticker (e.g., `BTC-USD` → `['BTC', 'USD']`, not just `['USD']` like today). Otherwise crypto-only users hit no catalysts.

**Catalog seeding sub-task:** add `affected_assets` tagging to entries in `public.macro_query_catalog` so we know which catalysts a given canonical macro query is expected to surface. Useful for diagnostic alerts ("query X has produced zero catalysts in 30d — drop or fix?").

### Q2 — Breaking news (Serper qdr:h) integration

Current architecture: breaking content uses Serper with 2-min TTL (separate from Tavily 1h catalyst path). Decision needed:

**Option A — Breaking bypasses catalyst extractor.** Breaking results inject directly into briefing alongside catalyst list. Pro: preserves sub-minute freshness. Con: no cross-user dedup on breaking content; each user pays for the breaking-content portion of their briefing (small fraction of Gemini call).

**Option B — Breaking goes through catalyst extractor at higher cadence.** Run a separate "breaking catalyst extractor" every 5 min, write to same `extracted_catalysts` table with a `source: 'breaking'` column. Pro: full dedup + cross-user share. Con: 12× more extraction calls/hour for breaking alone.

Recommend A for v1. Revisit if breaking-content latency becomes a real cost driver.

### Q3 — Existing-user transition at toggle-on

Single user (you) today. At toggle-on, your existing `orion_task_results` rows contain prose, not catalyst IDs. Options:

**Option A — Fresh start.** Toggle on, your first post-toggle sweep treats everything as new. You may see catalysts about events that were already covered in the last prose briefing. One-time UX glitch; resolves after 1 sweep.

**Option B — Backfill exposures via LLM extraction.** Run catalyst extractor over the last N prose briefings, register the extracted catalysts as `catalyst_exposures` for you. Clean transition but adds Gemini calls during the migration.

Recommend A for single-user case. For multi-user launch, decide based on user count at toggle time.

### Q4 — Failed-extraction retry mechanism

`catalyst_extraction_jobs.next_retry_at` is in the schema but no description of who advances failed jobs. Options:

**Option A — Dispatcher retry.** `dispatch-orion-tasks` checks for `state='failed' AND next_retry_at <= now()` on each 5-min tick; re-claims and re-fires. Same pattern as task scheduling.

**Option B — Separate sweep job.** pg_cron job every 5 min checks for failed/stuck jobs.

Recommend A — reuses existing dispatcher infrastructure. State machine: `in_progress` (claim) → `done` (success) → `failed` (Gemini error or Zod reject; backoff schedule like `[5m, 30m, 2h]`).

### Q5 — Cron staleness for long-cadence users

A user on 24h cadence sweeps once per day. With 1h cache TTL, their sweep window catalysts may include older entries that have already been cleaned up (catalysts have 30-day `expires_at` so this is fine for 24h) BUT they may also miss catalysts that briefly existed mid-day if the daily extraction failed and was re-fired later. Mitigate via Q4's retry logic — failed extractions should fully complete before catalysts are considered "missed."

---

## Implementation plan (when triggered)

**Phase 1 — Foundation (1-2 days):**
- DB migration: `extracted_catalysts`, `catalyst_extraction_jobs`, `catalyst_exposures`, asset enum
- Resolve Q1 (asset enum scope) + Q2 (breaking news integration) + Q3 (existing-user transition) + Q4 (retry mechanism) — they need answers before writing extraction code
- Extend `symbolsToCurrencies` → `symbolsToAssets` in `supabase/functions/run-orion-task/symbols.ts` (also referenced by current market-research code; extension must be backward-compatible)
- pg_cron cleanup job (30-day TTL on catalysts; cascade clears exposures)
- Add `affected_assets text[]` tagging to `public.macro_query_catalog` entries (catalog-level diagnostic — which queries should produce which asset-tagged catalysts)

**Phase 2 — Extraction pipeline (3-4 days):**
- New file: `supabase/functions/run-orion-task/catalyst-extractor.ts`
- Claim → Gemini Pro with explicit context cache + structured output → Zod → fingerprint → embedding (async) → cosine dedup
- Prompt engineering: convert current "write briefing" prompt to "extract catalysts as JSON" — this is the highest-risk piece, iterate with real news bundles

**Phase 3 — Per-user delivery (2 days):**
- New file: `supabase/functions/run-orion-task/briefing-assembler.ts`
- SQL filter query above + templated HTML rendering
- Synthetic quiet-sweep catalyst path

**Phase 4 — Toggle wiring + cutover (1 day):**
- Feature flag check at top of `handleMarketResearch`
- Default `ORION_USE_CATALYST_PIPELINE=false` until launch
- At launch: set env var to true
- Old prose-generation path remains in function bundle for ~30 days as rollback

**Phase 5 — Seeding integration (1 day):**
- At task creation in `orionTaskService.createTask`: query recent matching catalysts, INSERT into `catalyst_exposures` so new users skip already-shown catalysts on their first sweep

**Total: ~1-2 weeks focused work.**

---

## What's already shipped (prerequisites complete)

- `public.macro_query_catalog` table (2026-05-17 migration) — canonical query strings shared across users
- Catalog-driven UI with auto-prune + starter pack
- `searchNewsMultipleCached` for instrument queries (1h TTL, cross-user)
- `NEWS_CACHE_TTL_SECONDS = 3600` aligned with min cadence (60 min)
- Sub-hourly (15/30 min) cron removed; minimum supported cadence is 60 min
- Multi-cadence support: 60/120/180/240/360/1440 min options live in UI + types — Stage 2 SQL must respect user's sweep window, not single hour_bucket (see Stage 2 query above)
- API key pool with drain-one-at-a-time selection
- `compute_orion_task_next_run_at` defaults aligned to 60 min minimum

When we resume, none of the above needs revisiting — they're the foundation the catalyst extraction sits on.

---

## References

- Design session: 2026-05-17 (4-agent brainstorm + red-team)
- Prior memory: `[[api-key-pool-drain-one-at-a-time]]`, `[[search-provider-cost]]`
- Current Gemini docs: https://ai.google.dev/gemini-api/docs/caching (verify at launch)
- daily.dev Project Sauron (industry reference for shared-inference + per-user dedup pattern): https://daily.dev/blog/project-sauron-building-a-two-tower-retrieval-model-for-personalized-recommendations-at-daily-dev
