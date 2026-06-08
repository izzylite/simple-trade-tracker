import { log } from '../_shared/supabase.ts';
import { callGemini } from '../_shared/gemini.ts';
import type {
  GeminiFunctionCall,
  GeminiFunctionDeclaration,
} from '../_shared/gemini.ts';

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

// This description is the canonical scrape policy. The system prompt only
// references it ("see scrape_url tool description") to prevent the kind of
// drift that caused the Apr 28 zero-scrape regression — when policy lived
// in two places and the wordings diverged.
const SCRAPE_TOOL_DECLARATION = {
  name: 'scrape_url',
  description:
    'Fetch the full body text of a news article URL. Snippets give you the headline; ' +
    'the body has the trader\'s-eye details — specific quotes, exact figures, market ' +
    'follow-through.\n' +
    'Call this tool when ANY of:\n' +
    '(a) The snippet describes a major catalyst (central bank decision/speech, head-' +
    'of-state statement, geopolitical shock, surprise data miss/beat) — even if ' +
    'direction is clear from the headline, the body adds context the briefing ' +
    'genuinely needs.\n' +
    '(b) The snippet hints at direction or magnitude but doesn\'t pin it down (e.g. ' +
    '"Fed signals pivot" without dovish/hawkish, "rate cut expected" without bps, ' +
    '"policy shift" without specifics).\n' +
    'Examples:\n' +
    '- "Fed Holds Rates in Split Decision" → SCRAPE (vote split, dot-plot details, Powell language live in body)\n' +
    '- "Trump Sets 48-Hour Iran Deadline" → SCRAPE (timing, demands, response specifics live in body)\n' +
    '- "ECB\'s Lagarde: Inflation persistent but path is clear" → SCRAPE (b — direction unclear from "persistent but clear")\n' +
    '- "DXY edges higher in quiet European session" → SKIP (routine session color, snippet says everything)\n' +
    '- Any headline whose catalyst is already in Previously Reported → SKIP\n' +
    `You may call this in parallel for up to ${MAX_SCRAPES_PER_BRIEFING} URLs in a single turn. ` +
    'Only call for URLs that appear in the "Recent Market News" or "Breaking Content" sections ' +
    'of the user prompt.',
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

// An optional extra tool offered alongside scrape_url in Round 1. The caller
// owns the declaration (what Gemini sees) and the execute fn (what runs), so
// gemini.ts stays free of market-data / Supabase concerns. `maxCalls` caps how
// many of this tool's calls are honoured per briefing — the bound that keeps a
// model-driven tool from turning the fixed 2-round flow into an open loop.
export interface BriefingExtraTool {
  declaration: GeminiFunctionDeclaration;
  execute: (args: Record<string, unknown>) => Promise<string>;
  maxCalls: number;
}

// Hard ceiling on each extra tool call's wall time. Twelve Data / Yahoo can
// hang (HTTP-200-on-error, no-data quirks); without this a single stuck lookup
// stalls the whole briefing and trips the edge function's ~10s-hang → 502.
// On timeout we feed an error string back so Gemini omits that number rather
// than waiting or hallucinating it.
const EXTRA_TOOL_TIMEOUT_MS = 8000;

function withTimeout(p: Promise<string>, ms: number, fallback: string): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    p.then((v) => { clearTimeout(timer); return v; },
           (e) => { clearTimeout(timer); throw e; }),
    timeout,
  ]);
}

export interface BriefingWithScrapeResult {
  json: string;
  scrapedUrls: string[];
  scrapedUrlsFailed: string[];
  /** Extra-tool calls Gemini actually made (for tools-used metadata + audit). */
  extraToolCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

/**
 * Run the briefing flow with scrape_url — and optionally extra model-driven
 * tools — available in a single Round-1 batch.
 *
 * `scraper` and each `extraTools[].execute` are injected by the caller so this
 * file stays free of Supabase client and cache concerns. The flow stays a fixed
 * two rounds (decide-and-fetch, then write): every tool call Gemini emits in
 * Round 1 runs in parallel, results feed back, Round 2 produces the JSON under
 * schema with tools forced off. Per-tool call caps bound cost and latency;
 * over-cap or unknown calls are silently dropped.
 */
export async function generateBriefingWithScrape(
  systemPrompt: string,
  userPrompt: string,
  scraper: (url: string) => Promise<{ url: string; title: string; text: string } | null>,
  extraTools: BriefingExtraTool[] = []
): Promise<BriefingWithScrapeResult> {
  const toolDeclarations = [
    SCRAPE_TOOL_DECLARATION,
    ...extraTools.map((t) => t.declaration),
  ];

  // ---- Round 1: allow tool calls, no response schema yet ----
  // (responseSchema + function_calling are mutually exclusive per Gemini API
  //  — asking for structured JSON while also offering tools 400s.)
  const round1 = await callGemini({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: toolDeclarations,
    toolMode: 'AUTO',
  });

  // No tool calls — Gemini answered directly. But round 1 had no response
  // schema, so re-run as a straight JSON generation to get the final briefing
  // shape. Happens when the news/price snapshot is enough to decide alone.
  if (round1.functionCalls.length === 0) {
    log('Market research: no tool calls, going straight to briefing', 'info');
    const json = await generateContent(systemPrompt, userPrompt);
    return { json, scrapedUrls: [], scrapedUrlsFailed: [], extraToolCalls: [] };
  }

  // Partition Gemini's calls by tool, capping each per-tool, while preserving
  // emission order — function responses must come back in the order the calls
  // were made or Gemini's tool-result matching drifts.
  const extraByName = new Map(extraTools.map((t) => [t.declaration.name, t]));
  const perToolCount = new Map<string, number>();
  type Planned =
    | { kind: 'scrape'; call: GeminiFunctionCall }
    | { kind: 'extra'; call: GeminiFunctionCall; tool: BriefingExtraTool };
  const planned: Planned[] = [];
  for (const call of round1.functionCalls) {
    const used = perToolCount.get(call.name) ?? 0;
    if (call.name === 'scrape_url') {
      if (used >= MAX_SCRAPES_PER_BRIEFING) continue;
      perToolCount.set(call.name, used + 1);
      planned.push({ kind: 'scrape', call });
    } else if (extraByName.has(call.name)) {
      const tool = extraByName.get(call.name)!;
      if (used >= tool.maxCalls) continue;
      perToolCount.set(call.name, used + 1);
      planned.push({ kind: 'extra', call, tool });
    }
    // Unknown / over-cap call — drop it (no response part emitted for it).
  }

  log('Market research: executing tool calls', 'info', {
    requested: round1.functionCalls.length,
    executing: planned.length,
    scrapes: planned.filter((p) => p.kind === 'scrape').length,
    extra: planned.filter((p) => p.kind === 'extra').length,
  });

  // Execute all planned calls in parallel. Failures still get reported back so
  // Gemini knows the call was tried — hiding them invites hallucinated
  // "per the article…" / fabricated price levels for data it never received.
  const executed = await Promise.all(
    planned.map(async (p) => {
      if (p.kind === 'scrape') {
        const scrapeUrl = (p.call.args.url as string) ?? '';
        const article = scrapeUrl ? await scraper(scrapeUrl) : null;
        return { ...p, article, dataText: null as string | null };
      }
      const dataText = await withTimeout(
        p.tool.execute(p.call.args),
        EXTRA_TOOL_TIMEOUT_MS,
        `${p.call.name} timed out after ${EXTRA_TOOL_TIMEOUT_MS}ms — omit this data from the briefing.`
      ).catch((e) =>
        `${p.call.name} failed: ${e instanceof Error ? e.message : String(e)} — omit this data.`
      );
      return { ...p, article: null as { url: string; title: string; text: string } | null, dataText };
    })
  );

  // ---- Round 2: feed tool results back, enforce JSON schema ----
  // Echo the raw round-1 parts verbatim so Gemini 3.x thoughtSignature
  // (if present) round-trips. Then append a user turn with functionResponse
  // parts in the same order as the calls were made.
  const functionResponseParts = executed.map((e) => ({
    functionResponse: {
      name: e.call.name,
      response: e.kind === 'scrape'
        ? (e.article
            ? { url: e.article.url, title: e.article.title, text: e.article.text }
            : {
                url: (e.call.args.url as string) ?? '',
                error: 'Scrape failed or returned no content.',
              })
        : { result: e.dataText },
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
    // a text response — no more tool calls after the fetch round.
    tools: toolDeclarations,
    toolMode: 'NONE',
    responseSchema: BRIEFING_RESPONSE_SCHEMA,
  });

  const scrapedUrls = executed
    .filter((e) => e.kind === 'scrape' && e.article !== null)
    .map((e) => e.article!.url);

  // Track failed scrapes so callers can surface them as metrics. Silently
  // dropping failures hides quality degradation: a briefing generated after
  // 3/3 scrapes failed is materially worse than 3/3 succeeded, but both
  // would look identical without this.
  const scrapedUrlsFailed = executed
    .filter((e) => e.kind === 'scrape' && e.article === null)
    .map((e) => (e.call.args.url as string) ?? '(missing)');

  const extraToolCalls = executed
    .filter((e) => e.kind === 'extra')
    .map((e) => ({ name: e.call.name, args: e.call.args }));

  if (scrapedUrlsFailed.length > 0) {
    log('Market research: scrape failures', 'warn', {
      failed: scrapedUrlsFailed.length,
      succeeded: scrapedUrls.length,
      urls: scrapedUrlsFailed,
    });
  }

  return { json: round2.text, scrapedUrls, scrapedUrlsFailed, extraToolCalls };
}
