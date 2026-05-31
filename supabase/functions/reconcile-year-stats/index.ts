/**
 * Reconcile Year Stats — pg_cron sweep
 *
 * Backstops year_stats recomputes that the coalescing guard (claim_year_stats_recompute,
 * ~5s window) or a transient handle-trade-changes failure dropped: the last write in a
 * burst, or a one-off write (esp. DELETE) whose single webhook errored, can leave
 * calendars.year_stats stale forever with no retry. This sweep recomputes any calendar
 * whose latest trade change is newer than its last recompute — source and linked alike.
 *
 * Invoked by pg_cron via year_stats_sweep_call(); verify_jwt=false + shared-secret gate.
 */
import {
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';
import { updateYearStats } from '../_shared/yearStats.ts';

const MAX_CALENDARS_PER_SWEEP = 100;

// Timing-safe comparison to avoid leaking the secret via response-time differences.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Secret lives only in Vault; fetch once per warm isolate via a service-role-only RPC.
let cachedSecret: string | null = null;
async function getExpectedSecret(
  client: ReturnType<typeof createServiceClient>,
): Promise<string | null> {
  if (cachedSecret) return cachedSecret;
  const { data, error } = await client.rpc('get_year_stats_sweep_secret');
  if (error || !data) {
    log('Failed to load year_stats_sweep_secret via RPC', 'error', error);
    return null;
  }
  cachedSecret = data as string;
  return cachedSecret;
}

interface StaleCalendar {
  calendar_id: string;
  threshold: string; // max(trades.updated_at) captured atomically by the detector RPC
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  // Shared-secret auth (pg_cron can't present a JWT).
  const expectedSecret = await getExpectedSecret(supabase);
  if (!expectedSecret) {
    return errorResponse('Sweep not configured', 500);
  }
  const provided = req.headers.get('x-year-stats-sweep-secret') ?? '';
  if (!constantTimeEquals(provided, expectedSecret)) {
    log('reconcile-year-stats auth failed', 'warn', { hasHeader: provided.length > 0 });
    return errorResponse('Unauthorized', 401);
  }

  const startedAt = Date.now();

  const { data: stale, error: staleErr } = await supabase.rpc(
    'find_stale_year_stats_calendars',
    { p_limit: MAX_CALENDARS_PER_SWEEP },
  );
  if (staleErr) {
    log('find_stale_year_stats_calendars failed', 'error', staleErr);
    return errorResponse(`Query failed: ${staleErr.message}`, 500);
  }

  const rows = (stale ?? []) as StaleCalendar[];
  if (rows.length === 0) {
    return successResponse(
      { recomputed: 0, elapsed_ms: Date.now() - startedAt },
      'No stale calendars',
    );
  }

  let recomputed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const res = await updateYearStats(row.calendar_id, { coalesce: false });
      if (res.ran) {
        // Stamp the threshold captured by the detector (max updated_at at scan time),
        // NOT now(): a write that lands after this recompute's read keeps a newer
        // updated_at and is still detected on the next sweep.
        await supabase
          .from('calendars')
          .update({ year_stats_last_recomputed_at: row.threshold } as never)
          .eq('id', row.calendar_id);
        recomputed++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      log('reconcile-year-stats recompute failed', 'error', { calendar_id: row.calendar_id, e });
    }
  }

  log(`year-stats sweep: recomputed ${recomputed}, failed ${failed}, scanned ${rows.length}`);
  return successResponse({
    recomputed,
    failed,
    scanned: rows.length,
    elapsed_ms: Date.now() - startedAt,
  });
});
