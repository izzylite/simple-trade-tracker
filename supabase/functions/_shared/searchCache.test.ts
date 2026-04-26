// Run with: deno test --allow-env supabase/functions/_shared/searchCache.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeCacheKey } from "./searchCache.ts";

Deno.test("cache key: includes provider as first segment", () => {
  const key = makeCacheKey("tavily", "news", "fed rate decision", 5, "qdr:d");
  assertEquals(key, "tavily::news::fed rate decision::5::qdr:d");
});

Deno.test("cache key: serper and tavily produce different keys for same query", () => {
  const a = makeCacheKey("serper", "news", "fed", 3, "qdr:d");
  const b = makeCacheKey("tavily", "news", "fed", 3, "qdr:d");
  assertEquals(a === b, false);
});

Deno.test("cache key: empty time range still produces a key", () => {
  const key = makeCacheKey("tavily", "search", "test", 5);
  assertEquals(key, "tavily::search::test::5::");
});
