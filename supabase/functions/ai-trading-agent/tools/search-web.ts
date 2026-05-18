/**
 * search_web — Serper primary, Tavily fallback. News + organic + knowledge
 * graph results, optional recency filter (day/week/month).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tavilySearchBreaking, tavilySearchNews } from "../../_shared/tavily.ts";
import type { GeminiFunctionDeclaration } from "./types.ts";

export const searchWebTool: GeminiFunctionDeclaration = {
  name: "search_web",
  description:
    "Search web for market news, analysis, and trading information. After getting search results, you can use scrape_url to extract more detailed content from specific URLs. For market news/sentiment, ALWAYS use type: 'news' with time_range: 'day' or 'week' to get current information.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      type: {
        type: "string",
        description:
          'Type: "search" or "news". Use "news" for market sentiment, breaking news, and current events.',
        enum: ["search", "news"],
      },
      time_range: {
        type: "string",
        description:
          'Filter results by recency. Use "day" for breaking news/sentiment, "week" for recent analysis, "month" for broader research. Defaults to no filter.',
        enum: ["day", "week", "month"],
      },
    },
    required: ["query"],
  },
};

/**
 * Serper search attempt. Returns formatted results on success, null on any
 * failure (missing key, HTTP error, empty results, exception) so the caller
 * can decide whether to fall back to Tavily.
 */
async function trySerperSearch(
  query: string,
  searchType: string,
  timeRange: string | undefined,
): Promise<string | null> {
  try {
    const serperApiKey = Deno.env.get("SERPER_API_KEY");
    if (!serperApiKey) return null;

    const endpoint = searchType === "news"
      ? "https://google.serper.dev/news"
      : "https://google.serper.dev/search";

    const timeRangeMap: Record<string, string> = {
      day: "qdr:d",
      week: "qdr:w",
      month: "qdr:m",
    };

    const body: Record<string, unknown> = {
      q: query,
      gl: "us",
      hl: "en",
      num: 10,
    };
    if (timeRange && timeRangeMap[timeRange]) {
      body.tbs = timeRangeMap[timeRange];
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const hasOrganic = data.organic && data.organic.length > 0;
    const hasNews = data.news && data.news.length > 0;
    const hasKnowledge = data.knowledgeGraph &&
      (data.knowledgeGraph.title || data.knowledgeGraph.description);

    if (!hasOrganic && !hasNews && !hasKnowledge) return null;

    let results = `Search results for: "${query}"\n\n`;

    if (hasOrganic) {
      results += "Top Results:\n";
      for (const result of data.organic.slice(0, 5)) {
        results += `\n- ${result.title}\n  ${result.snippet}\n  ${result.link}\n`;
      }
    }

    if (hasNews) {
      results += "News Results:\n";
      for (const result of data.news.slice(0, 5)) {
        const date = result.date ? ` [${result.date}]` : "";
        results += `\n- ${result.title}${date}\n  ${
          result.snippet || result.description || ""
        }\n  ${result.link}\n`;
      }
    }

    if (hasKnowledge) {
      const title = data.knowledgeGraph.title || "";
      const desc = data.knowledgeGraph.description || "";
      results += `\n\n${title}\n${desc}\n`;
    }

    return results;
  } catch {
    return null;
  }
}

/**
 * Tavily search fallback. Maps chat's day/week/month time-range to Tavily's
 * coarser day/week buckets (Tavily has no month bucket via our integration —
 * a month-range chat query falls back to week, which is acceptable for
 * fallback semantics; Serper had first crack at the precise range).
 */
async function tryTavilySearch(
  supabase: SupabaseClient,
  query: string,
  searchType: string,
  timeRange: string | undefined,
): Promise<string | null> {
  try {
    const tavilyTimeRange: "qdr:h" | "qdr:d" | "qdr:w" = timeRange === "week"
      ? "qdr:w"
      : timeRange === "month"
      ? "qdr:w"
      : "qdr:d";

    const results = searchType === "news"
      ? await tavilySearchNews(supabase, query, 10, tavilyTimeRange)
      : await tavilySearchBreaking(supabase, query, tavilyTimeRange, 10);

    if (!results || results.length === 0) return null;

    let out = `Search results for: "${query}" (Tavily fallback)\n\n`;
    out += searchType === "news" ? "News Results:\n" : "Top Results:\n";
    for (const r of results.slice(0, 5)) {
      const date = r.date ? ` [${r.date}]` : "";
      out += `\n- ${r.title}${date}\n  ${r.snippet}\n  ${r.link}\n`;
    }
    return out;
  } catch {
    return null;
  }
}

async function executeWebSearch(
  query: string,
  searchType: string = "search",
  timeRange?: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const serperResult = await trySerperSearch(query, searchType, timeRange);
  if (serperResult) return serperResult;

  if (supabase) {
    const tavilyResult = await tryTavilySearch(
      supabase,
      query,
      searchType,
      timeRange,
    );
    if (tavilyResult) return tavilyResult;
  }

  return `⚠️ NO RESULTS FOUND for query: "${query}". Try different search terms or use your market knowledge.`;
}

export async function executeSearchWeb(
  args: Record<string, unknown>,
  supabase?: SupabaseClient,
): Promise<string> {
  const query = typeof args.query === "string" ? args.query : "";
  const searchType = typeof args.type === "string" ? args.type : "search";
  const timeRange = typeof args.time_range === "string"
    ? args.time_range
    : undefined;
  return await executeWebSearch(query, searchType, timeRange, supabase);
}
