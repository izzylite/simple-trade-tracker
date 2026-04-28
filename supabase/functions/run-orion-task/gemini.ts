import { log } from '../_shared/supabase.ts';
import { callGemini } from '../_shared/gemini.ts';

const BRIEFING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    significance: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    title: { type: 'string' },
    briefing_html: { type: 'string' },
    briefing_plain: { type: 'string' },
  },
  required: ['significance', 'title', 'briefing_html', 'briefing_plain'],
};

export async function generateContent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { text } = await callGemini({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    responseSchema: BRIEFING_RESPONSE_SCHEMA,
  });
  return text;
}

// ============================================================
// Tool-using briefing generator
// ============================================================
//
// Single tool: `scrape_url`. Single round: Gemini either answers directly
// (no scrapes) or calls scrape_url for up to 3 URLs in parallel. After
// scraped content comes back, Gemini produces the final JSON briefing under
// the same schema as `generateContent`.
//
// Why a purpose-built loop instead of a generic one: market-research has
// exactly one optional tool, and the flow maps cleanly to Gemini's parallel
// function-calling — no multi-round reasoning, no tool orchestration. A
// generic loop would add abstraction without buying anything.

// Raised from 3 → 5 when scraping migrated to Tavily Extract: per-call cost
// is negligible against the 10-key pool, and 5 parallel extracts complete
// in normal briefing latency (~1-2s each, all parallel).
export const MAX_SCRAPES_PER_BRIEFING = 5;

const SCRAPE_TOOL_DECLARATION = {
  name: 'scrape_url',
  description:
    'Fetch the full body text of a news article URL. Use when a headline hints ' +
    'at a catalyst whose direction or magnitude can\'t be judged from the snippet ' +
    'alone (dovish vs hawkish pivot, exact bps move, source-of-statement, etc). ' +
    'Skip routine session color and headlines already covered in Previously Reported. ' +
    `You may call this in parallel for up to ${MAX_SCRAPES_PER_BRIEFING} URLs ` +
    'in a single turn. Only call for URLs that appear in the "Recent Market News" ' +
    'or "Breaking Content" sections of the user prompt.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          'The article URL to fetch. Must exactly match a URL from the news list.',
      },
    },
    required: ['url'],
  },
};

export interface BriefingWithScrapeResult {
  json: string;
  scrapedUrls: string[];
  scrapedUrlsFailed: string[];
}

/**
 * Run the briefing flow with scrape_url available as an optional tool.
 *
 * `scraper` is injected by the caller so this file stays free of Supabase
 * client and cache concerns. Called at most MAX_SCRAPES_PER_BRIEFING times
 * per briefing; extras are silently dropped.
 */
export async function generateBriefingWithScrape(
  systemPrompt: string,
  userPrompt: string,
  scraper: (url: string) => Promise<{ url: string; title: string; text: string } | null>
): Promise<BriefingWithScrapeResult> {
  // ---- Round 1: allow tool calls, no response schema yet ----
  // (responseSchema + function_calling are mutually exclusive per Gemini API
  //  — asking for structured JSON while also offering tools 400s.)
  const round1 = await callGemini({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [SCRAPE_TOOL_DECLARATION],
    toolMode: 'AUTO',
  });

  // No tool calls — Gemini answered directly. But round 1 had no response
  // schema, so re-run as a straight JSON generation to get the final briefing
  // shape. Happens when the news/price snapshot is enough to decide alone.
  if (round1.functionCalls.length === 0) {
    log('Market research: no scrape calls, going straight to briefing', 'info');
    const json = await generateContent(systemPrompt, userPrompt);
    return { json, scrapedUrls: [], scrapedUrlsFailed: [] };
  }

  // Cap the number of scrapes; Gemini can sometimes over-call.
  const calls = round1.functionCalls
    .filter((c) => c.name === 'scrape_url')
    .slice(0, MAX_SCRAPES_PER_BRIEFING);

  log('Market research: executing scrape tool calls', 'info', {
    requested: round1.functionCalls.length,
    executing: calls.length,
    urls: calls.map((c) => (c.args.url as string) ?? '(missing)'),
  });

  // Execute scrapes in parallel. Null results still get reported back so
  // Gemini knows the URL was tried — hiding failures can lead it to
  // hallucinate "per the article..." for content it never received.
  const scrapeResults = await Promise.all(
    calls.map(async (call) => {
      const scrapeUrl = (call.args.url as string) ?? '';
      const article = scrapeUrl ? await scraper(scrapeUrl) : null;
      return { call, article };
    })
  );

  // ---- Round 2: feed scraped content back, enforce JSON schema ----
  // Echo the raw round-1 parts verbatim so Gemini 3.x thoughtSignature
  // (if present) round-trips. Then append a user turn with functionResponse
  // parts in the same order as the calls were made.
  const functionResponseParts = scrapeResults.map(({ call, article }) => ({
    functionResponse: {
      name: call.name,
      response: article
        ? { url: article.url, title: article.title, text: article.text }
        : {
            url: (call.args.url as string) ?? '',
            error: 'Scrape failed or returned no content.',
          },
    },
  }));

  const round2 = await callGemini({
    systemInstruction: systemPrompt,
    contents: [
      { role: 'user', parts: [{ text: userPrompt }] },
      { role: 'model', parts: round1.rawParts },
      { role: 'user', parts: functionResponseParts },
    ],
    // Keep tools declared so Gemini's model state stays consistent, but force
    // a text response — no more tool calls after the scrape round.
    tools: [SCRAPE_TOOL_DECLARATION],
    toolMode: 'NONE',
    responseSchema: BRIEFING_RESPONSE_SCHEMA,
  });

  const scrapedUrls = scrapeResults
    .filter(({ article }) => article !== null)
    .map(({ article }) => article!.url);

  // Track failed scrapes so callers can surface them as metrics. Silently
  // dropping failures hides quality degradation: a briefing generated after
  // 3/3 scrapes failed is materially worse than 3/3 succeeded, but both
  // would look identical without this.
  const scrapedUrlsFailed = scrapeResults
    .filter(({ article }) => article === null)
    .map(({ call }) => (call.args.url as string) ?? '(missing)');

  if (scrapedUrlsFailed.length > 0) {
    log('Market research: scrape failures', 'warn', {
      failed: scrapedUrlsFailed.length,
      succeeded: scrapedUrls.length,
      urls: scrapedUrlsFailed,
    });
  }

  return { json: round2.text, scrapedUrls, scrapedUrlsFailed };
}
