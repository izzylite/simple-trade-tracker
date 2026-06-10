import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';
import {
  storeTaskResult,
  markTaskSuccess,
} from '../_shared/storeTaskResult.ts';

const MAX_TASKS_PER_DISPATCH = 500;

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const SIGNIFICANCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

function meetsThreshold(poolSignificance: string | null, minSignificance: string): boolean {
  const resultRank = SIGNIFICANCE_RANK[poolSignificance ?? 'low'] ?? 0;
  const threshold = SIGNIFICANCE_RANK[minSignificance] ?? 2;
  return resultRank >= threshold;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const expectedSecret = Deno.env.get('ORION_DISPATCHER_SECRET');
  if (!expectedSecret) {
    log('ORION_DISPATCHER_SECRET not set', 'error');
    return errorResponse('Dispatcher not configured', 500);
  }
  const providedSecret = req.headers.get('x-orion-dispatcher-secret') ?? '';
  if (!constantTimeEquals(providedSecret, expectedSecret)) {
    log('Dispatcher auth failed', 'warn', { hasHeader: providedSecret.length > 0 });
    return errorResponse('Unauthorized', 401);
  }

  const startedAt = Date.now();
  const serviceClient = createServiceClient();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return errorResponse('Env vars missing', 500);

  // ─── PHASE 1: Asset refresh ────────────────────────────────────────────────
  // Find all distinct assets across active market_research tasks.
  // Claim stale/missing pool slots and fire run-asset-research for each.

  const { data: taskRows } = await serviceClient
    .from('orion_tasks')
    .select('config')
    .eq('task_type', 'market_research')
    .eq('status', 'active');

  const activeAssets = Array.from(new Set(
    (taskRows ?? []).flatMap((t: { config: Record<string, unknown> }) => {
      const assets = t.config?.subscribed_assets;
      return Array.isArray(assets) ? assets as string[] : [];
    })
  )).filter(Boolean);

  let assetsRefreshed = 0;
  let assetsSkipped = 0;

  if (activeAssets.length > 0) {
    // Bulk-fetch current pool state for all active assets
    const { data: poolRows } = await serviceClient
      .from('asset_research_pool')
      .select('asset, status, expires_at')
      .in('asset', activeAssets);

    const poolMap = new Map(
      (poolRows ?? []).map(
        (r: { asset: string; status: string; expires_at: string | null }) => [r.asset, r]
      )
    );

    const assetRunUrl = `${supabaseUrl}/functions/v1/run-asset-research`;

    for (const asset of activeAssets) {
      const row = poolMap.get(asset);
      const isFresh = row?.status === 'fresh' &&
        row.expires_at != null &&
        new Date(row.expires_at) > new Date();
      // A 'processing' row is only in-flight while its claim TTL (expires_at,
      // stamped now()+10min by claim_asset_for_research) is unexpired. An
      // expired TTL means the worker was killed mid-flight — fall through and
      // reclaim it (the claim RPC's ON CONFLICT recovers stale processing rows).
      const isProcessing = row?.status === 'processing' &&
        row.expires_at != null &&
        new Date(row.expires_at) > new Date();
      const isInBackoff = row?.status === 'failed' &&
        row.expires_at != null &&
        new Date(row.expires_at) > new Date();

      if (isFresh || isProcessing || isInBackoff) {
        assetsSkipped++;
        continue;
      }

      // Claim the slot atomically
      const { data: claimed } = await serviceClient.rpc('claim_asset_for_research', {
        p_asset: asset,
      });
      if (!claimed) { assetsSkipped++; continue; }

      // Fire runner fire-and-forget (failures recorded in pool.status)
      fetch(assetRunUrl, {
        method: 'POST',
        headers: {
          'x-orion-dispatcher-secret': expectedSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ asset }),
      }).catch((e: unknown) =>
        log('run-asset-research fire failed', 'error', { asset, err: String(e) })
      );

      assetsRefreshed++;
    }
  }

  log('Phase 1 complete', 'info', { assetsRefreshed, assetsSkipped });

  // ─── PHASE 2: User delivery ────────────────────────────────────────────────
  // Find due market_research tasks and deliver pool results to each.

  const { data: dueTasks, error: dueErr } = await serviceClient
    .from('orion_tasks')
    .select('id, user_id, task_type, config')
    .eq('task_type', 'market_research')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(MAX_TASKS_PER_DISPATCH);

  if (dueErr) {
    log('Phase 2 query failed', 'error', dueErr);
    return errorResponse(`Phase 2 query: ${dueErr.message}`, 500);
  }

  const tasks = (dueTasks ?? []) as Array<{
    id: string;
    user_id: string;
    task_type: string;
    config: Record<string, unknown>;
  }>;

  // Also handle non-market_research task types (run-orion-task path preserved)
  const { data: otherTasks, error: otherErr } = await serviceClient
    .from('orion_tasks')
    .select('id, task_type')
    .neq('task_type', 'market_research')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(MAX_TASKS_PER_DISPATCH);

  if (!otherErr && otherTasks && otherTasks.length > 0) {
    const runUrl = `${supabaseUrl}/functions/v1/run-orion-task`;
    await Promise.allSettled(
      (otherTasks as Array<{ id: string; task_type: string }>).map(async (task) => {
        const response = await fetch(runUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: task.id }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`run-orion-task ${response.status}: ${body.slice(0, 200)}`);
        }
        return response.json();
      })
    );

    // Advance next_run_at for other tasks
    const { error: otherAdvanceErr } = await serviceClient.rpc(
      'advance_orion_tasks_next_run_at',
      { p_task_ids: otherTasks.map((t: { id: string }) => t.id) }
    );
    if (otherAdvanceErr) {
      log('Advance RPC failed for other tasks', 'warn', otherAdvanceErr);
    }
  }

  let resultsWritten = 0;

  for (const task of tasks) {
    const subscribedAssets: string[] = Array.isArray(task.config?.subscribed_assets)
      ? task.config.subscribed_assets as string[]
      : [];
    const minSignificance: string = (task.config?.min_significance as string) ?? 'high';
    if (subscribedAssets.length === 0) continue;

    // Fetch fresh pool results for this task's assets
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

    for (const poolResult of qualifying) {
      // Deliver a thin row referencing the shared briefing — no content copied.
      const stored = await storeTaskResult(serviceClient, task, {
        briefingId: poolResult.current_briefing_id!,
        title: `${poolResult.asset} Market Research`,
        significance: poolResult.significance,
        preview: poolResult.briefing_plain ?? '',
      });
      if (stored.ok) {
        resultsWritten++;
        log('Delivered pool result to task', 'info', {
          taskId: task.id,
          asset: poolResult.asset,
        });
      }
    }

    if (qualifying.length > 0) {
      await markTaskSuccess(serviceClient, task.id);
    }
  }

  // Advance next_run_at for all due market_research tasks
  if (tasks.length > 0) {
    const { error: advanceError } = await serviceClient.rpc(
      'advance_orion_tasks_next_run_at',
      { p_task_ids: tasks.map((t) => t.id) }
    );
    if (advanceError) {
      log('Advance RPC failed for market_research tasks', 'error', advanceError);
      return errorResponse(`Advance next_run_at failed: ${advanceError.message}`, 500);
    }
  }

  const elapsed = Date.now() - startedAt;
  log('Dispatch complete', 'info', {
    assetsRefreshed,
    assetsSkipped,
    tasksChecked: tasks.length,
    resultsWritten,
    elapsed_ms: elapsed,
  });

  return successResponse({
    phase1: { assetsRefreshed, assetsSkipped },
    phase2: { tasksChecked: tasks.length, resultsWritten },
    elapsed_ms: elapsed,
  });
});
