// Run with: deno test --allow-env supabase/functions/_shared/apiKeyPool.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { nextBackoffSeconds } from "./apiKeyPool.ts";

const HOUR = 3600;
const DAY = 86400;

Deno.test("backoff: failure 1 → 1 hour", () => {
  assertEquals(nextBackoffSeconds(1), 1 * HOUR);
});

Deno.test("backoff: failure 2 → 6 hours", () => {
  assertEquals(nextBackoffSeconds(2), 6 * HOUR);
});

Deno.test("backoff: failure 3 → 24 hours", () => {
  assertEquals(nextBackoffSeconds(3), 24 * HOUR);
});

Deno.test("backoff: failure 4 → 3 days", () => {
  assertEquals(nextBackoffSeconds(4), 3 * DAY);
});

Deno.test("backoff: failure 5 → 7 days", () => {
  assertEquals(nextBackoffSeconds(5), 7 * DAY);
});

Deno.test("backoff: failure 6 → 30 days", () => {
  assertEquals(nextBackoffSeconds(6), 30 * DAY);
});

Deno.test("backoff: failure 7+ caps at 30 days", () => {
  assertEquals(nextBackoffSeconds(7), 30 * DAY);
  assertEquals(nextBackoffSeconds(50), 30 * DAY);
});

Deno.test("backoff: failure 0 returns 0 (unused)", () => {
  // Defensive: callers should never pass 0 (means no failure), but if they
  // do we return 0 rather than throwing, so a misuse can't crash a key-pick.
  assertEquals(nextBackoffSeconds(0), 0);
});
