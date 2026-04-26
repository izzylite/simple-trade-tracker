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
