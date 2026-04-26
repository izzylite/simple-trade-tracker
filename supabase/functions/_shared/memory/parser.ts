/**
 * Memory module — pure helpers.
 *
 * Everything here is deterministic and side-effect-free apart from the
 * structured `log()` calls (which only emit to stdout). No I/O, no DB. The
 * helpers handle the markdown <-> sections boundary, dedup, scoring, and
 * compaction. Operations.ts orchestrates these against the database.
 */

import {
  MEMORY_PER_SECTION_CAP,
  MEMORY_SECTION_ORDER,
  type MemorySection,
} from "./types.ts";

// Inline log shim — `_shared/supabase.ts` exports `log` but also top-level
// imports the supabase-js SDK, which would force this pure helper module to
// pull the whole client into its dep graph (and lockfile) just to get a
// formatted console.log. Keeping this tiny shim local lets parser.test.ts
// run without any network deps. Format mirrors the global helper.
type LogLevel = "info" | "warn" | "error";
function log(message: string, level: LogLevel = "info"): void {
  const ts = new Date().toISOString();
  console[level](`[${ts}] ${message.toUpperCase()}: ${message}`);
}

/**
 * Normalize content to handle various edge cases:
 * - Convert CRLF to LF
 * - Fix bullets with asterisks or no space after dash
 * - Normalize section headers (case-insensitive, remove trailing text)
 */
export function normalizeMemoryContent(content: string): string {
  // Normalize line endings (CRLF -> LF)
  let normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Fix section headers: case-insensitive match and remove trailing text
  // e.g., "## strategy_preferences - note" -> "## STRATEGY_PREFERENCES"
  for (const section of MEMORY_SECTION_ORDER) {
    const headerPattern = new RegExp(
      `^## ?${section}[^\\n]*$`,
      "gmi",
    );
    normalized = normalized.replace(headerPattern, `## ${section}`);
  }

  // Fix bullet points:
  // - Convert asterisks to dashes: "* item" -> "- item"
  // - Add space after dash if missing: "-item" -> "- item"
  normalized = normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      // Convert "* item" to "- item"
      if (trimmed.startsWith("* ")) {
        return line.replace(/^\s*\* /, "- ");
      }
      // Convert "*item" to "- item"
      if (trimmed.startsWith("*") && !trimmed.startsWith("* ")) {
        return line.replace(/^\s*\*/, "- ");
      }
      // Convert "-item" (no space) to "- item"
      if (
        trimmed.startsWith("-") && !trimmed.startsWith("- ") &&
        trimmed.length > 1
      ) {
        return line.replace(/^(\s*)-([^\s])/, "$1- $2");
      }
      return line;
    })
    .join("\n");

  return normalized;
}

/**
 * Parse memory content into sections
 */
export function parseMemorySections(
  content: string,
): Record<MemorySection, string[]> {
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };

  // Handle empty content
  if (!content || content.trim().length === 0) {
    log(`[parseMemorySections] Empty content received`, "warn");
    return sections;
  }

  // Normalize content to handle edge cases (CRLF, asterisks, case issues, etc.)
  const normalizedContent = normalizeMemoryContent(content);

  // Split by section headers
  const sectionPattern =
    /^## (TRADER_PROFILE|PERFORMANCE_PATTERNS|STRATEGY_PREFERENCES|PSYCHOLOGICAL_PATTERNS|LESSONS_LEARNED|ACTIVE_FOCUS)\s*$/gm;
  const parts = normalizedContent.split(sectionPattern);

  // Debug: log how many parts were found
  const sectionNamesFound = parts.filter((_, i) => i % 2 === 1);
  log(
    `[parseMemorySections] Found ${sectionNamesFound.length} section headers: ${
      sectionNamesFound.join(", ")
    }`,
    "info",
  );

  // parts will be: [preamble, "SECTION_NAME", content, "SECTION_NAME", content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const sectionName = parts[i] as MemorySection;
    const sectionContent = parts[i + 1] || "";

    // Extract bullet points from section content (excluding placeholder text)
    const bullets = sectionContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.substring(2).trim())
      .filter((line) => line.length > 0)
      .filter((line) => line !== "(No data yet)");

    if (MEMORY_SECTION_ORDER.includes(sectionName)) {
      sections[sectionName] = bullets;
    }
  }

  // Warn if no sections were parsed from non-empty content
  const totalBullets = Object.values(sections).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  if (content.length > 50 && totalBullets === 0) {
    log(
      `[parseMemorySections] WARNING: No bullets parsed from ${content.length} char content. Content may be malformed.`,
      "warn",
    );
    log(
      `[parseMemorySections] Content start: ${
        content.substring(0, 200).replace(/\n/g, "\\n")
      }`,
      "warn",
    );
  }

  return sections;
}

/**
 * Build memory content from sections
 */
export function buildMemoryContent(
  sections: Record<MemorySection, string[]>,
): string {
  const parts: string[] = [];

  for (const section of MEMORY_SECTION_ORDER) {
    const items = sections[section] || [];
    parts.push(`## ${section}`);
    if (items.length > 0) {
      parts.push(items.map((item) => `- ${item}`).join("\n"));
    } else {
      parts.push("- (No data yet)");
    }
    parts.push(""); // Empty line between sections
  }

  return parts.join("\n").trim();
}

// =============================================================================
// Proposition format validation
// =============================================================================
//
// Insights stored in core memory are expected to carry a confidence tag
// (`[High]` / `[Med]` / `[Medium]` / `[Low]`) and a date tag (`[YYYY-MM]`).
// Both are load-bearing: scoreInsight() reads them for compaction, dedup
// uses date stripping during tokenisation, and recall benefits from
// time-stamped recency.
//
// We do NOT enforce the `[Pattern]: [Evidence]` colon structure — that's a
// prompt convention, not a schema. Real insights like "User confirmed
// discretionary, not systematic" don't fit a colon shape and shouldn't be
// rejected for it.
//
// Validation is soft: returns { ok, error } so callers can decide whether
// to reject the write or just log a warning.

const CONFIDENCE_TAG_PATTERN = /\[(high|med|medium|low)\]/i;
const DATE_TAG_PATTERN = /\[\d{4}-\d{2}\]/;

export interface InsightValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Check that an insight string carries the metadata downstream code depends on.
 * Returns ok=true with no error on canonical input. On failure, error contains
 * an actionable message the LLM can read and retry against.
 */
export function validateInsightFormat(insight: string): InsightValidationResult {
  if (typeof insight !== "string") {
    return { ok: false, error: "Insight must be a string." };
  }
  const trimmed = insight.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Insight cannot be empty." };
  }

  const missing: string[] = [];
  if (!CONFIDENCE_TAG_PATTERN.test(trimmed)) {
    missing.push('confidence tag (one of "[High]", "[Med]", "[Medium]", "[Low]")');
  }
  if (!DATE_TAG_PATTERN.test(trimmed)) {
    missing.push('date tag ("[YYYY-MM]" — e.g. "[2026-04]")');
  }

  if (missing.length === 0) return { ok: true };

  return {
    ok: false,
    error:
      `Insight format invalid: missing ${missing.join(" and ")}. ` +
      `Example shape: "Daily stop $150 [High] [2026-04]". ` +
      `Got: "${trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed}"`,
  };
}

/**
 * Validate a batch of insights. Returns the first error found, or ok=true
 * if all pass. Used by ADD / REPLACE_SECTION before committing the write.
 */
export function validateInsightBatch(insights: string[]): InsightValidationResult {
  for (const insight of insights) {
    const result = validateInsightFormat(insight);
    if (!result.ok) return result;
  }
  return { ok: true };
}

// Common stopwords + filler tokens that distort word-set similarity. Without
// removing these, "London 72% wr" and "London session: 72% win rate on 15
// trades" share too few content tokens to trip the threshold.
const DEDUP_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with", "but", "not", "no", "do", "does", "did", "so",
  // domain filler
  "trade", "trades", "trading", "session", "setup", "setups", "rate", "wr",
  "win", "loss", "pnl", "ratio",
]);

/**
 * Tokenize an insight into a normalized signature word-set:
 *   - lowercase
 *   - strip [YYYY-MM] date tags and [High|Med|Low] confidence tags
 *   - strip "Source: ..." trailers
 *   - drop punctuation
 *   - light stemming (trailing s/es/ed/ing) so "scalps" / "scalping" collide
 *   - drop stopwords + tokens shorter than 3 chars
 */
export function tokenizeForDedup(insight: string): Set<string> {
  const cleaned = insight
    .toLowerCase()
    .replace(/\[\d{4}-\d{2}\]/g, "")
    .replace(/\[(high|med|medium|low)\]/gi, "")
    .replace(/-\s*source:[^[\n]*/i, "")
    .replace(/[^\p{L}\p{N}\s%]/gu, " ");

  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !DEDUP_STOPWORDS.has(t))
    .map((t) => {
      // very light stemmer — order matters
      if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
      if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
      if (t.endsWith("ed") && t.length > 4) return t.slice(0, -2);
      if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
      if (t.endsWith("s") && t.length > 3) return t.slice(0, -1);
      return t;
    });

  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate similar insights using stopword-stripped, lightly-stemmed
 * Jaccard similarity. Threshold tuned at 0.65 — lower than the original
 * 0.8 because tokenization now removes filler that previously inflated
 * the score on already-distinct items.
 */
export function deduplicateInsights(insights: string[]): string[] {
  const result: string[] = [];
  const sigs: Set<string>[] = [];

  for (const insight of insights) {
    const sig = tokenizeForDedup(insight);
    let isDuplicate = false;
    for (const seen of sigs) {
      if (jaccard(sig, seen) > 0.65) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      sigs.push(sig);
      result.push(insight);
    }
  }

  return result;
}

/**
 * Score an insight by recency × confidence so compaction can drop the
 * least-load-bearing items first. Insights without tags fall into a
 * neutral mid-band.
 */
export function scoreInsight(insight: string): number {
  let score = 0;

  // Confidence weight
  if (/\[high\]/i.test(insight)) score += 3;
  else if (/\[med(ium)?\]/i.test(insight)) score += 2;
  else if (/\[low\]/i.test(insight)) score += 1;
  else score += 1.5;

  // Recency weight from [YYYY-MM] tag — more recent = higher.
  const dateMatch = insight.match(/\[(\d{4})-(\d{2})\]/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const months = year * 12 + month;
    // Anchor to "now" so older items get progressively lower weight.
    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + (now.getMonth() + 1);
    const ageMonths = Math.max(0, nowMonths - months);
    // Decay ~half-life 12 months
    score += 3 * Math.pow(0.94, ageMonths);
  } else {
    score += 1.5; // undated → mid recency
  }

  return score;
}

/**
 * Compact memory when it exceeds MEMORY_SIZE_COMPACT_CHARS. Strategy:
 *   1. For each section, sort bullets by scoreInsight desc.
 *   2. Keep top MEMORY_PER_SECTION_CAP per section.
 *   3. ACTIVE_FOCUS is left untouched (replace-only section, user-driven).
 *
 * Returns the compacted sections plus a count of dropped bullets so the
 * caller can log.
 */
export function compactSections(
  sections: Record<MemorySection, string[]>,
): { sections: Record<MemorySection, string[]>; dropped: number } {
  let dropped = 0;
  const out: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };

  for (const key of MEMORY_SECTION_ORDER) {
    const items = sections[key] || [];
    if (key === "ACTIVE_FOCUS" || items.length <= MEMORY_PER_SECTION_CAP) {
      out[key] = [...items];
      continue;
    }
    const sorted = [...items]
      .map((text) => ({ text, score: scoreInsight(text) }))
      .sort((a, b) => b.score - a.score);
    out[key] = sorted.slice(0, MEMORY_PER_SECTION_CAP).map((x) => x.text);
    dropped += items.length - out[key].length;
  }

  return { sections: out, dropped };
}
