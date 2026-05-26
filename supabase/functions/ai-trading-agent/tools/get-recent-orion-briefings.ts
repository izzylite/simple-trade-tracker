/**
 * get_recent_orion_briefings — retrieve Market Research briefings already sent
 * to the user.
 *
 * Filters: instrument (currency code OR catalog symbol resolved through
 * INSTRUMENT_CATALOG), date range (since_hours / since_date / until_date),
 * and a sanity cap on limit.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../../_shared/supabase.ts";
import {
  INSTRUMENT_CATALOG,
  type InstrumentCatalogEntry,
  isBriefingCurrency,
  matchInstrumentCatalog,
  resolveInstrumentInput,
  VALID_BRIEFING_CURRENCIES,
} from "../../_shared/instruments.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

export const getRecentOrionBriefingsTool: GeminiFunctionDeclaration = {
  name: "get_recent_orion_briefings",
  description:
    `Retrieve Market Research briefings already sent to this user. ` +
    `Call this whenever the user references a briefing or alert you sent (past, just-delivered, or implicit). ` +
    `When the user references a briefing AND asks a market question, call this FIRST — do not paraphrase the briefing from the user's wording. ` +
    `Results include title, significance, plain-text body, timestamp, source URLs. ` +
    `Chain scrape_url on source URLs for deeper context.`,
  parameters: {
    type: "object",
    properties: {
      instrument: {
        type: "string",
        description:
          'Optional. Accepts: 3-letter currency code, natural name ("gold", "EUR/USD"), catalog symbol. Case-insensitive.',
      },
      since_hours: {
        type: "number",
        description:
          "Past N hours. Default 72. Ignored when since_date is set.",
      },
      since_date: {
        type: "string",
        description:
          'ISO date "YYYY-MM-DD". Briefings on/after this date. Overrides since_hours.',
      },
      until_date: {
        type: "string",
        description:
          'ISO date "YYYY-MM-DD". Briefings strictly before. Pair with since_date for single-day window.',
      },
      limit: {
        type: "number",
        description: "Max results. Default 10, max 30.",
      },
    },
    required: [],
  },
};

async function getRecentOrionBriefings(
  supabase: SupabaseClient,
  userId: string,
  sinceHours: number = 72,
  limit: number = 10,
  sinceDate?: string,
  untilDate?: string,
  instrument?: string,
): Promise<string> {
  try {
    const boundedLimit = Math.max(1, Math.min(30, Math.floor(limit)));
    // Date strings take precedence over sinceHours when provided.
    const sinceIso = sinceDate
      ? new Date(sinceDate).toISOString()
      : new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

    type FilterMode = "currency" | "instrument";
    let filterMode: FilterMode | undefined;
    let normalizedCurrency: string | undefined;
    let instrumentMatches: InstrumentCatalogEntry[] = [];

    if (instrument) {
      const resolved = resolveInstrumentInput(instrument);
      if (isBriefingCurrency(resolved)) {
        filterMode = "currency";
        normalizedCurrency = resolved.toUpperCase();
      } else {
        instrumentMatches = matchInstrumentCatalog(resolved);
        if (instrumentMatches.length === 0) {
          const validCurrencies = Array.from(VALID_BRIEFING_CURRENCIES).join(
            ", ",
          );
          const sample = INSTRUMENT_CATALOG.slice(0, 10)
            .map((e) => `${e.label} (${e.symbol})`)
            .join(", ");
          return (
            `Unknown instrument "${instrument}". Pass either a currency code ` +
            `(${validCurrencies}) for broad matching, a natural name ` +
            `("DXY", "gold", "EUR/USD", "Bitcoin"), or a catalog symbol ` +
            `("DX-Y.NYB", "GC=F", "EURUSD=X"). Examples: ${sample}.`
          );
        }
        filterMode = "instrument";
      }
    }

    let query = supabase
      .from("orion_task_results")
      .select(
        "id, task_type, significance, metadata, content_plain, created_at",
      )
      .eq("user_id", userId)
      // Drop search-outage rows (current + legacy serper outage flag).
      .not("metadata", "cs", '{"search_outage":true}')
      .not("metadata", "cs", '{"serper_outage":true}')
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    query = query.eq("task_type", "market_research");

    if (untilDate) {
      query = query.lt("created_at", new Date(untilDate).toISOString());
    }
    if (filterMode === "currency" && normalizedCurrency) {
      query = query.filter(
        "metadata",
        "cs",
        JSON.stringify({ currencies: [normalizedCurrency] }),
      );
    }
    if (filterMode === "instrument") {
      if (instrumentMatches.length === 1) {
        query = query.filter(
          "metadata",
          "cs",
          JSON.stringify({ symbols: [instrumentMatches[0].symbol] }),
        );
      } else {
        const orParts = instrumentMatches.map(
          (m) => `metadata.cs.${JSON.stringify({ symbols: [m.symbol] })}`,
        );
        query = query.or(orParts.join(","));
      }
    }

    const { data, error } = await query;

    if (error) {
      log(`Error fetching Orion briefings: ${error.message}`, "error");
      return `Failed to fetch briefings: ${error.message}`;
    }

    const rows = data ?? [];

    if (rows.length === 0) {
      const rangeDesc = sinceDate
        ? `between ${sinceDate}${
          untilDate ? ` and ${untilDate}` : " and now"
        }`
        : `in the last ${sinceHours} hours`;

      if (filterMode === "currency") {
        return `No market research briefings found exposing currency "${normalizedCurrency}" ${rangeDesc}. Try widening the date range.`;
      }
      if (filterMode === "instrument") {
        const matchSummary = instrumentMatches
          .slice(0, 5)
          .map((m) => `${m.label} (${m.symbol})`)
          .join(", ");
        return `No market research briefings found covering "${instrument}" ${rangeDesc}. Recognized as: ${matchSummary}. The user may not have had this instrument in their watchlist when briefings ran — try widening the date range or omitting the instrument filter.`;
      }
      return `No Market Research briefings found ${rangeDesc}.`;
    }

    interface BriefingCitation {
      url?: string;
      title?: string;
      source?: string;
    }

    const lines = rows.map((r, i) => {
      const meta = r.metadata as
        | { title?: string; citations?: BriefingCitation[] }
        | null;
      const title = meta?.title ?? "Briefing";
      const sig = r.significance ? r.significance.toUpperCase() : "—";
      const body = r.content_plain ?? "";

      const citations = Array.isArray(meta?.citations) ? meta!.citations : [];
      const sourceLines = citations
        .filter((c): c is BriefingCitation & { url: string } =>
          typeof c?.url === "string" && c.url.length > 0
        )
        .map((c) => {
          let domain = "";
          try {
            domain = new URL(c.url).hostname.replace(/^www\./, "");
          } catch { /* fall through with empty domain */ }
          const label = c.source || domain || "source";
          return c.title
            ? `      - ${label}: ${c.title} (${c.url})`
            : `      - ${label}: (${c.url})`;
        });
      const sourcesBlock = sourceLines.length > 0
        ? `\n    Sources:\n${sourceLines.join("\n")}`
        : "";

      return (
        `[${i + 1}] ${r.created_at} | ${r.task_type} | ${sig}\n` +
        `    Title: ${title}\n` +
        `    ${body}${sourcesBlock}`
      );
    });

    return `Found ${rows.length} Orion briefing${
      rows.length === 1 ? "" : "s"
    } in the last ${sinceHours}h:\n\n${lines.join("\n\n")}`;
  } catch (error) {
    return `Failed to fetch briefings: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeGetRecentOrionBriefings(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for Orion briefings lookup";
  const userId = context.userId || "";
  if (!userId) return "User ID not available in context";
  const sinceHours = typeof args.since_hours === "number"
    ? args.since_hours
    : 72;
  const limit = typeof args.limit === "number" ? args.limit : 10;
  const sinceDate = typeof args.since_date === "string"
    ? args.since_date
    : undefined;
  const untilDate = typeof args.until_date === "string"
    ? args.until_date
    : undefined;
  const instrument = typeof args.instrument === "string"
    ? args.instrument
    : undefined;
  return await getRecentOrionBriefings(
    supabase,
    userId,
    sinceHours,
    limit,
    sinceDate,
    untilDate,
    instrument,
  );
}
