# Normalized Briefing Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store each asset-research briefing once in an immutable table and have per-user result rows reference it by FK, eliminating per-subscriber content duplication; never deliver error cards.

**Architecture:** New immutable `asset_research_briefings` (one row per delivered research cycle). `run-asset-research` inserts the snapshot and points `asset_research_pool.current_briefing_id` at it. `dispatch-orion-tasks` Phase 2 inserts a thin `orion_task_results` row (per-user envelope + `briefing_id`, no content) with an `ON CONFLICT (user_id, briefing_id) DO NOTHING` guard. The frontend reads content via a PostgREST embedded join, falling back to inline content for legacy rows. Outages/failures produce no briefing, so no error cards reach the shared audience. Forward-only — no backfill.

**Tech Stack:** Supabase Postgres (migrations + RLS + pg_cron), Deno edge functions (`run-asset-research`, `dispatch-orion-tasks`, `_shared/storeTaskResult.ts`), React + TypeScript + MUI (`orionTaskService`, `TaskResultCard`, `useOrionTasks`), Jest + React Testing Library, `deno test`.

**Spec:** `docs/superpowers/specs/2026-06-09-normalized-briefing-delivery-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260609120000_normalized_briefing_delivery.sql` — briefings table + RLS, `pool.current_briefing_id`, `orion_task_results` columns + unique index, orphan-cleanup cron.
- `supabase/functions/_shared/__tests__/storeTaskResult.thin.test.ts` — deno test for the thin-row payload builder.
- `src/features/orion/services/__tests__/orionTaskService.embed.test.ts` — Jest test for the embed select + briefing fallback shaping.

**Modify:**
- `supabase/functions/run-asset-research/index.ts` — insert briefing snapshot + set pointer (success); outage → `markPoolFailed` (no briefing).
- `supabase/functions/_shared/storeTaskResult.ts` — `storeTaskResult` takes `briefing_id` + `title` + `significance` (+ `preview`) instead of content; notification preview passed in.
- `supabase/functions/dispatch-orion-tasks/index.ts` — Phase 2 fetches `current_briefing_id` + briefing significance/plain, inserts thin row `ON CONFLICT DO NOTHING`.
- `src/features/orion/types/orionTask.ts` — `OrionTaskResult` gains `briefing_id`, `title`, optional nested `briefing`; content fields optional.
- `src/features/orion/services/orionTaskService.ts` — `getResults` embeds the briefing; add `getBriefing(id)`.
- `src/features/orion/components/orionTasks/TaskResultCard.tsx` — read content + citations/tool_calls from `result.briefing` with inline fallback.
- `src/features/orion/hooks/useOrionTasks.ts` — realtime INSERT resolves the briefing for the new row; UPDATE merges without dropping the loaded briefing.
- `src/features/orion/components/orionTasks/<task header component>` — small "updated Xm ago" label (locate during Task 7).

**Deploy order (each backward-compatible):** migration → backend (`run-asset-research`, `dispatch-orion-tasks`) → frontend.

---

## Task 1: DB migration — briefings table, pointer, thin envelope, RLS, cleanup

**Files:**
- Create: `supabase/migrations/20260609120000_normalized_briefing_delivery.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Normalized briefing delivery: store each briefing once, reference per-user.

-- 1. Immutable shared briefing snapshots (one row per delivered research cycle).
CREATE TABLE public.asset_research_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset         TEXT NOT NULL,
  content_html  TEXT NOT NULL,
  content_plain TEXT NOT NULL,
  significance  TEXT CHECK (significance IN ('low','medium','high')),
  citations     JSONB,
  tool_calls    JSONB,
  generated_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_research_briefings_asset
  ON public.asset_research_briefings (asset, created_at DESC);

-- 2. Pool points at the current snapshot.
ALTER TABLE public.asset_research_pool
  ADD COLUMN current_briefing_id UUID REFERENCES public.asset_research_briefings(id);

-- 3. Result rows become thin envelopes.
ALTER TABLE public.orion_task_results
  ADD COLUMN briefing_id UUID REFERENCES public.asset_research_briefings(id),
  ADD COLUMN title TEXT;
ALTER TABLE public.orion_task_results
  ALTER COLUMN content_html  DROP NOT NULL,
  ALTER COLUMN content_plain DROP NOT NULL;

-- One delivery per (user, briefing): a later due-tick never re-delivers the same briefing.
CREATE UNIQUE INDEX uq_orion_task_results_user_briefing
  ON public.orion_task_results (user_id, briefing_id)
  WHERE briefing_id IS NOT NULL;

-- 4. RLS: a user reads a briefing only if they hold a result referencing it.
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

-- 5. Cleanup: delete briefings nothing references (aged out, or below-threshold
--    cycles nobody received). Replaces the content-blanking strip cron.
SELECT cron.unschedule('orion-results-strip-old-market-research')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orion-results-strip-old-market-research');

SELECT cron.schedule(
  'orion-briefings-delete-orphaned',
  '0 3 * * *',
  $$DELETE FROM public.asset_research_briefings b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.orion_task_results r WHERE r.briefing_id = b.id
    )
    AND b.created_at < now() - INTERVAL '7 days';$$
);
```

- [ ] **Step 2: Apply and verify schema**

Apply via the Supabase MCP `apply_migration` (name `normalized_briefing_delivery`). Then verify columns + index exist:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='orion_task_results' AND column_name IN ('briefing_id','title');
-- Expected: briefing_id, title
SELECT indexname FROM pg_indexes WHERE indexname='uq_orion_task_results_user_briefing';
-- Expected: one row
```

- [ ] **Step 3: Verify the dedup guard**

```sql
-- Seed a briefing + a fake task/user reference is unnecessary; test the unique index directly.
INSERT INTO public.asset_research_briefings (asset, content_html, content_plain, significance, generated_at)
VALUES ('TESTX','<p>x</p>','x','high', now()) RETURNING id;  -- note <bid>

-- Two inserts with the same (user_id, briefing_id) — second must be a no-op via ON CONFLICT.
-- Use any existing user_id + task_id from orion_tasks; if none, skip to deno integration in Task 4.
INSERT INTO public.orion_task_results (user_id, task_id, task_type, briefing_id, title, significance, group_date)
SELECT user_id, id, 'market_research', '<bid>', 'TESTX Market Research', 'high', CURRENT_DATE
FROM public.orion_tasks WHERE task_type='market_research' LIMIT 1
ON CONFLICT (user_id, briefing_id) DO NOTHING;
-- Run twice: second affects 0 rows. Then clean up:
DELETE FROM public.orion_task_results WHERE briefing_id='<bid>';
DELETE FROM public.asset_research_briefings WHERE id='<bid>';
```
Expected: second insert reports `INSERT 0 0`.

- [ ] **Step 4: Verify RLS allow/deny**

```sql
-- Owner sees it; non-owner does not. Simulate auth.uid() via request.jwt.claims.
-- (Run inside a transaction; rollback after.)
BEGIN;
INSERT INTO public.asset_research_briefings (id, asset, content_html, content_plain, significance, generated_at)
VALUES ('00000000-0000-0000-0000-0000000000aa','TESTX','<p>x</p>','x','high', now());
INSERT INTO public.orion_task_results (user_id, task_id, task_type, briefing_id, title, significance, group_date)
SELECT user_id, id, 'market_research', '00000000-0000-0000-0000-0000000000aa', 't', 'high', CURRENT_DATE
FROM public.orion_tasks WHERE task_type='market_research' LIMIT 1;

SET LOCAL ROLE authenticated;
-- owner:
SELECT set_config('request.jwt.claims', json_build_object('sub',
  (SELECT user_id FROM public.orion_task_results WHERE briefing_id='00000000-0000-0000-0000-0000000000aa'))::text, true);
SELECT count(*) FROM public.asset_research_briefings WHERE id='00000000-0000-0000-0000-0000000000aa'; -- 1
-- non-owner:
SELECT set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111')::text, true);
SELECT count(*) FROM public.asset_research_briefings WHERE id='00000000-0000-0000-0000-0000000000aa'; -- 0
ROLLBACK;
```
Expected: owner sees 1, non-owner sees 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260609120000_normalized_briefing_delivery.sql
git commit -m "feat(orion): briefings table + thin result envelope schema"
```

---

## Task 2: run-asset-research — write immutable snapshot + pointer; outage → no briefing

**Files:**
- Modify: `supabase/functions/run-asset-research/index.ts`

Context: today the success branch writes content onto the pool row; the outage branch writes a `significance='low'` "Data source unavailable" briefing to the pool (deliverable). After: insert an immutable snapshot + set `current_briefing_id`; outage marks the pool `failed` with no briefing.

- [ ] **Step 1: Replace the outage branch to fail instead of writing a low briefing**

In the `try` block, the current outage handling sets `significance='low'` + placeholder html. Replace it so an outage throws into the existing `catch` (which calls `markPoolFailed`), producing no briefing/delivery:

```ts
    if (totalQueries > 0 && totalErrors === totalQueries) {
      // Full search outage — produce NO briefing. Marking failed (backoff) means
      // no snapshot, no result rows, no error cards fanned out to subscribers.
      log('Asset research: search outage, marking failed (no briefing)', 'warn', { asset });
      await markPoolFailed(serviceClient, poolRow.id, 'Search providers unavailable');
      return successResponse({ skipped: true, reason: 'search_outage' });
    }
```
Delete the old block that set `significance='low'` + the "Data source unavailable" `briefingHtml`/`briefingPlain` for the outage case. The `else` branch (real briefing) stays.

- [ ] **Step 2: Insert the immutable snapshot and point the pool at it**

Replace the final pool `UPDATE` (the `status:'fresh'` write) with: insert a briefing snapshot, then update the pool to point at it.

```ts
    // Insert the immutable shared snapshot first.
    const generatedAt = new Date().toISOString();
    const { data: briefingRow, error: briefingErr } = await serviceClient
      .from('asset_research_briefings')
      .insert({
        asset,
        content_html: briefingHtml,
        content_plain: briefingPlain,
        significance,
        citations: citations.length > 0 ? citations : null,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        generated_at: generatedAt,
      })
      .select('id')
      .single();
    if (briefingErr || !briefingRow) {
      throw new Error(`briefing snapshot insert: ${briefingErr?.message ?? 'no row'}`);
    }

    // Point the pool row at the snapshot and mark fresh.
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: writeErr } = await serviceClient
      .from('asset_research_pool')
      .update({
        status: 'fresh',
        refreshed_at: generatedAt,
        expires_at: expiresAt,
        current_briefing_id: briefingRow.id,
        briefing_html: briefingHtml,
        briefing_plain: briefingPlain,
        significance,
        queries_used: queries,
        citations: citations.length > 0 ? citations : null,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        error_detail: null,
      })
      .eq('id', poolRow.id)
      .eq('status', 'processing');
    if (writeErr) throw new Error(`pool write: ${writeErr.message}`);
```
(The pool keeps its own content columns — harmless, 1 row/asset. The snapshot is the source of truth for delivery.)

- [ ] **Step 3: Deploy and verify a fresh run creates a snapshot + pointer**

```bash
supabase functions deploy run-asset-research --no-verify-jwt --project-ref gwubzauelilziaqnsfac
```
Then force a run (expire pool + trigger dispatcher per the session runbook) and verify:
```sql
SELECT p.current_briefing_id, b.asset, b.significance
FROM asset_research_pool p
JOIN asset_research_briefings b ON b.id = p.current_briefing_id
WHERE p.asset='EURUSD';
-- Expected: one row, current_briefing_id set, asset=EURUSD.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/run-asset-research/index.ts
git commit -m "feat(orion): run-asset-research writes immutable briefing snapshot; outage = no briefing"
```

---

## Task 3: storeTaskResult — thin-row payload (no content copy)

**Files:**
- Modify: `supabase/functions/_shared/storeTaskResult.ts`
- Create: `supabase/functions/_shared/__tests__/storeTaskResult.thin.test.ts`

- [ ] **Step 1: Write the failing test for the thin payload shape**

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildThinResultRow } from '../storeTaskResult.ts';

Deno.test('buildThinResultRow carries envelope + briefing_id, no content', () => {
  const row = buildThinResultRow(
    { id: 't1', user_id: 'u1', task_type: 'market_research' },
    { briefingId: 'b1', title: 'EURUSD Market Research', significance: 'high' },
  );
  assertEquals(row.task_id, 't1');
  assertEquals(row.user_id, 'u1');
  assertEquals(row.briefing_id, 'b1');
  assertEquals(row.title, 'EURUSD Market Research');
  assertEquals(row.significance, 'high');
  assertEquals('content_html' in row, false);
});
```

- [ ] **Step 2: Run it — fails (function not exported)**

```bash
deno test supabase/functions/_shared/__tests__/storeTaskResult.thin.test.ts
```
Expected: FAIL — `buildThinResultRow` is not a function.

- [ ] **Step 3: Add the builder + rework `storeTaskResult`**

Add the pure builder and change `storeTaskResult` to take a `briefing` payload. New `TaskResultPayload`:

```ts
export interface ThinResultPayload {
  briefingId: string;
  title: string;
  significance: string | null;
  preview: string;   // for the notification body (from briefing.content_plain)
}

export function buildThinResultRow(
  task: TaskRef,
  p: ThinResultPayload,
): Record<string, unknown> {
  return {
    task_id: task.id,
    user_id: task.user_id,
    task_type: task.task_type,
    briefing_id: p.briefingId,
    title: p.title,
    significance: p.significance,
    group_date: new Date().toISOString().split('T')[0],
  };
}
```

Rewrite `storeTaskResult` to insert via `buildThinResultRow` with `ON CONFLICT (user_id, briefing_id) DO NOTHING`, and build the notification from `p.title` + `p.preview`:

```ts
export async function storeTaskResult(
  serviceClient: ServiceClient,
  task: TaskRef,
  p: ThinResultPayload,
): Promise<{ ok: boolean; resultId?: string }> {
  const { data: insertedRow, error: insertError } = await serviceClient
    .from('orion_task_results')
    .insert(buildThinResultRow(task, p))
    .onConflict('user_id,briefing_id')   // see Step 4 note
    .ignoreDuplicates()
    .select('id')
    .maybeSingle();

  if (insertError) { log('Failed to store task result', 'error', insertError); return { ok: false }; }
  if (!insertedRow) return { ok: true };   // duplicate (already delivered) — not an error

  // Notification (unchanged shape; preview/title now passed in).
  const preview = p.preview.replace(/\s+/g, ' ').trim().slice(0, 117);
  const title = (p.title || 'Market Research').slice(0, 200);
  const { error: notifErr } = await serviceClient.from('notifications').insert({
    user_id: task.user_id,
    type: 'orion_task_result',
    title,
    payload: { taskId: task.id, resultId: insertedRow.id, taskType: task.task_type,
               significance: p.significance ?? null, isError: false, preview },
  });
  if (notifErr) log('Notification insert failed (non-fatal)', 'warn', { error: notifErr.message });
  return { ok: true, resultId: insertedRow.id };
}
```

Note: the supabase-js insert builder uses `.upsert(..., { onConflict, ignoreDuplicates: true })`. If `.insert().onConflict()` is unavailable in the deployed SDK, use:
```ts
.upsert(buildThinResultRow(task, p), { onConflict: 'user_id,briefing_id', ignoreDuplicates: true })
```
Keep `markTaskSuccess` / `markTaskFailure` unchanged.

- [ ] **Step 4: Run the test — passes**

```bash
deno test supabase/functions/_shared/__tests__/storeTaskResult.thin.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/storeTaskResult.ts supabase/functions/_shared/__tests__/storeTaskResult.thin.test.ts
git commit -m "feat(orion): storeTaskResult writes thin result rows (briefing_id, no content)"
```

---

## Task 4: dispatch Phase 2 — deliver thin rows referencing the snapshot

**Files:**
- Modify: `supabase/functions/dispatch-orion-tasks/index.ts`

Context: Phase 2 currently selects pool content and calls `storeTaskResult` with the content blob. After: select `current_briefing_id` + `significance` + `content_plain` (for preview), and deliver thin rows.

- [ ] **Step 1: Update the Phase 2 pool select**

```ts
    const { data: poolResults } = await serviceClient
      .from('asset_research_pool')
      .select('asset, significance, refreshed_at, current_briefing_id, briefing_plain')
      .in('asset', subscribedAssets)
      .eq('status', 'fresh')
      .gt('expires_at', new Date().toISOString());

    const qualifying = (
      poolResults ?? [] as Array<{
        asset: string;
        significance: string | null;
        refreshed_at: string | null;
        current_briefing_id: string | null;
        briefing_plain: string | null;
      }>
    ).filter((p) => p.current_briefing_id && meetsThreshold(p.significance, minSignificance));
```

- [ ] **Step 2: Deliver thin rows**

```ts
    for (const poolResult of qualifying) {
      const stored = await storeTaskResult(serviceClient, task, {
        briefingId: poolResult.current_briefing_id!,
        title: `${poolResult.asset} Market Research`,
        significance: poolResult.significance,
        preview: poolResult.briefing_plain ?? '',
      });
      if (stored.ok) {
        resultsWritten++;
        log('Delivered pool result to task', 'info', { taskId: task.id, asset: poolResult.asset });
      }
    }
    if (qualifying.length > 0) await markTaskSuccess(serviceClient, task.id);
```
Remove the old `content_html`/`content_plain`/`metadata.citations`/`tool_calls` copy.

- [ ] **Step 3: Deploy and verify thin delivery end-to-end**

```bash
supabase functions deploy dispatch-orion-tasks --no-verify-jwt --project-ref gwubzauelilziaqnsfac
```
Force a fresh research + delivery (session runbook), then:
```sql
SELECT r.briefing_id, r.title, r.significance, r.content_html IS NULL AS no_inline_html
FROM orion_task_results r
JOIN orion_tasks t ON t.id = r.task_id AND t.task_type='market_research'
ORDER BY r.created_at DESC LIMIT 1;
-- Expected: briefing_id set, title='EURUSD Market Research', no_inline_html = true.

-- Re-run delivery for the same briefing — no new row (ON CONFLICT):
SELECT count(*) FROM orion_task_results WHERE briefing_id = (
  SELECT current_briefing_id FROM asset_research_pool WHERE asset='EURUSD');
-- Expected: count unchanged across a second dispatch with the same fresh briefing.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dispatch-orion-tasks/index.ts
git commit -m "feat(orion): dispatch delivers thin result rows referencing shared briefing"
```

---

## Task 5: Frontend types — thin result + embedded briefing

**Files:**
- Modify: `src/features/orion/types/orionTask.ts:88-103`

- [ ] **Step 1: Extend `OrionTaskResult`**

```ts
export interface BriefingSnapshot {
  content_html: string;
  content_plain: string;
  significance: Significance | null;
  citations?: unknown;
  tool_calls?: unknown;
}

export interface OrionTaskResult {
  id: string;
  task_id: string;
  user_id: string;
  task_type: TaskType;
  briefing_id: string | null;
  title: string | null;
  /** Embedded shared briefing (present for pooled rows fetched with the embed). */
  briefing?: BriefingSnapshot | null;
  /** Legacy/non-pool inline content. Empty/absent for thin pooled rows (read via
   *  `briefing` instead); kept typed `string` since it is only ever read through
   *  the `briefing ?? inline` fallback, never dereferenced directly. */
  content_html: string;
  content_plain: string;
  significance: Significance | null;
  metadata: Record<string, unknown>;
  group_date: string;
  is_read: boolean;
  hidden_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS. The new fields are additive (`briefing_id`, `title`, optional `briefing`); existing reads of `content_html`/`content_plain` are unaffected. If errors appear, stop and report.

- [ ] **Step 3: Commit**

```bash
git add src/features/orion/types/orionTask.ts
git commit -m "feat(orion): OrionTaskResult thin shape + embedded briefing type"
```

---

## Task 6: Frontend read path — embed + briefing fallback

**Files:**
- Modify: `src/features/orion/services/orionTaskService.ts:83-107`
- Modify: `src/features/orion/components/orionTasks/TaskResultCard.tsx:355-414`
- Create: `src/features/orion/services/__tests__/orionTaskService.embed.test.ts`

- [ ] **Step 1: Write the failing test for the embed select**

```tsx
import { orionTaskService } from '../orionTaskService';
import { supabase } from 'config/supabase';

jest.mock('config/supabase', () => {
  const chain: any = {};
  ['select','eq','is','order','range'].forEach((m) => (chain[m] = jest.fn(() => chain)));
  chain.range = jest.fn(() => Promise.resolve({ data: [], error: null }));
  return { supabase: { from: jest.fn(() => chain) }, __chain: chain };
});

test('getResults selects the embedded briefing', async () => {
  await orionTaskService.getResults('u1');
  const { __chain } = jest.requireMock('config/supabase') as any;
  expect(__chain.select).toHaveBeenCalledWith(
    expect.stringContaining('briefing:asset_research_briefings(')
  );
});
```

- [ ] **Step 2: Run it — fails**

```bash
npx jest src/features/orion/services/__tests__/orionTaskService.embed.test.ts
```
Expected: FAIL — select called with `'*'`, not the embed string.

- [ ] **Step 3: Update `getResults` to embed**

```ts
    let query = supabase
      .from('orion_task_results')
      .select(
        '*, briefing:asset_research_briefings(content_html, content_plain, significance, citations, tool_calls)'
      )
      .eq('user_id', userId)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
```

- [ ] **Step 4: Run the test — passes**

```bash
npx jest src/features/orion/services/__tests__/orionTaskService.embed.test.ts
```
Expected: PASS.

- [ ] **Step 5: Read content/citations from the briefing with fallback in `TaskResultCard`**

Replace the content render (line ~357) and the citations/tool_calls block (lines ~386-391):

```tsx
            <HtmlMessageRenderer
              html={result.briefing?.content_html ?? result.content_html ?? ''}
              textColor="text.primary"
              embeddedTrades={embeddedTrades}
              embeddedEvents={embeddedEvents}
              embeddedNotes={embeddedNotes}
              trades={trades}
              onTradeClick={canOpenDialogs ? (tradeId) => setGalleryTradeId(tradeId) : undefined}
              onEventClick={canOpenDialogs ? (event) => setSelectedEvent(event) : undefined}
              onNoteClick={canOpenDialogs ? (noteId) => { const note = embeddedNotes?.[noteId]; if (note) setSelectedNote(note); } : undefined}
            />
```

```tsx
          {(() => {
            const src = result.briefing ?? result.metadata;
            const citations = Array.isArray((src as any)?.citations)
              ? ((src as any).citations as Citation[]) : [];
            const toolCalls = Array.isArray((src as any)?.tool_calls)
              ? ((src as any).tool_calls as ToolUsageEntry[]) : [];
            const hasAny = citations.length > 0 || toolCalls.length > 0;
            if (!hasAny) return null;
            return (
              <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${hairline}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                {citations.length > 0 && <CitationsSection citations={citations} compact />}
                {toolCalls.length > 0 && <ToolUsageChip toolCalls={toolCalls} variant="popover" />}
              </Box>
            );
          })()}
```

- [ ] **Step 6: Fix Save-as-Note to read briefing content**

Find where `onSaveNote` builds the note (search `onSaveNote` in `TaskResultCard.tsx`). Change any `result.content_html`/`result.content_plain` it passes to `result.briefing?.content_html ?? result.content_html` (and the plain equivalent).

- [ ] **Step 7: Typecheck + targeted card test**

```bash
npx tsc --noEmit
npx jest src/features/orion/components/orionTasks
```
Expected: PASS (no `content_html` null errors; card renders from briefing).

- [ ] **Step 8: Commit**

```bash
git add src/features/orion/services/orionTaskService.ts src/features/orion/services/__tests__/orionTaskService.embed.test.ts src/features/orion/components/orionTasks/TaskResultCard.tsx
git commit -m "feat(orion): read briefing content via embed with inline fallback"
```

---

## Task 7: Realtime — resolve the briefing for newly-arrived rows

**Files:**
- Modify: `src/features/orion/services/orionTaskService.ts` (add `getBriefing`)
- Modify: `src/features/orion/hooks/useOrionTasks.ts:182-217`

Context: postgres_changes payloads contain the raw row only — no PostgREST embed. A realtime-inserted thin row therefore has `briefing_id` but no `briefing`, so its expanded content would be empty; and the UPDATE handler replaces the row, dropping a briefing already loaded.

- [ ] **Step 1: Add `getBriefing` to the service**

```ts
  async getBriefing(briefingId: string): Promise<BriefingSnapshot | null> {
    const { data, error } = await supabase
      .from('asset_research_briefings')
      .select('content_html, content_plain, significance, citations, tool_calls')
      .eq('id', briefingId)
      .maybeSingle();
    if (error) {
      logger.error('Failed to fetch briefing', error);
      return null;
    }
    return data as BriefingSnapshot | null;
  },
```
Import `BriefingSnapshot` from `features/orion/types/orionTask`.

- [ ] **Step 2: Resolve the briefing on realtime INSERT**

In the INSERT handler, after adding the row, fetch + patch its briefing:

```ts
        (payload) => {
          const newResult = payload.new as OrionTaskResult;
          setResults((prev) => [newResult, ...prev]);
          setUnreadCount((prev) => prev + 1);
          playTaskNotificationSound().catch((err) => {
            logger.debug('Task notification sound failed', err);
          });
          // Realtime payloads carry no PostgREST embed — resolve the shared
          // briefing so the expanded card has content.
          if (newResult.briefing_id && !newResult.briefing) {
            orionTaskService.getBriefing(newResult.briefing_id).then((briefing) => {
              if (!briefing) return;
              setResults((prev) =>
                prev.map((r) => (r.id === newResult.id ? { ...r, briefing } : r)));
            });
          }
        }
```

- [ ] **Step 3: Preserve the loaded briefing on realtime UPDATE**

In the UPDATE handler's non-hidden branch, merge instead of replacing so `briefing` survives:

```ts
          } else {
            setResults((prev) =>
              prev.map((r) =>
                r.id === updated.id ? { ...updated, briefing: r.briefing } : r));
          }
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/orion/services/orionTaskService.ts src/features/orion/hooks/useOrionTasks.ts
git commit -m "feat(orion): resolve shared briefing for realtime-delivered result rows"
```

---

## Task 8: "Active · updated Xm ago" task label (replaces error cards' signal)

**Files:**
- Modify: the Orion task header/row component (locate in Step 1)

- [ ] **Step 1: Locate the task status display**

```bash
# Find where the task status chip ("DISABLED"/active) renders:
```
Use Grep for `status` within `src/features/orion/components/orionTasks/` and the task list/header (e.g. a `MarketResearchSettingsPanel` or task header). Identify the component that already shows the status chip seen in the UI.

- [ ] **Step 2: Add a relative-time label from the latest result**

Compute the most recent delivery time for the task and render a muted label beside the status chip. Use the existing results already in `useOrionTasks` (`results` are loaded), filtering by `task_id`:

```tsx
const lastUpdated = results
  .filter((r) => r.task_id === task.id)
  .reduce<string | null>((latest, r) =>
    !latest || r.created_at > latest ? r.created_at : latest, null);

// beside the status chip:
{lastUpdated && (
  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
    updated {formatRelativeTime(lastUpdated)}
  </Typography>
)}
```
Reuse an existing relative-time formatter if present (search `utils/formatters` for `relative`/`timeAgo`); otherwise add a small `formatRelativeTime(iso)` to `utils/formatters.ts` returning e.g. `"8m ago"`, `"2h ago"`, `"3d ago"`.

- [ ] **Step 3: Typecheck + run the app**

```bash
npx tsc --noEmit
npm start   # verify the label renders beside the status; no error cards appear
```

- [ ] **Step 4: Commit**

```bash
git add src/features/orion src/utils/formatters.ts
git commit -m "feat(orion): show last-updated label on task instead of error cards"
```

---

## Task 9: End-to-end verification + deploy confirmation

**Files:** none (verification).

- [ ] **Step 1: Confirm forward-compat with a legacy row**

```sql
-- A pre-migration row (inline content, briefing_id NULL) still renders via fallback.
SELECT id, briefing_id, content_html IS NOT NULL AS has_inline
FROM orion_task_results WHERE briefing_id IS NULL AND content_html IS NOT NULL LIMIT 1;
```
Confirm the card still shows content for such a row (inline fallback path).

- [ ] **Step 2: Confirm storage dedup**

```sql
-- One briefing, multiple thin rows referencing it (simulate by delivering to >1 task if available),
-- and the briefing content stored once:
SELECT b.id, length(b.content_html) AS html_len,
       (SELECT count(*) FROM orion_task_results r WHERE r.briefing_id = b.id) AS refs
FROM asset_research_briefings b
ORDER BY b.created_at DESC LIMIT 1;
-- Expected: html_len > 0 stored once; refs = number of delivered users.
```

- [ ] **Step 3: Confirm outage produces no card**

Temporarily simulate by forcing `markPoolFailed` (or observe a real failed cycle): confirm no new `orion_task_results` row and no `asset_research_briefings` row for that cycle.

- [ ] **Step 4: Run the frontend suite**

```bash
npm run test:ci
```
Expected: PASS (no regressions in orion service/card tests).

---

## Notes for the implementer

- **Deploy order matters:** apply the migration (Task 1) before deploying the edge functions (Tasks 2-4); deploy edge functions before the frontend (Tasks 5-7). Each step is backward-compatible.
- **Edge fns deploy with `--no-verify-jwt`** (cron/secret-invoked) — see memory `project_edge_function_verify_jwt`.
- **`fetchRecentBriefings`** in `run-orion-task/market-research.ts` reads `content_plain` from result rows — that handler is dead under the pool dispatcher; do NOT wire it into the live path or "fix" it to read the briefing.
- **Manual dispatch trigger / force-refresh runbook** is in memory `project_asset_research_pool_deploy_gap` (expire pool row, `net.http_post` the dispatcher with the secret from `cron.job`).
