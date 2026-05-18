/**
 * scrape_url — extract article body from a URL via tavily → serper fallback.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchSerperScrape } from "../../_shared/serperScrape.ts";
import { scrapeArticle } from "../../_shared/scrapeProvider.ts";
import type { GeminiFunctionDeclaration } from "./types.ts";

export const scrapeUrlTool: GeminiFunctionDeclaration = {
  name: "scrape_url",
  description:
    "Scrape and extract content from a URL to get more detailed information. Use this after search_web to get full article content. You can also use this to extract and analyze sentiment from news articles.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to scrape and extract content from",
      },
    },
    required: ["url"],
  },
};

async function scrapeUrl(
  url: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const article = supabase
    ? (await scrapeArticle(supabase, url, 3600, "tavily")) ??
      (await scrapeArticle(supabase, url, 3600, "serper"))
    : await fetchSerperScrape(url);
  if (!article) {
    return `URL scraping failed or returned no content for: ${url}`;
  }
  let result = `Content from: ${article.url}\n\n`;
  if (article.title) result += `Title: ${article.title}\n\n`;
  result += `Content:\n${article.text}`;
  return result;
}

export async function executeScrapeUrl(
  args: Record<string, unknown>,
  supabase?: SupabaseClient,
): Promise<string> {
  const url = typeof args.url === "string" ? args.url : "";
  return await scrapeUrl(url, supabase);
}
