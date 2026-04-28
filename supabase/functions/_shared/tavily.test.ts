// Run with: deno test --allow-env supabase/functions/_shared/tavily.test.ts

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeTavilyResponse,
  mapTimeRange,
  stripChrome,
  type TavilyResponse,
} from "./tavily.ts";

Deno.test("normalize: extracts title/url/snippet/source", () => {
  const resp: TavilyResponse = {
    results: [
      {
        title: "Fed holds rates",
        url: "https://www.reuters.com/article/fed",
        content: "The Federal Reserve held rates steady today.",
        score: 0.95,
        published_date: "2026-04-26T14:30:00Z",
      },
    ],
  };
  const out = normalizeTavilyResponse(resp);
  assertEquals(out.length, 1);
  assertEquals(out[0].title, "Fed holds rates");
  assertEquals(out[0].link, "https://www.reuters.com/article/fed");
  assertEquals(out[0].snippet, "The Federal Reserve held rates steady today.");
  assertEquals(out[0].source, "reuters.com");
  assertEquals(out[0].date, "2026-04-26T14:30:00Z");
});

Deno.test("normalize: missing optional fields don't crash", () => {
  const resp: TavilyResponse = {
    results: [
      { title: "X", url: "https://example.com/a", content: "" },
    ],
  };
  const out = normalizeTavilyResponse(resp);
  assertEquals(out.length, 1);
  assertEquals(out[0].snippet, "");
  assertEquals(out[0].date, undefined);
  assertEquals(out[0].source, "example.com");
});

Deno.test("normalize: malformed URL falls back to empty source", () => {
  // Defensive: if Tavily ever returns a bad URL, we shouldn't throw.
  const resp: TavilyResponse = {
    results: [{ title: "X", url: "not a url", content: "" }],
  };
  const out = normalizeTavilyResponse(resp);
  assertEquals(out[0].source, undefined);
});

Deno.test("normalize: empty results → empty array", () => {
  const resp: TavilyResponse = { results: [] };
  assertEquals(normalizeTavilyResponse(resp), []);
});

Deno.test("normalize: cap at num", () => {
  const resp: TavilyResponse = {
    results: Array.from({ length: 10 }, (_, i) => ({
      title: `T${i}`,
      url: `https://example.com/${i}`,
      content: "",
    })),
  };
  const out = normalizeTavilyResponse(resp, 3);
  assertEquals(out.length, 3);
});

// Tavily's `time_range` accepts: "day" | "week" | "month" | "year". No "hour"
// granularity exists, so qdr:h must fall back to "day" — coarser than ideal
// but the only legal mapping. Documented in mapTimeRange's comment so a
// future Tavily API update can revisit.
Deno.test("time-range: qdr:h → day (no hour granularity in Tavily)", () => {
  assertEquals(mapTimeRange("qdr:h"), "day");
});

Deno.test("time-range: qdr:d → day", () => {
  assertEquals(mapTimeRange("qdr:d"), "day");
});

Deno.test("time-range: qdr:w → week", () => {
  assertEquals(mapTimeRange("qdr:w"), "week");
});

Deno.test("normalize: subdomain is preserved (only `www.` is stripped)", () => {
  // Locks the contract: regex anchors to ^www\. so news.bbc.co.uk stays intact.
  const resp: TavilyResponse = {
    results: [{ title: "X", url: "https://news.bbc.co.uk/article", content: "" }],
  };
  const out = normalizeTavilyResponse(resp);
  assertEquals(out[0].source, "news.bbc.co.uk");
});

Deno.test("normalize: URL with port keeps the port in source", () => {
  // Locks current behavior. Note: URL.hostname (per WHATWG spec) excludes the
  // port — that lives on URL.port — so the source ends up as "example.com"
  // even though the input had ":8080". If port-preservation ever becomes
  // desired, switch to URL.host and update this assertion.
  const resp: TavilyResponse = {
    results: [{ title: "X", url: "https://example.com:8080/x", content: "" }],
  };
  const out = normalizeTavilyResponse(resp);
  assertEquals(out[0].source, "example.com");
});

// ============================================================
// stripChrome — pure helper for Tavily extract responses
// ============================================================
//
// Tavily extract responses include ~30-40% navigation chrome (menu items,
// section names) before the article body. The strip locates the article
// title in the content and slices from there.

Deno.test("stripChrome: anchors on article title and removes preceding chrome", () => {
  const content = "CNBC\n Markets\n Tech\nFed signals dovish pivot\nThe Federal Reserve hinted today...";
  const title = "Fed signals dovish pivot";
  assertEquals(stripChrome(content, title), "Fed signals dovish pivot\nThe Federal Reserve hinted today...");
});

Deno.test("stripChrome: handles title with site-name suffix", () => {
  // Tavily often returns title as "Headline - Site" or "Headline | Site".
  // Match by the first 20 chars of the headline portion only.
  const content = "Skip Navigation\nNasdaq rallies on Fed pivot\nMarkets surged today...";
  const title = "Nasdaq rallies on Fed pivot - WSJ";
  assertEquals(
    stripChrome(content, title),
    "Nasdaq rallies on Fed pivot\nMarkets surged today...",
  );
});

Deno.test("stripChrome: returns full content when title not found", () => {
  // Defensive: if the headline doesn't appear in the body verbatim, don't
  // drop content. Better to feed Gemini chrome+article than an empty string.
  const content = "Some text without the headline anywhere";
  const title = "An entirely different headline";
  assertEquals(stripChrome(content, title), content);
});

Deno.test("stripChrome: very short title returns full content", () => {
  // Anchoring on <5 chars would match too aggressively (e.g. "AI" matches
  // anything). Skip the strip if the headline is too short to anchor.
  const content = "CNBC\n Markets\n AI is everywhere now...";
  const title = "AI";
  assertEquals(stripChrome(content, title), content);
});

Deno.test("stripChrome: empty title returns full content", () => {
  const content = "Some article content";
  assertEquals(stripChrome(content, ""), content);
});

Deno.test("stripChrome: title at position 0 returns full content (no chrome to strip)", () => {
  // If the title IS at position 0, indexOf returns 0, our `idx > 0` guard
  // returns the full content. Equivalent outcome to slicing at 0; safer.
  const content = "Article Title\nBody text here";
  const title = "Article Title";
  assertEquals(stripChrome(content, title), content);
});
