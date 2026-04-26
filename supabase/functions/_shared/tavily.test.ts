// Run with: deno test --allow-env supabase/functions/_shared/tavily.test.ts

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeTavilyResponse,
  mapTimeRange,
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
