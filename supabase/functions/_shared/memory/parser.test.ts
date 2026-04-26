// Run with: deno test --allow-env supabase/functions/_shared/memory/parser.test.ts
//
// Tests cover the pure helpers that drive the AGENT_MEMORY note lifecycle:
// parsing, dedup, scoring, compaction. The async updateMemory path is left
// to integration tests since it needs a real Supabase client.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Import directly from the leaf modules — not the barrel — so this test's
// dependency graph stays pure and doesn't pull in supabase-js via operations.ts.
import {
  buildMemoryContent,
  compactSections,
  deduplicateInsights,
  jaccard,
  normalizeMemoryContent,
  parseMemorySections,
  scoreInsight,
  tokenizeForDedup,
  validateInsightBatch,
  validateInsightFormat,
} from "./parser.ts";
import { MEMORY_SECTION_ORDER, type MemorySection } from "./types.ts";

// ---------------------------------------------------------------------------
// normalizeMemoryContent
// ---------------------------------------------------------------------------
Deno.test("normalize: CRLF -> LF", () => {
  const out = normalizeMemoryContent("a\r\nb\r\nc");
  assertEquals(out, "a\nb\nc");
});

Deno.test("normalize: case-insensitive section headers and trailing junk", () => {
  const input = "## strategy_preferences - extra\n- item\n## Lessons_Learned (notes)\n- x";
  const out = normalizeMemoryContent(input);
  assertStringIncludes(out, "## STRATEGY_PREFERENCES");
  assertStringIncludes(out, "## LESSONS_LEARNED");
});

Deno.test("normalize: asterisk bullets converted to dashes", () => {
  const input = "## TRADER_PROFILE\n* item one\n*item two\n-item three";
  const out = normalizeMemoryContent(input);
  // Each bullet should now begin with "- "
  for (const line of ["- item one", "- item two", "- item three"]) {
    assertStringIncludes(out, line);
  }
});

// ---------------------------------------------------------------------------
// parseMemorySections / buildMemoryContent round-trip
// ---------------------------------------------------------------------------
Deno.test("parse: extracts bullets and ignores placeholder", () => {
  const md = [
    "## TRADER_PROFILE",
    "- Conservative scalper",
    "- (No data yet)",
    "",
    "## PERFORMANCE_PATTERNS",
    "- London 72% wr [High] [2026-04]",
    "",
    "## STRATEGY_PREFERENCES",
    "- (No data yet)",
    "",
    "## PSYCHOLOGICAL_PATTERNS",
    "- (No data yet)",
    "",
    "## LESSONS_LEARNED",
    "- (No data yet)",
    "",
    "## ACTIVE_FOCUS",
    "- (No data yet)",
  ].join("\n");

  const sections = parseMemorySections(md);
  assertEquals(sections.TRADER_PROFILE, ["Conservative scalper"]);
  assertEquals(sections.PERFORMANCE_PATTERNS, ["London 72% wr [High] [2026-04]"]);
  assertEquals(sections.STRATEGY_PREFERENCES, []);
  assertEquals(sections.PSYCHOLOGICAL_PATTERNS, []);
});

Deno.test("parse: empty content yields empty sections", () => {
  const sections = parseMemorySections("");
  for (const key of MEMORY_SECTION_ORDER) {
    assertEquals(sections[key], []);
  }
});

Deno.test("parse: handles dirty input (CRLF + asterisks + casing)", () => {
  const dirty = "## trader_profile\r\n* Risk-averse\r\n*Daily stop: $200\r\n";
  const sections = parseMemorySections(dirty);
  assertEquals(sections.TRADER_PROFILE, ["Risk-averse", "Daily stop: $200"]);
});

Deno.test("build/parse round trip preserves all sections", () => {
  const original: Record<MemorySection, string[]> = {
    TRADER_PROFILE: ["Scalper"],
    PERFORMANCE_PATTERNS: ["London 72% wr [High] [2026-04]"],
    STRATEGY_PREFERENCES: ["Daily stop $200"],
    PSYCHOLOGICAL_PATTERNS: ["FOMO after 2 losses"],
    LESSONS_LEARNED: ["Avoid Asian session"],
    ACTIVE_FOCUS: ["Improve B+ setup execution"],
  };
  const md = buildMemoryContent(original);
  const round = parseMemorySections(md);
  for (const key of MEMORY_SECTION_ORDER) {
    assertEquals(round[key], original[key], `section ${key} drifted`);
  }
});

// ---------------------------------------------------------------------------
// tokenizeForDedup / jaccard / deduplicateInsights
// ---------------------------------------------------------------------------
Deno.test("tokenize: strips date/confidence tags and stopwords", () => {
  const sig = tokenizeForDedup(
    "London session: 72% win rate on 15 trades [High] [2026-04]",
  );
  // "session", "trades", "win", "rate" are stopwords; "the", "on" too short.
  assertEquals(sig.has("london"), true);
  assertEquals(sig.has("session"), false, "domain stopword should be dropped");
  assertEquals(sig.has("trades"), false);
  assertEquals(sig.has("high"), false, "confidence tag stripped");
  assertEquals(sig.has("2026"), false, "date tag stripped");
});

Deno.test("tokenize: light stemmer collides ing/s/es", () => {
  const a = tokenizeForDedup("scalping fibonacci entries");
  const b = tokenizeForDedup("scalp fibonacci entry");
  assert(a.has("scalp"), "expected scalping → scalp");
  assert(b.has("scalp"));
  assert(a.has("entri") || a.has("entry"), "expected entries to stem");
});

Deno.test("jaccard: identical sets = 1, disjoint = 0", () => {
  assertEquals(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  assertEquals(jaccard(new Set(["a"]), new Set(["b"])), 0);
});

Deno.test("dedup: collapses semantic duplicates that previously slipped through", () => {
  const insights = [
    "London session: 72% win rate on 15 trades [High] [2026-04]",
    "London 72% wr [High] [2026-04]", // different surface form, same fact
    "Counter-trend trades: 30% win rate, avoid [Med] [2026-04]",
  ];
  const out = deduplicateInsights(insights);
  // The two London entries should collapse; counter-trend stays.
  assertEquals(out.length, 2, `expected 2, got ${out.length}: ${JSON.stringify(out)}`);
  assert(out.some((s) => /counter-trend/i.test(s)));
});

Deno.test("dedup: keeps unrelated insights distinct", () => {
  const insights = [
    "Risk-averse, prefers 1% per trade [High] [2026-04]",
    "Trades only London and NY sessions [High] [2026-04]",
    "Avoids news events [Med] [2026-04]",
  ];
  const out = deduplicateInsights(insights);
  assertEquals(out.length, 3);
});

Deno.test("dedup: stable ordering — first occurrence wins", () => {
  const insights = [
    "London 72% wr [High] [2026-04]",
    "London session: 72% win rate on 15 trades [High] [2026-04]",
  ];
  const out = deduplicateInsights(insights);
  assertEquals(out[0], "London 72% wr [High] [2026-04]");
});

// ---------------------------------------------------------------------------
// scoreInsight
// ---------------------------------------------------------------------------
Deno.test("score: high confidence beats low confidence at same date", () => {
  const high = scoreInsight("X [High] [2026-04]");
  const low = scoreInsight("X [Low] [2026-04]");
  assert(high > low, `high=${high} low=${low}`);
});

Deno.test("score: recent date beats ancient at same confidence", () => {
  const recent = scoreInsight("X [Med] [2026-04]");
  const ancient = scoreInsight("X [Med] [2020-01]");
  assert(recent > ancient, `recent=${recent} ancient=${ancient}`);
});

Deno.test("score: undated still scored (not zero)", () => {
  const s = scoreInsight("Some observation with no tags");
  assert(s > 0);
});

// ---------------------------------------------------------------------------
// compactSections
// ---------------------------------------------------------------------------
Deno.test("compact: under cap returns unchanged", () => {
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: ["a", "b"],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };
  const { sections: out, dropped } = compactSections(sections);
  assertEquals(dropped, 0);
  assertEquals(out.TRADER_PROFILE, ["a", "b"]);
});

Deno.test("compact: over cap drops lowest-scoring per section", () => {
  // 30 items, mix of high/low confidence and recent/ancient dates.
  const items: string[] = [];
  for (let i = 0; i < 15; i++) {
    items.push(`fresh high item ${i} [High] [2026-04]`);
  }
  for (let i = 0; i < 15; i++) {
    items.push(`stale low item ${i} [Low] [2018-01]`);
  }

  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: items,
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };

  const { sections: out, dropped } = compactSections(sections);
  assertEquals(dropped, 5, "expected to drop 30 - 25 = 5 items");
  assertEquals(out.PERFORMANCE_PATTERNS.length, 25);
  // Every retained item should be a "fresh high" — those score strictly higher.
  const survivors = out.PERFORMANCE_PATTERNS.filter((s) => s.startsWith("fresh high"));
  assertEquals(survivors.length, 15, "all 15 fresh-high items should survive");
});

Deno.test("compact: ACTIVE_FOCUS exempt even when over cap", () => {
  const items = Array.from({ length: 30 }, (_, i) => `goal ${i} [Low] [2018-01]`);
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: items,
  };
  const { sections: out, dropped } = compactSections(sections);
  assertEquals(dropped, 0);
  assertEquals(out.ACTIVE_FOCUS.length, 30);
});

// ---------------------------------------------------------------------------
// Cross-cutting: build → parse → dedup → compact pipeline
// ---------------------------------------------------------------------------
Deno.test("pipeline: dirty markdown survives full round trip without data loss", () => {
  const dirty = [
    "## trader_profile",
    "* Conservative scalper",
    "*Risk-averse",
    "",
    "## performance_patterns - notes",
    "- London 72% wr [High] [2026-04]",
    "* London session: 72% win rate on 15 trades [High] [2026-04]", // dup
    "- Counter-trend 30% wr [Med] [2026-04]",
    "",
    "## active_focus",
    "- Improve B+ execution",
  ].join("\r\n");

  const parsed = parseMemorySections(dirty);
  // Dedup on the parsed bullets
  parsed.PERFORMANCE_PATTERNS = deduplicateInsights(parsed.PERFORMANCE_PATTERNS);
  assertEquals(parsed.TRADER_PROFILE.length, 2);
  assertEquals(parsed.PERFORMANCE_PATTERNS.length, 2, "London dup should collapse");
  assertEquals(parsed.ACTIVE_FOCUS, ["Improve B+ execution"]);

  // Round-trip through build → parse stays stable
  const built = buildMemoryContent(parsed);
  const reparsed = parseMemorySections(built);
  for (const key of MEMORY_SECTION_ORDER) {
    assertEquals(reparsed[key], parsed[key], `${key} drifted on round trip`);
  }
});

// ---------------------------------------------------------------------------
// validateInsightFormat / validateInsightBatch
// ---------------------------------------------------------------------------

Deno.test("validate: accepts canonical insight with [High] and [YYYY-MM]", () => {
  const r = validateInsightFormat("Daily stop $150 [High] [2026-04]");
  assert(r.ok);
});

Deno.test("validate: accepts [Med] and [Medium] aliases", () => {
  assert(validateInsightFormat("X [Med] [2026-04]").ok);
  assert(validateInsightFormat("X [Medium] [2026-04]").ok);
});

Deno.test("validate: accepts [Low]", () => {
  assert(validateInsightFormat("X [Low] [2026-04]").ok);
});

Deno.test("validate: case-insensitive on confidence tag", () => {
  assert(validateInsightFormat("X [high] [2026-04]").ok);
  assert(validateInsightFormat("X [LOW] [2026-04]").ok);
});

Deno.test("validate: accepts insights without colon structure", () => {
  // The [Pattern]: [Evidence] colon shape is a prompt convention, not a
  // schema. Real insights without colons should still pass.
  const r = validateInsightFormat(
    "User confirmed discretionary, not systematic [High] [2026-04]",
  );
  assert(r.ok);
});

Deno.test("validate: rejects missing confidence tag", () => {
  const r = validateInsightFormat("Daily stop $150 [2026-04]");
  assert(!r.ok);
  if (!r.ok) {
    assertStringIncludes(r.error!, "confidence");
    assertStringIncludes(r.error!, "[High]");
  }
});

Deno.test("validate: rejects missing date tag", () => {
  const r = validateInsightFormat("Daily stop $150 [High]");
  assert(!r.ok);
  if (!r.ok) {
    assertStringIncludes(r.error!, "date");
    assertStringIncludes(r.error!, "YYYY-MM");
  }
});

Deno.test("validate: rejects missing both tags, lists both in error", () => {
  const r = validateInsightFormat("Daily stop $150");
  assert(!r.ok);
  if (!r.ok) {
    assertStringIncludes(r.error!, "confidence");
    assertStringIncludes(r.error!, "date");
  }
});

Deno.test("validate: rejects empty / whitespace insight", () => {
  assert(!validateInsightFormat("").ok);
  assert(!validateInsightFormat("   ").ok);
});

Deno.test("validate: rejects non-string input", () => {
  // deno-lint-ignore no-explicit-any
  assert(!validateInsightFormat(42 as any).ok);
  // deno-lint-ignore no-explicit-any
  assert(!validateInsightFormat(null as any).ok);
});

Deno.test("validate: bogus year-month formats not accepted", () => {
  // [04-2026] (DD-YYYY) and [2026/04] (slash) shouldn't pass.
  assert(!validateInsightFormat("X [High] [04-2026]").ok);
  assert(!validateInsightFormat("X [High] [2026/04]").ok);
  // [2026-4] (single-digit month) — date pattern requires zero-padded MM,
  // so this should also reject.
  assert(!validateInsightFormat("X [High] [2026-4]").ok);
});

Deno.test("validateInsightBatch: passes when all insights valid", () => {
  const r = validateInsightBatch([
    "First [High] [2026-04]",
    "Second [Med] [2026-04]",
    "Third [Low] [2026-03]",
  ]);
  assert(r.ok);
});

Deno.test("validateInsightBatch: returns first error", () => {
  const r = validateInsightBatch([
    "Good [High] [2026-04]",
    "Bad missing tags",
    "Never reached [High] [2026-04]",
  ]);
  assert(!r.ok);
  if (!r.ok) {
    // Error should reference the bad bullet, not the good one
    assertStringIncludes(r.error!, "Bad missing tags");
  }
});

Deno.test("validateInsightBatch: empty array passes (caller checks empty separately)", () => {
  const r = validateInsightBatch([]);
  assert(r.ok);
});
