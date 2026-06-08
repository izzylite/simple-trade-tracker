# Normalized Briefing Delivery — Design

**Date:** 2026-06-09
**Status:** Approved, pending implementation plan

## Problem

The asset-research pool de-duplicated Gemini **compute** (one briefing per asset per
hour, shared). But **delivery still duplicates the content**: `storeTaskResult`
copies the full `briefing_html` + `briefing_plain` + citations + tool_calls into
**one `orion_task_results` row per user**. At 1,000 users watching EURUSD that is
1,000 copies of the same ~3 KB blob every cycle, persisting up to 365 days
(`content_html` is blanked at 30 days by a cron, but `content_plain` + the
citations/tool_calls in `metadata` linger a year).

Two consequences to fix:

1. **Storage / write amplification** — the same briefing stored N times.
2. **Error fan-out** — the outage path writes a deliverable "Data source
   unavailable" briefing. In a shared model that becomes an error card fanned out
   to every subscriber, each having to dismiss it.

## Solution Summary

Store each briefing **once** in a new immutable table `asset_research_briefings`.
Each per-user `orion_task_results` row keeps only its **envelope** (who, when,
read/dismiss state) plus a `briefing_id` FK — a "thin pointer." The frontend reads
content via a PostgREST embedded join. Errors/outages never produce a deliverable
briefing, so no error cards reach the feed.

This is the "thin pointer" level: it keeps one row per user (needed for per-user
read/dismiss state) but removes the duplicated content. The fully-virtual feed
(no per-user rows at all) was considered and deferred — it requires rewriting the
unread/notifications model and changing `frequency` semantics, a much larger blast
radius for a marginal additional win at current scale.

---

## Data Model

### New table: `asset_research_briefings` (immutable, append-only)

One row per **delivered research cycle**. Never updated after insert.

```sql
CREATE TABLE public.asset_research_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset         TEXT NOT NULL,
  content_html  TEXT NOT NULL,
  content_plain TEXT NOT NULL,
  significance  TEXT CHECK (significance IN ('low','medium','high')),
  citations     JSONB,
  tool_calls    JSONB,
  generated_at  TIMESTAMPTZ NOT NULL,          -- = pool.refreshed_at for this cycle
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_research_briefings_asset ON public.asset_research_briefings (asset, created_at DESC);
```

### `asset_research_pool` — add pointer to current snapshot

```sql
ALTER TABLE public.asset_research_pool
  ADD COLUMN current_briefing_id UUID REFERENCES public.asset_research_briefings(id);
```

`run-asset-research` sets this each time it writes a `fresh` briefing. The pool's
own `briefing_html`/`briefing_plain`/`citations`/`tool_calls` columns are now
redundant; they may stay (1 row/asset, harmless) or be dropped in a later
non-breaking migration. Keep for now.

### `orion_task_results` — becomes a thin envelope

```sql
ALTER TABLE public.orion_task_results
  ADD COLUMN briefing_id UUID REFERENCES public.asset_research_briefings(id),
  ADD COLUMN title TEXT,                         -- denormalized display title = '<asset> Market Research'
  ALTER COLUMN content_html  DROP NOT NULL,
  ALTER COLUMN content_plain DROP NOT NULL;

-- Prevent re-delivering the same briefing to the same user on a later tick.
CREATE UNIQUE INDEX uq_orion_task_results_user_briefing
  ON public.orion_task_results (user_id, briefing_id)
  WHERE briefing_id IS NOT NULL;
```

For pooled (`market_research`) deliveries: `content_html`/`content_plain` are left
NULL/`''`, `metadata` is `'{}'`, and content lives in the referenced briefing.
`significance` (existing column) is the delivery-time significance. `title`,
`significance`, `is_read`, `hidden_at`, `created_at` are all that render the
collapsed card + unread badge — no join needed for the list header.

---

## Write Path

### `run-asset-research` (on a successful `fresh` briefing)

```
1. INSERT INTO asset_research_briefings
     (asset, content_html, content_plain, significance, citations, tool_calls, generated_at)
   VALUES (...)
   RETURNING id;
2. UPDATE asset_research_pool
     SET status='fresh', refreshed_at=now(), expires_at=now()+1h,
         current_briefing_id = <id>, citations=..., tool_calls=...   -- pool content optional
   WHERE id = <pool row> AND status='processing';
```

### `dispatch-orion-tasks` Phase 2 (per due user)

```
For each fresh, unexpired pool row matching the user's subscribed_assets
AND significance >= user's min_significance:
  INSERT INTO orion_task_results
    (user_id, task_id, task_type, briefing_id, title, significance, group_date)
  VALUES (..., pool.current_briefing_id, pool.asset || ' Market Research',
          briefing.significance, ...)
  ON CONFLICT (user_id, briefing_id) DO NOTHING;   -- no re-delivery, no content copied
```

The display `title` is synthetic (`'<asset> Market Research'`) — the same value
the dispatcher already generates today; the Gemini headline stays inside
`content_html` as its `<h4>`, so the briefing table needs no title column.
`storeTaskResult`'s signature changes: it takes `briefing_id` + synthetic `title`
+ `significance` instead of the content blob. The notification it inserts uses that
`title` + a short preview from the briefing's `content_plain` (read once per cycle,
not per user).

The `ON CONFLICT DO NOTHING` guard means a user whose `next_run_at` comes due
again before the asset produces a *new* briefing is simply not re-delivered the
same one.

---

## Error & Outage Handling — no error cards

**Principle:** errors never reach the feed. The feed only ever contains real,
qualifying research.

- **Asset research failure** (exception in `run-asset-research`): pool row →
  `failed` + backoff `expires_at` (existing `markPoolFailed`). **No briefing
  snapshot, no result row, no notification.** Retries next cycle; the claim-TTL
  recovery handles a killed worker.
- **Full search outage** (all queries failed): **change** the current behavior.
  Today it writes a `significance='low'` "Data source unavailable" briefing
  (deliverable to `min_significance='low'` users). New behavior: treat it like a
  failure — mark the pool row `failed` with backoff, write **no** briefing. The
  processing sentinel clears via the `failed` status (+ claim TTL).
- **Quiet market** (a *real* `significance='low'` briefing): still delivered, but
  only to users who chose `min_significance='low'`. This is "nothing notable," not
  an error — it stays.

**Active/health visibility** replaces the informational value of the old outage
card: the task already carries a status (`active` / `disabled`) surfaced in the
Orion task UI. Add a small "last research" relative-time label next to it (e.g.
"Active · updated 8m ago"), sourced from the task's most recent
`orion_task_results.created_at`. No feed card, nothing to dismiss. Exact
copy/placement is a UI detail finalized at implementation; keep it minimal.

---

## Read Path

- **`orionTaskService.getResults`** — embed the briefing:
  ```js
  .select('*, briefing:asset_research_briefings(content_html, content_plain, significance, citations, tool_calls)')
  .eq('user_id', userId).is('hidden_at', null)
  .order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  ```
  One round trip; content nested under `result.briefing`.
- **Realtime** (`orion_task_results` inserts) — the event delivers the thin row;
  the client re-fetches that one row with the embed (or the existing list refetch)
  to resolve content. The collapsed card + unread badge render immediately from
  the denormalized `title` + `significance`.
- **`TaskResultCard`** — reads `result.briefing?.content_html` etc., falling back
  to `result.content_html` for legacy/non-pool rows (`briefing ?? inline`).
  Citations/tool_calls read from `result.briefing` (were `result.metadata`).
- **Save-as-Note** — reads content from the embedded briefing, same fallback.
- **`OrionTaskResult` type** — add `briefing_id`, `title`, optional nested
  `briefing` object; mark content fields optional.

---

## RLS

`asset_research_briefings` SELECT — a user may read a briefing **only if they hold
a result row referencing it**:

```sql
ALTER TABLE public.asset_research_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read briefings delivered to them"
  ON public.asset_research_briefings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orion_task_results r
    WHERE r.briefing_id = asset_research_briefings.id
      AND r.user_id = auth.uid()
  ));

CREATE POLICY "Service role inserts briefings"
  ON public.asset_research_briefings FOR INSERT WITH CHECK (true);
```

Backed by `uq_orion_task_results_user_briefing` (and the existing
`idx_orion_task_results_user_id`) so the EXISTS check is index-served. Chosen over
"any authenticated user reads any briefing": content is impersonal, but scoping
avoids briefing enumeration for ~zero cost, and the embed from an already-
RLS-filtered result row passes naturally.

---

## Cleanup

- Result rows: keep the existing 30-day delete cron (rows are now tiny).
- Briefings: delete when **unreferenced** (no result row points at them) — covers
  both aged-out deliveries and snapshots from cycles nobody received (suppressed /
  below-threshold). Repoint the now-moot `orion-results-strip-old-market-research`
  (content-blanking) cron to this orphan-delete instead.
  ```sql
  DELETE FROM asset_research_briefings b
  WHERE NOT EXISTS (SELECT 1 FROM orion_task_results r WHERE r.briefing_id = b.id)
    AND b.created_at < now() - INTERVAL '7 days';   -- grace window
  ```

---

## Migration / Rollout — forward-only, no backfill

Existing result rows keep their inline content; new rows use `briefing_id`. The
frontend `briefing ?? inline` fallback lets both coexist with zero backfill; old
rows age out via the 30-day TTL.

Deploy order (each step backward-compatible with the previous):
1. **Migration** — create `asset_research_briefings`, add `current_briefing_id`,
   add `briefing_id`/`title`/uniq index, RLS, cleanup cron.
2. **Backend** — `run-asset-research` (snapshot insert + pointer), `dispatch`
   Phase 2 (thin insert + ON CONFLICT), `storeTaskResult` signature, outage→failed.
3. **Frontend** — `getResults` embed, `TaskResultCard` + Save-as-Note read from
   `briefing`, types, status label.

---

## What Does NOT Change

- Gemini compute model (O(unique assets)), pool claim-TTL recovery, the dispatcher
  two-phase structure, `frequency_minutes` / `min_significance` semantics.
- The per-user `is_read` / `hidden_at` / unread-count model and its indexes.
- Other task types (none currently) — the inline-content path stays for them.

## Edge Cases

- **Suppressed / below-threshold cycle** — briefing snapshot exists but no result
  row references it → orphan-cleaned after the grace window.
- **`fetchRecentBriefings`** (dead per-user handler in `run-orion-task`) reads
  `content_plain` from result rows — now empty for pooled rows. It is dead under
  the pool dispatcher; the plan must not wire it into the live path.
- **Two users, same briefing, different read/dismiss** — preserved: state lives on
  each user's thin row, content shared.

## Testing

- DB: briefing insert + pointer; `ON CONFLICT` blocks duplicate (user, briefing);
  RLS allows owner / denies non-owner; orphan cleanup deletes unreferenced only.
- Backend: research-time snapshot created + pool pointer set; Phase 2 inserts thin
  row referencing `current_briefing_id`, copies no content; outage → `failed`, no
  briefing/row.
- Frontend: `getResults` embed shapes `result.briefing`; card + Save-as-Note read
  from briefing with inline fallback; collapsed card renders from denormalized
  `title`/`significance` without the embed.
