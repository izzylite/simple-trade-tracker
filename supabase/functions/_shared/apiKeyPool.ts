/**
 * Exponential-backoff cooldown for keys hit by quota errors. Schedule is
 * deliberately short at the start (1h, 6h) so a transient burst doesn't
 * sideline a key for days, and long at the cap (30d) so a genuinely-dead
 * key doesn't keep getting picked.
 *
 * Failure counter resets to 0 on the next successful call (see markHealthy).
 */
const BACKOFF_SCHEDULE_SECONDS = [
  0,           // index 0 — unused (defensive)
  3600,        // 1h
  21600,       // 6h
  86400,       // 24h
  259200,      // 3d
  604800,      // 7d
  2592000,     // 30d (cap)
];

export function nextBackoffSeconds(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  if (consecutiveFailures >= BACKOFF_SCHEDULE_SECONDS.length) {
    return BACKOFF_SCHEDULE_SECONDS[BACKOFF_SCHEDULE_SECONDS.length - 1];
  }
  return BACKOFF_SCHEDULE_SECONDS[consecutiveFailures];
}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";

export interface AcquiredKey {
  id: number;
  key: string;
}

/**
 * Reserve a key from the pool for `source`. Uses a SECURITY DEFINER RPC that
 * runs `SELECT ... FOR UPDATE SKIP LOCKED` so concurrent callers can't collide
 * on the same key.
 *
 * Returns null when:
 *   - The pool is empty for this source
 *   - All keys are cooling down (next_retry_at in the future) or disabled
 *
 * Callers MUST treat null as "data source unavailable" — same contract as
 * existing search functions returning null on API failure.
 */
export async function acquireKey(
  supabase: SupabaseClient,
  source: string
): Promise<AcquiredKey | null> {
  const { data, error } = await supabase
    .rpc("acquire_api_key", { p_source: source })
    .maybeSingle();

  if (error) {
    log("acquireKey: RPC failed", "error", { source, error });
    return null;
  }
  if (!data) {
    log("acquireKey: no available keys", "warn", { source });
    return null;
  }
  // .maybeSingle() types data as `{} | null`; narrow with a single cast that
  // matches the RPC's renamed OUT params (renamed from id/key to avoid
  // shadowing the api_keys.id column inside the SQL function).
  const row = data as { acquired_id: number; acquired_key: string };
  return { id: row.acquired_id, key: row.acquired_key };
}

/**
 * Mark a key as having hit a quota/rate error. Bumps the failure counter and
 * sets next_retry_at via the backoff schedule. The key stays in the pool but
 * is filtered out of acquireKey() until next_retry_at passes.
 */
export async function markQuotaExhausted(
  supabase: SupabaseClient,
  keyId: number,
  reason: string
): Promise<void> {
  // Schedule is the BACKOFF_SCHEDULE_SECONDS array minus the index-0 sentinel.
  // SQL receives a 1-indexed array where index N == cooldown for failure N,
  // with the last entry acting as the cap (LEAST(failures, length) clamps).
  const schedule = BACKOFF_SCHEDULE_SECONDS.slice(1);

  const { error } = await supabase.rpc("mark_quota_exhausted", {
    p_key_id: keyId,
    p_reason: reason,
    p_schedule_seconds: schedule,
  });

  if (error) {
    log("markQuotaExhausted: RPC failed", "error", { keyId, error });
  }
}

/**
 * Mark a key as permanently dead (auth failure). Removed from the pool until
 * an operator manually re-enables it.
 */
export async function markDisabled(
  supabase: SupabaseClient,
  keyId: number,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({ disabled: true, last_failure_reason: reason })
    .eq("id", keyId);
  if (error) {
    log("markDisabled: failed", "error", { keyId, error });
  }
}

/**
 * Reset failure state on successful call. Called after every 2xx response so
 * a key that recovers (e.g. monthly reset) goes back to the front of the queue.
 */
export async function markHealthy(
  supabase: SupabaseClient,
  keyId: number
): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({
      consecutive_failures: 0,
      next_retry_at: null,
      last_failure_reason: null,
    })
    .eq("id", keyId);
  if (error) {
    log("markHealthy: failed", "error", { keyId, error });
  }
}
