/**
 * AI Trading Agent - Tool Definitions and Implementations
 * All custom tools (non-MCP) are defined and implemented here
 */

import { log } from "../_shared/supabase.ts";
import { fetchSerperScrape } from "../_shared/serperScrape.ts";
import { scrapeArticle } from "../_shared/scrapeProvider.ts";
import { tavilySearchNews, tavilySearchBreaking } from "../_shared/tavily.ts";
import { getMarketPrice, fetchYahooTimeSeries } from "../_shared/prices.ts";
import {
  fetchIndicator,
  fetchSymbolSearch,
  fetchTimeSeries,
  formatCandleLine,
  type Candle,
  type CandleInterval,
  type IndicatorName,
} from "../_shared/twelvedata.ts";
import {
  SLASH_COMMAND_TAG,
  AGENT_MEMORY_TAG,
} from "../_shared/noteTags.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Note } from "./types.ts";
import {
  applyRuleChange,
  type EpisodicEventType,
  type MemoryOp,
  type MemorySection,
  recallEvents,
  recordEvent,
  updateMemory,
} from "../_shared/memory/index.ts";
import {
  INSTRUMENT_CATALOG,
  type InstrumentCatalogEntry,
  isBriefingCurrency,
  matchInstrumentCatalog,
  resolveInstrumentInput,
  VALID_BRIEFING_CURRENCIES,
} from "../_shared/instruments.ts";

/**
 * Per-call context passed by edge-function entrypoints into the tool
 * dispatcher. The chat function passes the user's id + calendar (memory
 * is read-write); briefing-agent passes the same plus a restricted
 * `allowedMemoryOps` set so unattended jobs can't do destructive edits
 * without user-in-the-loop signal.
 */
export interface ToolContext {
  userId?: string;
  calendarId?: string;
  conversationId?: string;  // NEW: for set_reminder/list_reminders binding to current chat
  // When omitted, updateMemory defaults to all ops permitted.
  allowedMemoryOps?: Set<MemoryOp>;
}

/**
 * Gemini function declaration type
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * ============================================================================
 * TOOL DEFINITIONS
 * ============================================================================
 */

/**
 * Web search tool definition
 */
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
        description: 'Type: "search" or "news". Use "news" for market sentiment, breaking news, and current events.',
        enum: ["search", "news"],
      },
      time_range: {
        type: "string",
        description: 'Filter results by recency. Use "day" for breaking news/sentiment, "week" for recent analysis, "month" for broader research. Defaults to no filter.',
        enum: ["day", "week", "month"],
      },
    },
    required: ["query"],
  },
};

/**
 * URL scraping tool definition
 */
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

/**
 * Universal market data tool — action-dispatched. Replaces the former
 * get_market_price + get_market_history pair so Orion has a single mental
 * bucket ("market data") with sub-actions, matching the manage_* pattern.
 *
 * action="quote"     — current price + day stats (Twelve Data intraday primary,
 *                      Yahoo fallback, Frankfurter forex EOD last resort).
 * action="history"   — historical OHLC candles via Twelve Data /time_series
 *                      with Yahoo fallback for indices/futures/bonds/DXY.
 * action="indicator" — RSI/MACD/ATR/BBANDS/EMA/SMA/VWAP via Twelve Data
 *                      per-indicator endpoints. Free-tier coverage:
 *                      forex/US-stocks/crypto. VWAP is intraday-only.
 * action="search"    — fuzzy name-to-ticker resolution via /symbol_search.
 *
 * Future actions reserved: "earnings" (earnings calendar).
 */
export const getMarketDataTool: GeminiFunctionDeclaration = {
  name: "get_market_data",
  description:
    `Universal market data. Pick ONE \`action\`: "quote" (current price + day stats), "history" (OHLC candles for past dates / today's shape), "indicator" (RSI/MACD/ATR/BBANDS/EMA/SMA/VWAP), "search" (resolve company name → ticker). See TIER 4 MARKET DATA REFERENCE in the system prompt for the symbol catalog, indicator defaults, asset-class coverage caveats, and chart rules. Tool dispatcher validates per-action required params server-side.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["quote", "history", "indicator", "search"],
        description: "Sub-action. Default to 'quote' when no past-time / indicator / name-lookup intent.",
      },
      symbol: {
        type: "string",
        description: 'Catalog symbol (e.g. "EURUSD=X", "^GSPC", "GC=F", "BTC-USD", "AAPL"). Required for quote/history/indicator.',
      },
      indicator: {
        type: "string",
        enum: ["RSI", "MACD", "ATR", "BBANDS", "EMA", "SMA", "VWAP"],
        description: "Required for action='indicator'. Ignored otherwise.",
      },
      period: {
        type: "integer",
        description: "action='indicator' lookback. Defaults per indicator (RSI/ATR 14, BBANDS/EMA/SMA 20, VWAP 9). MACD ignores. Override when user names one.",
      },
      query: {
        type: "string",
        description: "action='search'. Free-text company / asset name.",
      },
      interval: {
        type: "string",
        enum: ["1min", "5min", "15min", "30min", "1h", "2h", "4h", "1day", "1week", "1month"],
        description: "REQUIRED for history + indicator. Pick coarsest that answers. Indices/futures/bonds/DXY: no 2h/4h. VWAP: intraday only.",
      },
      outputsize: {
        type: "integer",
        description: "history: 1–200 candles. indicator: 1–20 (default 1). Ignored if start_date+end_date set.",
      },
      start_date: {
        type: "string",
        description: 'action="history" window start. "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss". Pair with end_date.',
      },
      end_date: {
        type: "string",
        description: 'action="history" window end. Pair with start_date.',
      },
      include_chart: {
        type: "boolean",
        description: 'action="history". Attach candlestick chart below reply. Default false. Off for plain numeric lookups.',
      },
      chart_only: {
        type: "boolean",
        description: 'action="history". Skip OHLC dump, return chart only. Implies a chart. Use for "show me the chart" requests.',
      },
    },
    required: ["action"],
  },
};

/**
 * Chart generation tool definition
 */
export const generateChartTool: GeminiFunctionDeclaration = {
  name: "generate_chart",
  description:
    "Generate a chart visualization from data. Returns HTML with an embedded image that displays inline in the chat. Use this after querying trade data via MCP tools to create visual representations like equity curves, P&L over time, or performance metrics.",
  parameters: {
    type: "object",
    properties: {
      chart_type: {
        type: "string",
        description: "Type of chart to generate",
        enum: ["line", "bar"],
      },
      title: {
        type: "string",
        description: "Chart title",
      },
      x_label: {
        type: "string",
        description: "X-axis label",
      },
      y_label: {
        type: "string",
        description: "Y-axis label",
      },
      labels: {
        type: "array",
        description: "Array of X-axis labels (e.g., dates, times)",
        items: { type: "string" },
      },
      datasets: {
        type: "array",
        description:
          "Array of dataset objects with {label: string, data: array of numbers, color: string}",
        items: { type: "object" },
      },
    },
    required: ["chart_type", "title", "labels", "datasets"],
  },
};

/**
 * Update memory tool definition - dedicated tool for memory management with merge logic
 */
export const updateMemoryTool: GeminiFunctionDeclaration = {
  name: "update_memory",
  description:
    `Mutate persistent memory. op=ADD (default) appends bullets; UPDATE replaces one bullet via target_text+new_text; REMOVE deletes one via target_text; REPLACE_SECTION rewrites entire ACTIVE_FOCUS section. UPDATE/REMOVE need Jaccard ≥0.85 against an existing bullet. For rule-change / decision / correction triggers use apply_rule_change instead (atomic pairing). See TIER 3 in the system prompt for sections, format, and op routing.`,
  parameters: {
    type: "object",
    properties: {
      op: {
        type: "string",
        enum: ["ADD", "UPDATE", "REMOVE", "REPLACE_SECTION"],
        description:
          "Operation to apply. Defaults to ADD if omitted. UPDATE/REMOVE require target_text; UPDATE additionally requires new_text; ADD/REPLACE_SECTION require new_insights.",
      },
      section: {
        type: "string",
        enum: [
          "TRADER_PROFILE",
          "PERFORMANCE_PATTERNS",
          "STRATEGY_PREFERENCES",
          "PSYCHOLOGICAL_PATTERNS",
          "LESSONS_LEARNED",
          "ACTIVE_FOCUS",
        ],
        description: "Which section the op targets.",
      },
      new_insights: {
        type: "array",
        items: { type: "string" },
        description:
          "ADD: bullets to append. REPLACE_SECTION: the new ACTIVE_FOCUS contents.",
      },
      target_text: {
        type: "string",
        description:
          "UPDATE / REMOVE: text identifying the existing bullet to operate on. Fuzzy-matched against the section.",
      },
      new_text: {
        type: "string",
        description: "UPDATE: replacement text for the matched bullet.",
      },
    },
    required: ["section"],
  },
};

/**
 * apply_rule_change — atomic pairing of record_event + update_memory.
 *
 * Designed because Gemini's function-calling consistently emits one tool
 * per turn. Asking the model to coordinate record_event + update_memory
 * via prompt rules failed in practice — model logged the event but
 * skipped the memory mutation, leaving stale state. This tool collapses
 * both writes into a single decision point.
 */
export const applyRuleChangeTool: GeminiFunctionDeclaration = {
  name: "apply_rule_change",
  description:
    `ATOMIC PAIRING: logs episodic event AND mutates core memory in ONE call. Use for every user-stated rule change / decision / correction (trigger phrases + worked example in TIER 3 R1 of the system prompt). memory_op=UPDATE for changed facts (target_text+new_text), REMOVE for reversed preferences (target_text), ADD for genuinely-new rules (new_insights). If memory leg rejects (no match / multi-match), event still logs — retry memory via update_memory with sharper target_text.`,
  parameters: {
    type: "object",
    properties: {
      event_type: {
        type: "string",
        enum: ["rule_changed", "user_correction", "decision_made"],
      },
      summary: {
        type: "string",
        description: "Past-tense single sentence (≤500 chars) describing what happened. Goes to the episodic log.",
      },
      memory_op: {
        type: "string",
        enum: ["ADD", "UPDATE", "REMOVE"],
        description: "How to mutate core memory.",
      },
      memory_section: {
        type: "string",
        enum: [
          "TRADER_PROFILE",
          "PERFORMANCE_PATTERNS",
          "STRATEGY_PREFERENCES",
          "PSYCHOLOGICAL_PATTERNS",
          "LESSONS_LEARNED",
          "ACTIVE_FOCUS",
        ],
      },
      target_text: {
        type: "string",
        description: "UPDATE / REMOVE: text identifying the existing bullet to operate on.",
      },
      new_text: {
        type: "string",
        description: "UPDATE: replacement for the matched bullet.",
      },
      new_insights: {
        type: "array",
        items: { type: "string" },
        description: "ADD: bullets to append.",
      },
    },
    required: ["event_type", "summary", "memory_op", "memory_section"],
  },
};

/**
 * Get recent Orion task briefings tool definition
 */
export const getRecentOrionBriefingsTool: GeminiFunctionDeclaration = {
  name: "get_recent_orion_briefings",
  description: `Retrieve Orion task briefings already sent to this user (market_research / daily_analysis / weekly_review / monthly_rollup). Call this whenever the user references a briefing or alert you sent (past, just-delivered, or implicit). When the user references a briefing AND asks a market question, call this FIRST — do not paraphrase the briefing from the user's wording. Results include title, significance, task type, plain-text body, timestamp, source URLs. Chain scrape_url on source URLs for deeper context. See TIER 4 BRIEFING ALIASES in the system prompt for the instrument alias table.`,
  parameters: {
    type: "object",
    properties: {
      task_type: {
        type: "string",
        enum: ["market_research", "daily_analysis", "weekly_review", "monthly_rollup"],
        description: "Optional filter by briefing type.",
      },
      instrument: {
        type: "string",
        description: 'Optional. Only applies to market_research (daily/weekly/monthly lack instrument metadata). Accepts: 3-letter currency code, natural name ("gold", "EUR/USD"), catalog symbol, or alias (see TIER 4 BRIEFING ALIASES). Case-insensitive.',
      },
      since_hours: {
        type: "number",
        description: "Past N hours. Default 72. Ignored when since_date is set.",
      },
      since_date: {
        type: "string",
        description: 'ISO date "YYYY-MM-DD". Briefings on/after this date. Overrides since_hours.',
      },
      until_date: {
        type: "string",
        description: 'ISO date "YYYY-MM-DD". Briefings strictly before. Pair with since_date for single-day window.',
      },
      limit: {
        type: "number",
        description: "Max results. Default 10, max 30.",
      },
    },
    required: [],
  },
};

/**
 * Analyze trade image tool definition
 */
export const analyzeImageTool: GeminiFunctionDeclaration = {
  name: "analyze_image",
  description:
    "Analyze a stored trade image by its URL. Use this ONLY for image URLs retrieved from the database (e.g. trade.images[].url). Do NOT use this for images the user has directly attached to their message — those are already visible to you as inline images and you should describe them directly without calling this tool.",
  parameters: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description:
          "The URL of the image to analyze",
      },
      analysis_focus: {
        type: "string",
        description:
          "What to focus the analysis on: 'general' for non-chart images (screenshots, diagrams, notes), or chart-specific: entry, exit, patterns, levels, overview",
        enum: ["general", "entry", "exit", "patterns", "levels", "overview"],
      },
      trade_context: {
        type: "string",
        description:
          'Optional context to help interpret the image (e.g., "Long EUR/USD, won 2R" for charts, or "Risk management rules" for note images)',
      },
    },
    required: ["image_url"],
  },
};

/**
 * ============================================================================
 * MERGED (ACTION-DISPATCHED) TOOL DEFINITIONS
 *
 * These collapse former CRUD clusters into single declarations to keep the
 * Gemini function registry small (fewer declarations = better tool selection
 * + lower fixed prompt cost). Each carries a required `action` enum; the
 * executor re-dispatches to the original per-action handler.
 * ============================================================================
 */

/** manage_note — replaces create_note / update_note / delete_note / search_notes */
export const manageNoteTool: GeminiFunctionDeclaration = {
  name: "manage_note",
  description:
    `CRUD on user's trading-calendar notes. action="search" (search_query and/or tags; at session start search tags:["${AGENT_MEMORY_TAG}"] to load memory), "create" (title + content plain-text; optional tags + reminder), "update" (note_id; incremental via content_mode or full via content; AI-created notes + ${SLASH_COMMAND_TAG} notes only), "delete" (note_id; same scope as update). ⚠️ ${AGENT_MEMORY_TAG} notes are NOT writeable here — use update_memory. See TIER 4 SCHEMA_REFERENCE for the available tag list.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "create", "update", "delete"],
        description: "Which note operation to perform.",
      },
      note_id: { type: "string", description: "Target note id (update/delete)." },
      title: { type: "string", description: "Note title (create; optional on update)." },
      content: {
        type: "string",
        description:
          "Plain-text note body, no HTML. On create: required. On update: FULL replacement (destructive) — prefer content_mode for partial edits.",
      },
      content_mode: {
        type: "string",
        enum: ["append", "replace", "remove"],
        description: "Incremental update mode. Mutually exclusive with `content`. Not allowed on rich-text (Draft.js) notes.",
      },
      content_text: { type: "string", description: "New text for content_mode append/replace." },
      content_old_text: { type: "string", description: "Exact unique substring to find, for content_mode replace/remove." },
      replace_full_content: { type: "boolean", description: "Confirmation flag required to overwrite a SLASH_COMMAND note via `content`." },
      search_query: { type: "string", description: "Text filter for action=search." },
      include_archived: { type: "boolean", description: "Include archived notes in search (default false)." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: `Tags to filter by (search) or set (create/update). Notes must have ALL given tags when searching.`,
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description: '"none" / "once" (uses reminder_date) / "weekly" (uses reminder_days). Use "none" on update to clear.',
      },
      reminder_date: { type: "string", description: 'ISO date (YYYY-MM-DD) for reminder_type="once".' },
      reminder_days: {
        type: "array",
        items: { type: "string", enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
        description: 'Day abbreviations for reminder_type="weekly", e.g. ["Mon","Wed","Fri"].',
      },
    },
    required: ["action"],
  },
};

/** manage_event — replaces record_event / recall_events (episodic log) */
export const manageEventTool: GeminiFunctionDeclaration = {
  name: "manage_event",
  description:
    `Episodic event log — time-stamped facts about what happened (distinct from update_memory's stable profile). action="record" appends (event_type + ≤500-char past-tense summary; for rule changes / corrections / decisions prefer apply_rule_change instead — only use record here for pattern_observed / strategy_discussion). action="recall" queries — REQUIRES ≥1 filter (event_types | tags | since | query). Empty recall IS the answer; do not fall back to other tools. See TIER 3 Episodic Memory for trigger table.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "recall"], description: "Write a new event or query existing ones." },
      event_type: {
        type: "string",
        enum: ["pattern_observed", "user_correction", "strategy_discussion", "decision_made", "rule_changed"],
        description: "Kind of event (action=record).",
      },
      summary: { type: "string", description: "Past-tense single sentence, ≤500 chars (action=record)." },
      metadata: { type: "object", description: "Optional structured context (trade_ids, source_note_id, confidence…) — action=record." },
      event_types: {
        type: "array",
        items: { type: "string", enum: ["pattern_observed", "user_correction", "strategy_discussion", "decision_made", "rule_changed"] },
        description: "Filter recall to these event types.",
      },
      since: { type: "string", description: "ISO timestamp — recall events on/after this (action=recall)." },
      query: { type: "string", description: "Case-insensitive substring match on summary (action=recall)." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "record: tags to attach. recall: match events containing ALL these tags.",
      },
      limit: { type: "number", description: "Max events to return for action=recall (1..50, default 10)." },
    },
    required: ["action"],
  },
};

/** manage_tag — replaces get_tag_definition / save_tag_definition */
export const manageTagTool: GeminiFunctionDeclaration = {
  name: "manage_tag",
  description:
    `Look up or save the user's definition for a custom trading tag (e.g. "Confluence:3x Displacement", "Setup:ICT OTE"). Pick ONE \`action\`:

- action="get" — fetch the user's explanation of what \`tag_name\` means, or null if undefined. Call this when you hit a tag you don't understand.
- action="save" — store/overwrite a definition. Needs \`tag_name\` + \`definition\`. ⚠️ ONLY after the user gives explicit permission — suggest a definition, wait for confirmation, then save.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["get", "save"], description: "Look up or save a tag definition." },
      tag_name: { type: "string", description: "Exact tag name." },
      definition: { type: "string", description: "Meaning of the tag (action=save only)." },
    },
    required: ["action", "tag_name"],
  },
};

/** recall_conversations — replaces search_conversations / get_conversation */
export const recallConversationsTool: GeminiFunctionDeclaration = {
  name: "recall_conversations",
  description:
    `Search past chat conversations with this user, or fetch one's full transcript. Pick ONE \`action\`:

- action="search" — keyword search over conversation titles + message content. Needs \`query\`. Optional \`since_days\` (default 30), \`limit\` (default 5, max 10). Returns lightweight metadata: [{ id, title, message_count, created_at, updated_at, snippet }] — NOT full bodies.
- action="get" — fetch the full transcript of one conversation. Needs \`conversation_id\` (from a prior search — do NOT guess ids). Capped at 50 messages; formatted as "user:" / "orion:" turns with timestamps.

ONLY use when the user explicitly references a past chat ("last time", "yesterday we discussed", "you told me before", "show me what we said about X"). For structured "what happened / when did" questions, prefer manage_event(action="recall") — faster and more precise. ${AGENT_MEMORY_TAG} notes (manage_note search) remain the primary long-term memory.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["search", "get"], description: "Search conversations or fetch one transcript." },
      query: { type: "string", description: "Search term against titles + message content (action=search)." },
      since_days: { type: "number", description: "Only conversations updated in the last N days (action=search, default 30)." },
      limit: { type: "number", description: "Max conversations to return (action=search, default 5, max 10)." },
      conversation_id: { type: "string", description: "Conversation id from a search result (action=get)." },
    },
    required: ["action"],
  },
};

/** manage_reminder — replaces set_reminder / list_reminders / cancel_reminder */
export const manageReminderTool: GeminiFunctionDeclaration = {
  name: "manage_reminder",
  description:
    `Schedule, list, or cancel future Orion turns in this conversation. Pick ONE \`action\`:

- action="set" — schedule one OR many reminders in a single call. Pass \`reminders\` as an array (1–12 items). Each item: \`{trigger_at, instructions, description?}\`. \`trigger_at\` is an ISO timestamp — resolve it FIRST (econ events via execute_sql on economic_events; relative times computed from now). For econ release reminders, trigger_at = event_time_utc + 20s buffer so actuals land before fire. \`instructions\` is what Orion should do at fire time. Use the batch shape to set polling loops in one turn ("monitor EURUSD every 5min for 30min" → 6 items at +5/+10/+15/+20/+25/+30) or to set several event reminders at once. Only when the user EXPLICITLY asks ("remind me", "set a reminder", "schedule", "monitor every X for Y"). Confirm the schedule to the user. Casual self-talk ("I should remember to…") → ASK first. Result has \`created[]\` + \`failed[]\` — partial success is normal. Surface what got scheduled AND each failed item's reason; DO NOT silently retry failed items. When >1 reminder is inserted, the result also carries a server-assigned \`batch_id\` that groups every row in this call — REMEMBER it (it surfaces again at fire time and is the key to cancelling the whole loop later). USER-FACING VOCAB: NEVER speak the batch_id, the word "batch", or "batch id" to the user. The batch_id is internal infrastructure — describe the schedule naturally ("I'll check every 5 minutes for the next 30 minutes" / "scheduled 3 reminders before the events you mentioned"). Showing the UUID leaks tooling.
- action="list" — show the user's pending reminders across all conversations. No other params. Empty result means none — say so directly, don't double-check.
- action="cancel" — pass EITHER \`id\` (cancel one reminder) OR \`batch_id\` (cancel every pending sibling in the same batch atomically). NEVER pass both. Use \`batch_id\` when the user wants to stop a loop / multi-event batch ("cancel that monitoring", "stop the every-5min checks") so unrelated reminders in the same conversation are not touched. Use \`id\` only when the user names a single specific reminder. Ambiguity rule: if user phrasing is vague ("cancel that", "never mind that one") AND the candidate reminder has a non-null batch_id with pending siblings, ASK first ("cancel just this fire or the whole schedule?") — do not guess. Call action="list" first if disambiguation is needed. USER-FACING VOCAB: describe the cancellation naturally ("cancelled the monitoring" / "ended the schedule" / "stopped the price watch"); NEVER say "batch", "batch_id", or speak the UUID.
- action="edit" — modify PENDING reminders. Two modes (mutually exclusive):
  * single: pass \`id\` + any of \`trigger_at\` / \`instructions\` / \`description\`. Reschedules / rewrites one row. Use when user asks to push or reword a specific reminder, OR when YOU (Orion) want to refine a single fire's instructions at fire time based on what you've observed.
  * batch: pass \`batch_id\` + \`shift_minutes\` (positive or negative, shifts every pending sibling) and/or \`instructions\` (replaces instructions on every pending sibling). Use to tighten/loosen a polling loop ("tighten next 3 checks from 5min to 1min" → shift the remaining triggers earlier) or to push the whole loop past upcoming news.
  Autonomy contract: you MAY edit pending reminders WITHOUT asking the user first when you notice something mid-schedule (during a fire OR between fires) that justifies adapting — volatility spike → tighten interval, macro release moved → shift, news landed early → push remaining checks. You MUST announce the change AND the reason in your reply ("Spotted absorption at 1.1708 — tightening the next 3 checks to 1-minute intervals"). Silent edits = goal drift, forbidden. Same USER-FACING VOCAB rule applies: NEVER speak the batch_id; describe the schedule naturally. Firing/fired/cancelled rows are untouchable; only pending rows update. Editable fields are whitelisted (trigger_at, instructions, description, shift_minutes) — status, ownership, and batch_id itself are immutable.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["set", "list", "cancel", "edit"], description: "Schedule, list, cancel, or edit a reminder." },
      reminders: {
        type: "array",
        description: "Reminders to schedule (action=set). 1–12 items. Single reminder is still a 1-element array.",
        items: {
          type: "object",
          properties: {
            trigger_at: { type: "string", description: "ISO timestamp when this reminder fires (future, within 1 year)." },
            instructions: { type: "string", description: "What Orion should do when this reminder fires (1–1000 chars)." },
            description: { type: "string", description: "Optional short label (<=200 chars)." },
          },
          required: ["trigger_at", "instructions"],
        },
      },
      id: { type: "string", description: "Reminder id (action=cancel or action=edit single mode). Mutually exclusive with batch_id." },
      batch_id: { type: "string", description: "Batch id (action=cancel atomic batch cancel, or action=edit batch mode). Mutually exclusive with id." },
      trigger_at: { type: "string", description: "New ISO timestamp (action=edit single mode ONLY — rejected if combined with batch_id; use shift_minutes for batch edits)." },
      instructions: { type: "string", description: "New instructions text 1-1000 chars (action=edit, single or batch mode)." },
      description: { type: "string", description: "New short label <=200 chars (action=edit single mode ONLY — per-row, rejected if combined with batch_id)." },
      shift_minutes: { type: "number", description: "Minutes to add to every pending sibling's trigger_at (action=edit batch mode ONLY — rejected if combined with id). Negative tightens (earlier), positive loosens/pushes (later). Validated to keep all rows within (now, now+1y)." },
    },
    required: ["action"],
  },
};

/**
 * ============================================================================
 * TOOL IMPLEMENTATIONS
 * ============================================================================
 */

/**
 * Execute web search with Serper primary + Tavily fallback.
 *
 * Serper is the primary provider (Google index, knowledge-graph support, no
 * day-granularity limit). Tavily falls in when Serper is unavailable, errors,
 * or returns nothing — preserves chat reliability if SERPER_API_KEY is
 * missing or quota-exhausted, and gives a second-chance index lookup for
 * obscure queries Google didn't surface.
 */
export async function executeWebSearch(
  query: string,
  searchType: string = "search",
  timeRange?: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const serperResult = await trySerperSearch(query, searchType, timeRange);
  if (serperResult) return serperResult;

  if (supabase) {
    const tavilyResult = await tryTavilySearch(supabase, query, searchType, timeRange);
    if (tavilyResult) return tavilyResult;
  }

  return `⚠️ NO RESULTS FOUND for query: "${query}". Try different search terms or use your market knowledge.`;
}

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
    const tavilyTimeRange: "qdr:h" | "qdr:d" | "qdr:w" =
      timeRange === "week" ? "qdr:w" :
      timeRange === "month" ? "qdr:w" :
      "qdr:d";

    // News-type chat searches → Tavily news topic; everything else → general.
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

/**
 * Scrape URL content using Tavily Extract with Serper fallback.
 *
 * Tavily Extract is the primary path (LLM-tuned content, free 10-key pool);
 * Serper scrape is the fallback when Tavily can't render a URL (dynamic JS
 * pages, pool exhausted, transient extract failure). The shared DB cache is
 * keyed by URL so a successful scrape from either provider serves any future
 * call — the second cache check on the fallback path is a no-op miss but
 * cheap (sub-ms point-read on the indexed url column).
 *
 * When no service-role client is available (rare — only when called outside
 * the tool-executor), falls through to the raw uncached Serper fetcher
 * because Tavily's path requires a client to acquire pool keys.
 */
export async function scrapeUrl(
  url: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const article = supabase
    ? (await scrapeArticle(supabase, url, 3600, 'tavily'))
      ?? (await scrapeArticle(supabase, url, 3600, 'serper'))
    : await fetchSerperScrape(url);
  if (!article) {
    return `URL scraping failed or returned no content for: ${url}`;
  }
  let result = `Content from: ${article.url}\n\n`;
  if (article.title) result += `Title: ${article.title}\n\n`;
  result += `Content:\n${article.text}`;
  return result;
}

/**
 * Get forex exchange rate using Frankfurter API
 */
export async function getForexPrice(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<string> {
  try {
    // Normalize currency codes to uppercase
    baseCurrency = baseCurrency.toUpperCase().trim();
    quoteCurrency = quoteCurrency.toUpperCase().trim();

    const url =
      `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${quoteCurrency}`;

    const response = await fetch(url);

    if (!response.ok) {
      return `Failed to fetch forex rate: ${response.status}. Make sure currency codes are valid (e.g., EUR, USD, GBP, JPY).`;
    }

    const data = await response.json();

    if (!data.rates || !data.rates[quoteCurrency]) {
      return `Forex pair ${baseCurrency}/${quoteCurrency} not found. Supported currencies: EUR, USD, GBP, JPY, CHF, CAD, AUD, NZD, and more.`;
    }

    const rate = data.rates[quoteCurrency];
    const date = data.date;

    let result = `${baseCurrency}/${quoteCurrency} Forex Rate:\n\n`;
    result += `💱 Exchange Rate: ${rate.toFixed(5)}\n`;
    result += `📅 Date: ${date}\n`;
    result += `\n1 ${baseCurrency} = ${rate.toFixed(5)} ${quoteCurrency}\n`;

    return result;
  } catch (error) {
    return `Forex rate error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Universal price lookup with fallback chain:
 *   1. Twelve Data (intraday — forex, US stocks, crypto) via shared cache
 *   2. Yahoo Finance (intraday — all asset classes, incl. indices/futures/bonds)
 *   3. Frankfurter/ECB (forex only, end-of-day reference rate — last resort)
 *
 * Each result carries a freshness label so the model adjusts language
 * ("live intraday" vs "end-of-day reference rate").
 */
export async function executeGetMarketPrice(
  symbol: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const trimmed = symbol.trim();
  if (!trimmed) return "Symbol is required.";

  // --- Primary: Twelve Data → Yahoo fallback (chosen inside getMarketPrice) ---
  if (supabase) {
    const snap = await getMarketPrice(supabase, trimmed);
    if (snap) {
      const dp = snap.price < 10 ? 5 : 2;
      const arrow = snap.percentChange >= 0 ? "▲" : "▼";
      const priceStr = snap.price.toLocaleString("en-US", {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });
      return [
        `${snap.displayName} (${snap.symbol})`,
        `Freshness: live intraday`,
        ``,
        `Price: ${priceStr} ${snap.currency}`,
        `Day change: ${arrow} ${snap.percentChange.toFixed(2)}%`,
        `Day range: ${snap.dayLow.toFixed(dp)} – ${snap.dayHigh.toFixed(dp)}`,
        `Previous close: ${snap.previousClose.toFixed(dp)}`,
      ].join("\n");
    }
  }

  log(`Primary price miss for ${trimmed}, trying forex EOD fallback`, "info");

  // --- Last resort: Frankfurter/ECB for forex symbols (EURUSD=X → EUR/USD) ---
  if (trimmed.endsWith("=X") && trimmed.length >= 8) {
    const pair = trimmed.replace("=X", "");
    const base = pair.substring(0, 3);
    const quote = pair.substring(3, 6);
    if (base.length === 3 && quote.length === 3) {
      const result = await getForexPrice(base, quote);
      if (!result.startsWith("Forex rate error") && !result.startsWith("Failed")) {
        return (
          result +
          "\n⚠️ Freshness: end-of-day reference rate (NOT intraday). " +
          "This is the last published daily rate, not a live quote. " +
          "Do NOT present this as a current or real-time price."
        );
      }
    }
  }

  return `Could not fetch price for "${trimmed}". All data sources failed or the symbol is unrecognized.`;
}

/**
 * Historical OHLC executor — Yahoo-format symbol → Twelve Data /time_series.
 * Returns compact lines, oldest→newest, capped per call.
 *
 * Two caps: the text path is bounded by MAX_CANDLES (each OHLC line ≈ 28
 * tokens, so 200 ≈ 5.6k tokens). chart_only has no text dump, so the only
 * constraint is a renderable/POST-able chart — MAX_CHART_CANDLES is much
 * higher (a full day of 5-min bars ≈ 288, a week ≈ 2000).
 */
const MAX_CANDLES = 200;
const MAX_CHART_CANDLES = 2000;

const VALID_INTERVALS: readonly CandleInterval[] = [
  "1min", "5min", "15min", "30min",
  "1h", "2h", "4h", "1day", "1week", "1month",
] as const;

function isCandleInterval(v: string): v is CandleInterval {
  return (VALID_INTERVALS as readonly string[]).includes(v);
}

const INTERVAL_MINUTES: Record<CandleInterval, number> = {
  "1min": 1, "5min": 5, "15min": 15, "30min": 30,
  "1h": 60, "2h": 120, "4h": 240,
  "1day": 1440, "1week": 10080, "1month": 43200,
};

// When a window is too granular, point Orion at the next sensible step up.
const SUGGEST_COARSER: Record<CandleInterval, CandleInterval> = {
  "1min": "30min", "5min": "1h", "15min": "1h", "30min": "4h",
  "1h": "4h", "2h": "1day", "4h": "1day",
  "1day": "1week", "1week": "1month", "1month": "1month",
};

/**
 * Conservative estimate of how many candles a [start, end] window spans at the
 * given interval. Treats the market as 24/7 (overestimates for equities — that's
 * the safe direction, we'd rather nudge than flood). Returns null if the dates
 * don't parse or the window is empty/inverted.
 */
function estimateWindowBars(
  interval: CandleInterval,
  startDate: string,
  endDate: string,
): number | null {
  const parse = (d: string) =>
    Date.parse(d.includes(" ") ? d.replace(" ", "T") : d);
  const start = parse(startDate);
  const end = parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.ceil((end - start) / 60000 / INTERVAL_MINUTES[interval]);
}

// Minimum candles before we bother rendering a chart — fewer than 3 is just
// numbers, no shape to read.
const CHART_MIN_CANDLES = 3;

/**
 * Render an OHLC candlestick via QuickChart `/chart/create`, return the short
 * URL. Failures (network, rate limit, plugin error) return null silently so
 * the data text response still ships.
 */
async function buildHistoryChartUrl(
  symbol: string,
  interval: string,
  candles: Candle[],
): Promise<string | null> {
  if (candles.length < CHART_MIN_CANDLES) return null;

  // Symbol pretty-print for the title (Orion never sees this).
  let label = symbol;
  if (/^[A-Z]{6}=X$/.test(symbol)) {
    label = `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`;
  } else if (/^[A-Z0-9]+-(USD|USDT|EUR)$/.test(symbol)) {
    label = symbol.replace("-", "/");
  }

  // Convert "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" (UTC) → unix ms.
  const points: Array<
    { x: number; o: number; h: number; l: number; c: number }
  > = [];
  for (const cdl of candles) {
    const iso = cdl.datetime.includes(" ")
      ? `${cdl.datetime.replace(" ", "T")}Z`
      : `${cdl.datetime}T00:00:00Z`;
    const x = Date.parse(iso);
    if (Number.isNaN(x)) continue;
    points.push({ x, o: cdl.open, h: cdl.high, l: cdl.low, c: cdl.close });
  }
  if (points.length < CHART_MIN_CANDLES) return null;

  // TradingView-style palette: mint up, dark navy down, light grey canvas.
  const spec = {
    type: "candlestick",
    data: {
      datasets: [{
        label: `${label} ${interval}`,
        data: points,
        color: { up: "#26A69A", down: "#2A2E39", unchanged: "#26A69A" },
        borderColor: { up: "#26A69A", down: "#2A2E39", unchanged: "#26A69A" },
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${label} ${interval}`,
          color: "#2A2E39",
        },
      },
      scales: {
        x: {
          type: "time",
          grid: { color: "rgba(42,46,57,0.08)" },
          ticks: { color: "#2A2E39" },
        },
        y: {
          position: "right",
          grid: { color: "rgba(42,46,57,0.08)" },
          ticks: { color: "#2A2E39" },
        },
      },
    },
  };

  const body = {
    version: "4",
    backgroundColor: "#D1D4DC",
    width: 1100,
    height: 500,
    format: "png",
    chart: spec,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://quickchart.io/chart/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      log(`QuickChart create HTTP ${res.status} for ${symbol}`, "warn");
      return null;
    }
    const j = (await res.json()) as { success?: boolean; url?: string };
    if (!j.success || !j.url) return null;
    return j.url;
  } catch (err) {
    log(`QuickChart create exception for ${symbol}`, "warn", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeGetMarketHistory(args: {
  symbol: string;
  interval: string;
  outputsize?: number;
  start_date?: string;
  end_date?: string;
  chart_only?: boolean;
  include_chart?: boolean;
}): Promise<string> {
  const symbol = (args.symbol || "").trim();
  if (!symbol) return "Symbol is required.";

  const interval = (args.interval || "").trim();
  if (!isCandleInterval(interval)) {
    return `Invalid interval "${interval}". Valid: ${VALID_INTERVALS.join(", ")}.`;
  }

  // Range: prefer explicit start/end; else outputsize; else 30.
  const hasWindow = !!(args.start_date && args.end_date);

  // chart_only renders an image with no OHLC text dump → the token budget
  // doesn't apply, so allow far more bars (a full day of 5-min ≈ 288).
  const candleCap = args.chart_only ? MAX_CHART_CANDLES : MAX_CANDLES;

  // Reject windows that would blow past the cap BEFORE spending an API credit —
  // nudge Orion to a coarser interval instead of silently truncating.
  if (hasWindow) {
    const est = estimateWindowBars(interval, args.start_date!, args.end_date!);
    if (est !== null && est > candleCap) {
      const coarser = SUGGEST_COARSER[interval];
      return (
        `That window at ${interval} is roughly ${est} candles — over the ` +
        `${candleCap}-candle limit. Use a coarser interval (try ${coarser}) ` +
        `or narrow the window.`
      );
    }
  }

  const wantSize = Math.min(args.outputsize ?? 30, candleCap);
  const outputsize = hasWindow ? undefined : wantSize;

  // Unix [period1, period2] window — needed for the Yahoo fallback. For
  // outputsize mode we pad the lookback 3× to absorb weekends/holidays, then
  // slice down after fetching.
  const nowSec = Math.floor(Date.now() / 1000);
  const parseSec = (d: string): number => {
    const ms = Date.parse(d.includes(" ") ? d.replace(" ", "T") : d);
    return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
  };
  const period2 = hasWindow ? parseSec(args.end_date!) : nowSec;
  const period1 = hasWindow
    ? parseSec(args.start_date!)
    : nowSec - wantSize * 3 * INTERVAL_MINUTES[interval] * 60;

  // Primary: Twelve Data (forex / US stocks / crypto). Newest→oldest order.
  let candles: Candle[] | null = await fetchTimeSeries(symbol, {
    interval,
    outputsize,
    startDate: args.start_date,
    endDate: args.end_date,
  });
  let chronological = false; // Twelve Data is newest→oldest

  // Fallback: Yahoo (DXY, indices, futures, bonds — everything Twelve can't do).
  // Yahoo returns oldest→newest.
  if (candles === null && !Number.isNaN(period1) && !Number.isNaN(period2)) {
    candles = await fetchYahooTimeSeries(symbol, { interval, period1, period2 });
    chronological = true;
  }

  if (candles === null) {
    if (interval === "2h" || interval === "4h") {
      return (
        `Could not fetch ${interval} history for "${symbol}". The ${interval} ` +
        `granularity isn't available for this instrument — use 1h or 1day.`
      );
    }
    return (
      `Could not fetch history for "${symbol}". The symbol may be unrecognized ` +
      `or the data source is unavailable. Try action="quote" for the current value.`
    );
  }
  if (candles.length === 0) {
    const win =
      hasWindow ? `${args.start_date} → ${args.end_date}` : "requested window";
    return (
      `No data for ${symbol} at ${interval} over ${win}. ` +
      `Likely the market was closed (weekend, holiday, pre-market) or the ` +
      `window is older than the intraday history limit. Try the nearest open ` +
      `trading day, or a coarser interval (1day goes back decades).`
    );
  }

  // Normalize to oldest→newest, then cap. For outputsize mode keep the last
  // `wantSize`; for window mode keep the last `candleCap`.
  const asc = chronological ? [...candles] : [...candles].reverse();
  const keep = hasWindow ? candleCap : wantSize;
  const ordered = asc.slice(-keep);
  const truncatedNote =
    asc.length > ordered.length
      ? `\n(showing last ${ordered.length} of ${asc.length} candles)`
      : "";

  // Render a chart only when asked: chart_only mode always wants one;
  // include_chart=true is the opt-in for the data+chart case. Skip the
  // QuickChart round-trip otherwise. (< CHART_MIN_CANDLES never renders.)
  const wantChart = args.chart_only || args.include_chart;
  const chartUrl = wantChart
    ? await buildHistoryChartUrl(symbol, interval, ordered)
    : null;

  // chart_only mode: skip the OHLC text dump entirely, return just the chart
  // URL. Saves ~1.5k tokens of context when the user only wants the picture.
  if (args.chart_only) {
    if (!chartUrl) {
      if (ordered.length < CHART_MIN_CANDLES) {
        return (
          `Only ${ordered.length} candle(s) in the window — too few to render ` +
          `a chart. Widen the window or set chart_only=false to see the data.`
        );
      }
      return (
        `Chart render failed for ${symbol} ${interval}. ` +
        `Retry, or set chart_only=false to get the OHLC data instead.`
      );
    }
    return `${symbol} ${interval} — ${ordered.length} candles\nChart: ${chartUrl}`;
  }

  const header = `${symbol} ${interval} — ${ordered.length} candles:`;
  const lines = ordered.map((c) => `  ${formatCandleLine(c)}`).join("\n");
  const chartLine = chartUrl ? `\nChart: ${chartUrl}` : "";
  return `${header}\n${lines}${truncatedNote}${chartLine}`;
}

// ============================================================================
// get_market_data action="indicator" — RSI / MACD / ATR / BBANDS / EMA / SMA / VWAP
// ============================================================================

const VALID_INDICATORS: ReadonlySet<IndicatorName> = new Set([
  "RSI",
  "MACD",
  "ATR",
  "BBANDS",
  "EMA",
  "SMA",
  "VWAP",
]);

const INDICATOR_DEFAULT_PERIOD: Record<IndicatorName, number> = {
  RSI: 14,
  ATR: 14,
  BBANDS: 20,
  EMA: 20,  // 20-period default — user names 50/200 when they want trend filter
  SMA: 20,  // same as EMA — period is the meaningful axis (20/50/200)
  VWAP: 9,  // TD /vwap default — moving VWAP over the last 9 bars
  MACD: 0,  // unused — MACD uses fast/slow/signal internally
};

function formatIndicatorLine(
  indicator: IndicatorName,
  datetime: string,
  values: Record<string, number>,
): string {
  // Format precision: indicators on percent/oscillator scale (RSI/MACD hist)
  // get 2dp; price-scale (ATR, BBands) gets 4dp.
  const dp2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "n/a");
  const dp4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "n/a");
  switch (indicator) {
    case "RSI":
      return `${datetime}: RSI ${dp2(values.value)}`;
    case "ATR":
      return `${datetime}: ATR ${dp4(values.value)}`;
    case "EMA":
      return `${datetime}: EMA ${dp4(values.value)}`;
    case "SMA":
      return `${datetime}: SMA ${dp4(values.value)}`;
    case "VWAP":
      return `${datetime}: VWAP ${dp4(values.value)}`;
    case "MACD":
      return (
        `${datetime}: MACD ${dp4(values.macd)} ` +
        `signal ${dp4(values.signal)} hist ${dp4(values.hist)}`
      );
    case "BBANDS":
      return (
        `${datetime}: BB upper ${dp4(values.upper)} ` +
        `mid ${dp4(values.middle)} lower ${dp4(values.lower)}`
      );
  }
}

export async function executeGetIndicator(args: {
  symbol: string;
  indicator: string;
  interval: string;
  period?: number;
  outputsize?: number;
}): Promise<string> {
  const symbol = (args.symbol || "").trim();
  if (!symbol) return "Symbol is required.";

  const indicator = (args.indicator || "").trim().toUpperCase() as IndicatorName;
  if (!VALID_INDICATORS.has(indicator)) {
    return (
      `Invalid indicator "${args.indicator}". ` +
      `Valid: ${Array.from(VALID_INDICATORS).join(", ")}.`
    );
  }

  const interval = (args.interval || "").trim();
  if (!isCandleInterval(interval)) {
    return `Invalid interval "${interval}". Valid: ${VALID_INTERVALS.join(", ")}.`;
  }

  // Default to 1 point — just the latest reading is usually what's asked.
  // Cap at 20 to keep token cost bounded (a 20-point RSI series is plenty
  // for "show me the trend").
  const outputsize = Math.max(
    1,
    Math.min(20, Number.isFinite(args.outputsize) ? Number(args.outputsize) : 1),
  );

  const period = Number.isFinite(args.period)
    ? Number(args.period)
    : INDICATOR_DEFAULT_PERIOD[indicator];

  const points = await fetchIndicator(symbol, indicator, {
    interval: interval as CandleInterval,
    period: period > 0 ? period : undefined,
    outputsize,
  });

  if (points === null) {
    return (
      `Could not fetch ${indicator} for "${symbol}". ` +
      `Coverage on free tier is forex / US stocks / crypto only — indices ` +
      `(^GSPC…), futures (GC=F…), bonds (^TNX…), and DXY (DX-Y.NYB) aren't ` +
      `supported here. For those, fetch action="history" candles instead and ` +
      `reason about levels manually.`
    );
  }
  if (points.length === 0) {
    return (
      `No ${indicator} data for "${symbol}" at ${interval}. ` +
      `Likely the market was closed or the interval has no recent bars.`
    );
  }

  // Oldest → newest in the rendered output (matches history convention).
  const asc = [...points].reverse();
  const periodLabel =
    indicator === "MACD" ? "fast=12 slow=26 signal=9" : `period ${period}`;
  const header =
    `${symbol} ${indicator} (${periodLabel}, ${interval}) — ` +
    `${asc.length} point${asc.length === 1 ? "" : "s"}:`;
  const lines = asc
    .map((p) => `  ${formatIndicatorLine(indicator, p.datetime, p.values)}`)
    .join("\n");
  return `${header}\n${lines}`;
}

// ============================================================================
// get_market_data action="search" — symbol fuzzy resolution
// ============================================================================

export async function executeSymbolSearch(args: {
  query: string;
}): Promise<string> {
  const q = (args.query || "").trim();
  if (!q) return "Query is required for action=\"search\".";

  const matches = await fetchSymbolSearch(q, 10);
  if (matches === null) {
    return (
      `Symbol search failed for "${q}". The data source may be unavailable — ` +
      `retry shortly, or pass the catalog symbol directly if you know it.`
    );
  }
  if (matches.length === 0) {
    return `No symbols matched "${q}". Try a different spelling or use the catalog form (e.g. "AAPL", "EURUSD=X").`;
  }

  // Cap formatted output at 8 even though we requested 10 — keeps reply
  // compact; Orion almost always wants the top 1-3.
  const top = matches.slice(0, 8);
  const lines = top
    .map((m) => {
      const tail = [m.exchange, m.country, m.type].filter(Boolean).join(", ");
      const name = m.instrumentName ? ` — ${m.instrumentName}` : "";
      return `  ${m.symbol}${name}${tail ? ` (${tail})` : ""}`;
    })
    .join("\n");
  return `Matches for "${q}" (top ${top.length}):\n${lines}`;
}

/**
 * Generate chart using QuickChart API
 */
export async function generateChart(
  chartType: string,
  title: string,
  xLabel: string,
  yLabel: string,
  labels: unknown[],
  datasets: unknown[],
): Promise<string> {
  try {
    // Validate chart type
    if (!["line", "bar"].includes(chartType)) {
      return 'Invalid chart type. Use "line" or "bar".';
    }

    // Build Chart.js configuration
    const chartConfig = {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        title: {
          display: true,
          text: title,
          fontSize: 16,
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: !!xLabel,
              labelString: xLabel,
            },
          }],
          yAxes: [{
            scaleLabel: {
              display: !!yLabel,
              labelString: yLabel,
            },
          }],
        },
        legend: {
          display: true,
          position: "bottom",
        },
      },
    };

    // Encode chart config for URL
    const chartConfigEncoded = encodeURIComponent(JSON.stringify(chartConfig));

    // Generate QuickChart URL
    const chartUrl =
      `https://quickchart.io/chart?c=${chartConfigEncoded}&width=800&height=400&format=png`;

    log(`Generated chart URL for: ${title}`, "info");

    // Return special format that the formatter will convert to HTML with embedded image
    // Using a marker that the formatter can detect and convert to <img> tag
    return `Chart generated successfully!

**${title}**

[CHART_IMAGE:${chartUrl}]`;
  } catch (error) {
    return `Chart generation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Create a new note for the user
 */
export async function createNote(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  title: string,
  content: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[],
  color?: string,
): Promise<string> {
  try {
    log(`Creating note: ${title}`, "info");

    // Block creation of AGENT_MEMORY notes - must use update_memory tool instead
    // update_memory auto-creates memory if it doesn't exist and properly merges content
    if (tags && tags.includes(AGENT_MEMORY_TAG)) {
      return `Cannot create ${AGENT_MEMORY_TAG} notes with create_note. Use the update_memory tool instead - it automatically creates the memory note if needed and properly merges new insights with existing memory.`;
    }

    // Assistant Colors Palette (Semantic)
    const ASSISTANT_COLORS = [
      "red",
      "pink",
      "purple",
      "deepPurple",
      "indigo",
      "blue",
      "lightBlue",
      "cyan",
      "teal",
      "green",
      "lightGreen",
      "lime",
      "yellow",
      "amber",
      "orange",
      "deepOrange",
      "brown",
      "grey",
      "blueGrey",
    ];

    // SlashCommand notes are user-facing automations (they appear in the
    // chat's "/" autocomplete). The calendar.notes JSONB trigger excludes
    // by_assistant=true notes from the mirror, so flip the flag for these
    // — even though Orion is creating them, they belong to the user.
    const isSlashCommand = !!tags && tags.includes(SLASH_COMMAND_TAG);

    const noteData: Record<string, unknown> = {
      user_id: userId,
      calendar_id: calendarId,
      title: title,
      content: content,
      by_assistant: !isSlashCommand,
      is_archived: false,
      is_pinned: false,
      cover_image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: tags || [],
    };

    if (color) {
      noteData.color = color;
    } else {
      noteData.color =
        ASSISTANT_COLORS[Math.floor(Math.random() * ASSISTANT_COLORS.length)];
    }

    // Add reminder fields if provided
    if (reminderType && reminderType !== "none") {
      noteData.reminder_type = reminderType;
      noteData.is_reminder_active = true;

      if (reminderType === "once" && reminderDate) {
        noteData.reminder_date = reminderDate;
      } else if (
        reminderType === "weekly" && reminderDays && reminderDays.length > 0
      ) {
        noteData.reminder_days = reminderDays;
      }
    } else {
      noteData.reminder_type = "none";
      noteData.is_reminder_active = false;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert(noteData)
      .select()
      .single();

    if (error) {
      log(`Error creating note: ${error.message}`, "error");
      return `Failed to create note: ${error.message}`;
    }

    log(`Note created successfully: ${data.id}`, "info");

    // Return the note ID so it can be referenced in the response
    return `Note "${title}" created successfully! [NOTE_CREATED:${data.id}]`;
  } catch (error) {
    return `Note creation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

/**
 * Update an existing AI-created note
 * NOTE: Cannot update AGENT_MEMORY notes - use updateMemory instead
 */
export async function updateNote(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
  title?: string,
  content?: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[],
  contentMode?: "append" | "replace" | "remove",
  contentText?: string,
  contentOldText?: string,
  replaceFullContent?: boolean,
): Promise<string> {
  try {
    log(`Updating note: ${noteId}`, "info");

    // Scope by user_id so service-role queries can't be tricked into
    // touching another user's note via a leaked id.
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title, tags, content")
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      return `Failed to find note: ${fetchError.message}`;
    }

    if (!existingNote) {
      return `Note not found with ID: ${noteId}`;
    }

    // Block updates to AGENT_MEMORY notes - must use update_memory tool instead
    const noteTags = existingNote.tags || [];
    if (noteTags.includes(AGENT_MEMORY_TAG)) {
      return `Cannot update ${AGENT_MEMORY_TAG} notes with update_note. Use the update_memory tool instead - it properly merges new insights with existing memory without losing information.`;
    }

    // SlashCommand notes are user-facing automations: even though they're
    // stored as user-owned (by_assistant=false) so they appear in the "/"
    // popup, Orion is allowed to update them on user request.
    const isSlashCommand = noteTags.includes(SLASH_COMMAND_TAG);

    if (!existingNote.by_assistant && !isSlashCommand) {
      return `Permission denied: You can only update AI-created notes. This note was created by the user.`;
    }

    // Resolve the new content via either incremental edit (content_mode) or
    // full overwrite (content). Mutually exclusive — both set is ambiguous.
    const hasMode = contentMode !== undefined;
    const hasFullContent = content !== undefined;
    let newContent: string | undefined;

    if (hasMode && hasFullContent) {
      return `Cannot use both 'content' (full overwrite) and 'content_mode' (incremental edit) in the same call. Choose one.`;
    }

    if (hasMode) {
      const current = existingNote.content || "";

      // Incremental text ops are unsafe on rich-text JSON blobs (could produce
      // invalid Draft.js). Force full overwrite for those.
      let isDraftJs = false;
      try {
        const parsed = JSON.parse(current);
        if (
          parsed && (Array.isArray(parsed.blocks) || parsed.entityMap)
        ) {
          isDraftJs = true;
        }
      } catch {
        // not JSON — plain text, fine
      }
      if (isDraftJs) {
        return `Cannot use content_mode on this note: it is stored in rich-text (Draft.js) format. Use the 'content' param to fully replace it instead.`;
      }

      if (contentMode === "append") {
        if (contentText === undefined || contentText === "") {
          return `content_mode='append' requires non-empty content_text.`;
        }
        newContent = current ? `${current}\n${contentText}` : contentText;
      } else if (contentMode === "replace") {
        if (!contentOldText) {
          return `content_mode='replace' requires content_old_text.`;
        }
        if (contentText === undefined) {
          return `content_mode='replace' requires content_text.`;
        }
        const matches = countOccurrences(current, contentOldText);
        if (matches === 0) {
          return `content_old_text not found in note "${existingNote.title}". Re-read the note and provide an exact substring (whitespace-sensitive). Current content:\n---\n${current}\n---`;
        }
        if (matches > 1) {
          return `content_old_text appears ${matches} times in note "${existingNote.title}" — must be unique. Add more surrounding context to the substring. Current content:\n---\n${current}\n---`;
        }
        newContent = current.replace(contentOldText, contentText);
      } else if (contentMode === "remove") {
        if (!contentOldText) {
          return `content_mode='remove' requires content_old_text.`;
        }
        const matches = countOccurrences(current, contentOldText);
        if (matches === 0) {
          return `content_old_text not found in note "${existingNote.title}". Current content:\n---\n${current}\n---`;
        }
        if (matches > 1) {
          return `content_old_text appears ${matches} times in note "${existingNote.title}" — must be unique. Current content:\n---\n${current}\n---`;
        }
        newContent = current.replace(contentOldText, "");
      } else {
        return `Unknown content_mode "${contentMode}". Use "append", "replace", or "remove".`;
      }
    } else if (hasFullContent) {
      // SLASH_COMMAND notes are user automations. Refuse full overwrites
      // unless the model explicitly confirms — prevents the silent rewrite
      // bug where "also add X" caused the entire command to be regenerated.
      if (isSlashCommand && !replaceFullContent) {
        return `Refusing to overwrite ${SLASH_COMMAND_TAG} note "${existingNote.title}" with full 'content' — this would wipe existing logic. Either: (A) use content_mode='append'/'replace'/'remove' for incremental edits, or (B) if the user explicitly asked to rewrite from scratch, set replace_full_content=true. Current content:\n---\n${existingNote.content || ""}\n---`;
      }
      newContent = content;
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (newContent !== undefined) {
      updateData.content = newContent;
    }

    // Handle tags update
    if (tags !== undefined) {
      updateData.tags = tags;
    }

    // Handle reminder fields
    if (reminderType !== undefined) {
      updateData.reminder_type = reminderType;

      if (reminderType === "none") {
        // Remove reminder
        updateData.is_reminder_active = false;
        updateData.reminder_date = null;
        updateData.reminder_days = [];
      } else {
        updateData.is_reminder_active = true;

        if (reminderType === "once" && reminderDate) {
          updateData.reminder_date = reminderDate;
          updateData.reminder_days = [];
        } else if (
          reminderType === "weekly" && reminderDays && reminderDays.length > 0
        ) {
          updateData.reminder_days = reminderDays;
          updateData.reminder_date = null;
        }
      }
    }

    // Update the note. The "by_assistant=true" safety filter applies only
    // to non-SlashCommand notes — SlashCommand notes are user-owned but
    // intentionally manageable by Orion (see check above). user_id is
    // always enforced so we can't write across user boundaries.
    let updateQuery = supabase
      .from("notes")
      .update(updateData)
      .eq("id", noteId)
      .eq("user_id", userId);
    if (!isSlashCommand) {
      updateQuery = updateQuery.eq("by_assistant", true);
    }
    const { error: updateError } = await updateQuery;

    if (updateError) {
      log(`Error updating note: ${updateError.message}`, "error");
      return `Failed to update note: ${updateError.message}`;
    }

    log(`Note updated successfully: ${noteId}`, "info");

    return `Note "${existingNote.title}" updated successfully!`;
  } catch (error) {
    return `Note update error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Delete an AI-created note
 */
export async function deleteNote(
  supabase: SupabaseClient,
  userId: string,
  noteId: string,
): Promise<string> {
  try {
    log(`Deleting note: ${noteId}`, "info");

    // Scope by user_id so service-role queries can't be tricked into
    // touching another user's note via a leaked id.
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title, tags")
      .eq("id", noteId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      return `Failed to find note: ${fetchError.message}`;
    }

    if (!existingNote) {
      return `Note not found with ID: ${noteId}`;
    }

    // SlashCommand notes are user-owned (by_assistant=false) so they show in
    // the chat's "/" autocomplete, but Orion is allowed to delete them on
    // user request — symmetric with the create + update path.
    const isSlashCommand = (existingNote.tags || []).includes(SLASH_COMMAND_TAG);

    if (!existingNote.by_assistant && !isSlashCommand) {
      return `Permission denied: You can only delete AI-created notes. This note was created by the user.`;
    }

    // Delete the note. user_id is always enforced; the by_assistant
    // safety filter applies only to non-SlashCommand notes.
    let deleteQuery = supabase
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);
    if (!isSlashCommand) {
      deleteQuery = deleteQuery.eq("by_assistant", true);
    }
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      log(`Error deleting note: ${deleteError.message}`, "error");
      return `Failed to delete note: ${deleteError.message}`;
    }

    log(`Note deleted successfully: ${noteId}`, "info");

    return `Note "${existingNote.title}" deleted successfully!`;
  } catch (error) {
    return `Note deletion error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}


/**
 * Extract image URLs from Draft.js content
 * Filters out stock/splash images (unsplash, pexels, etc.)
 */
function extractImagesFromContent(content: string): string[] {
  try {
    const rawContent = JSON.parse(content);
    const images: string[] = [];

    // Draft.js stores entities in entityMap
    if (rawContent.entityMap) {
      for (const key in rawContent.entityMap) {
        const entity = rawContent.entityMap[key];
        if (entity.type === "IMAGE" && entity.data?.src) {
          const src = entity.data.src;
          // Filter out stock/splash image sources
          const isStockImage = src.includes("unsplash.com") ||
            src.includes("pexels.com") ||
            src.includes("pixabay.com") ||
            src.includes("stock") ||
            src.includes("placeholder");

          if (!isStockImage) {
            images.push(src);
          }
        }
      }
    }
    return images;
  } catch {
    return [];
  }
}

/**
 * Search notes in a calendar
 */
export async function searchNotes(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  searchQuery?: string,
  includeArchived: boolean = false,
  tags?: string[],
): Promise<string> {
  try {
    log(
      `Searching ${
        tags?.length ? `tags: ${tags.join(", ")}` : "all"
      } notes for user ${userId} in calendar ${calendarId}`,
      "info",
    );

    // Build the query - include both calendar-specific notes AND global notes (calendar_id = null)
    // NOTE: We use a single .or() call for calendar filter to avoid conflicts with search filtering
    let query = supabase
      .from("notes")
      .select(
        "id, title, content, by_assistant, is_pinned, is_archived, created_at, updated_at, reminder_type, reminder_date, reminder_days, tags",
      )
      .eq("user_id", userId)
      .or(`calendar_id.eq.${calendarId},calendar_id.is.null`);

    // Filter by archived status
    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    // Apply tag filter if provided
    if (tags && tags.length > 0) {
      // Filter notes that contain ALL specified tags
      for (const tag of tags) {
        query = query.contains("tags", [tag]);
      }
    }

    // NOTE: Search filtering is done in-memory after fetching to avoid
    // PostgREST issues with multiple .or() calls that can conflict

    // Order by pinned first, then by updated date
    query = query.order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    const { data: rawNotes, error } = await query;

    if (error) {
      log(`Error searching notes: ${error.message}`, "error");
      return `Failed to search notes: ${error.message}`;
    }

    // Apply search query filter in-memory (to avoid PostgREST multiple .or() issues)
    let notes = rawNotes || [];
    if (searchQuery && searchQuery.trim() && notes.length > 0) {
      const searchLower = searchQuery.toLowerCase().trim();
      notes = notes.filter((note) => {
        // Search in title
        if (note.title?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in content - handle both plain text and Draft.js JSON
        if (note.content) {
          const contentLower = note.content.toLowerCase();
          if (contentLower.includes(searchLower)) {
            return true;
          }
          // Also try to extract plain text from Draft.js JSON
          try {
            const parsed = JSON.parse(note.content);
            if (parsed.blocks) {
              const plainText = parsed.blocks
                .map((b: { text?: string }) => b.text || "")
                .join(" ")
                .toLowerCase();
              if (plainText.includes(searchLower)) {
                return true;
              }
            }
          } catch {
            // Content is not JSON, already searched as plain text
          }
        }
        return false;
      });
      log(`After search filter: ${notes.length} notes match "${searchQuery}"`, "info");
    }

    if (!notes || notes.length === 0) {
      return searchQuery
        ? `No notes found matching "${searchQuery}".`
        : tags && tags.length > 0
        ? `No notes found with tags: ${tags.join(", ")}.`
        : "No notes found in this calendar.";
    }

    log(`Found ${notes.length} notes`, "info");

    // Format the results with note-ref tags for card display
    let result = `Found ${notes.length} note${
      notes.length === 1 ? "" : "s"
    }:\n\n`;

    for (const note of notes) {
      // Add note-ref tag on its own line for card display
      result += `<note-ref id="${note.id}"/>`;

      // Include note title and content so AI can read and use the information
      result += `\n**${note.title || "Untitled Note"}**`;

      // Extract plain text content from Draft.js JSON or use as-is
      if (note.content) {
        let plainContent = "";
        try {
          const parsed = JSON.parse(note.content);
          if (parsed.blocks && Array.isArray(parsed.blocks)) {
            // Extract text from Draft.js blocks
            plainContent = parsed.blocks
              .map((block: { text?: string }) => block.text || "")
              .join("\n")
              .trim();
          }
        } catch {
          // Content is plain text, not JSON
          plainContent = note.content.trim();
        }

        if (plainContent) {
          result += `\n${plainContent}`;
        }
      }

      // Extract and include embedded images from content
      const contentImages = extractImagesFromContent(note.content);
      if (contentImages.length > 0) {
        result += `\n[Embedded images: ${contentImages.join(", ")}]`;
        result += `\n[Tip: Use analyze_image tool with analysis_focus="general" for note images, or "overview"/"patterns"/"levels" if it's a chart]`;
      }

      // Show tags if present
      if (note.tags && note.tags.length > 0) {
        result += `\n[Tags: ${note.tags.join(", ")}]`;
      }

      result += "\n\n";
    }

    return result;
  } catch (error) {
    return `Note search error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get recent Orion task briefings for a user.
 * Scoped by userId — agents see only their own user's briefings. The
 * service-role supabase client bypasses RLS, so the userId filter is the
 * security boundary.
 */
export async function getRecentOrionBriefings(
  supabase: SupabaseClient,
  userId: string,
  taskType?: string,
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

    // Route the single `instrument` filter to currency-broad or
    // instrument-specific matching. Currency codes take the broad path (DB
    // filter on metadata.currencies); everything else resolves through the
    // YAHOO_SYMBOL_CATALOG mirror to one or more exact symbols, which are
    // then DB-filtered against metadata.symbols.
    type FilterMode = "currency" | "instrument";
    let filterMode: FilterMode | undefined;
    let normalizedCurrency: string | undefined;
    let instrumentMatches: InstrumentCatalogEntry[] = [];

    if (instrument) {
      // Expand informal aliases ("yen" → "JPY", "ES" → "^GSPC", etc.) before
      // routing so the alias survives both the currency check and catalog
      // match. Inputs without an alias pass through unchanged.
      const resolved = resolveInstrumentInput(instrument);
      if (isBriefingCurrency(resolved)) {
        filterMode = "currency";
        normalizedCurrency = resolved.toUpperCase();
      } else {
        instrumentMatches = matchInstrumentCatalog(resolved);
        if (instrumentMatches.length === 0) {
          const validCurrencies = Array.from(VALID_BRIEFING_CURRENCIES).join(", ");
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
      .select("id, task_type, significance, metadata, content_plain, created_at")
      .eq("user_id", userId)
      // Exclude system "data source unavailable" rows from both pre- and
      // post-Tavily-migration eras. New outages write `search_outage:true`;
      // legacy rows still in the 72h window have `serper_outage:true`. Drop
      // the `serper_outage` filter once production rows have aged out.
      .not('metadata', 'cs', '{"search_outage":true}')
      .not('metadata', 'cs', '{"serper_outage":true}')
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    if (untilDate) {
      query = query.lt("created_at", new Date(untilDate).toISOString());
    }

    if (taskType) {
      query = query.eq("task_type", taskType);
    }

    if (filterMode === "currency" && normalizedCurrency) {
      // metadata->currencies is a JSONB array; @> checks containment.
      query = query.filter(
        "metadata",
        "cs",
        JSON.stringify({ currencies: [normalizedCurrency] }),
      );
    }

    if (filterMode === "instrument") {
      // matchInstrumentCatalog already resolved input to exact catalog entries,
      // so we have specific symbol strings — no substring matching needed.
      // Single match: one cs filter. Multiple matches: OR them together.
      // Single-element JSON arrays have no commas, so the values are safe in
      // PostgREST's or-expression syntax without extra quoting.
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
        ? `between ${sinceDate}${untilDate ? ` and ${untilDate}` : " and now"}`
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

      return `No Orion briefings found ${rangeDesc}${
        taskType ? ` for task type "${taskType}"` : ""
      }.`;
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
      // No body trim: content_plain is already a Gemini-summarized briefing
      // (system prompt caps it at ~800 words). A char-level cut would chop
      // the summary mid-sentence for no benefit.
      const body = r.content_plain ?? "";

      const citations = Array.isArray(meta?.citations) ? meta!.citations : [];
      const sourceLines = citations
        .filter((c): c is BriefingCitation & { url: string } =>
          typeof c?.url === "string" && c.url.length > 0
        )
        .map((c) => {
          let domain = "";
          try { domain = new URL(c.url).hostname.replace(/^www\./, ""); }
          catch { /* fall through with empty domain */ }
          const label = c.source || domain || "source";
          return c.title
            ? `      - ${label}: ${c.title} (${c.url})`
            : `      - ${label}: (${c.url})`;
        });
      const sourcesBlock =
        sourceLines.length > 0 ? `\n    Sources:\n${sourceLines.join("\n")}` : "";

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

/**
 * Tier 1 — search past AI conversations by keyword.
 * Returns lightweight metadata so the agent can decide which transcript (if any)
 * is worth fetching via get_conversation. Keeps token cost bounded.
 */
interface ConversationMessage {
  role?: string;
  content?: string;
  timestamp?: string;
}

export async function searchConversations(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  sinceDays: number = 30,
  limit: number = 5,
): Promise<string> {
  try {
    const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
    const sinceIso = new Date(Date.now() - sinceDays * 86400 * 1000).toISOString();
    const q = (query || "").trim();
    if (!q) {
      return "Query is required for search_conversations.";
    }

    // Pull a candidate window (up to 50 rows) and filter in-memory.
    // ai_conversations.messages is JSONB — PostgREST can't easily do a full
    // text search on it from the client library, so we fetch-then-filter.
    // The user's per-window conversation count is small so this is cheap.
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, message_count, created_at, updated_at, messages")
      .eq("user_id", userId)
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      log(`Error searching conversations: ${error.message}`, "error");
      return `Failed to search conversations: ${error.message}`;
    }

    const needle = q.toLowerCase();
    const rows = (data ?? []).filter((r) => {
      const titleMatch = (r.title ?? "").toLowerCase().includes(needle);
      if (titleMatch) return true;
      const messages = (r.messages as ConversationMessage[] | null) ?? [];
      return messages.some((m) =>
        (m?.content ?? "").toLowerCase().includes(needle),
      );
    }).slice(0, boundedLimit);

    if (rows.length === 0) {
      return `No past conversations matched "${q}" in the last ${sinceDays} days.`;
    }

    const lines = rows.map((r, i) => {
      const messages = (r.messages as ConversationMessage[] | null) ?? [];
      const last = messages[messages.length - 1];
      const snippet = (last?.content ?? "").substring(0, 200).replace(/\s+/g, " ");
      return (
        `[${i + 1}] id=${r.id}\n` +
        `    Title: ${r.title ?? "(untitled)"}\n` +
        `    ${r.message_count} messages | updated ${r.updated_at}\n` +
        `    Last message: ${snippet}${snippet.length >= 200 ? "..." : ""}`
      );
    });

    return `Found ${rows.length} conversation${
      rows.length === 1 ? "" : "s"
    } matching "${q}":\n\n${lines.join("\n\n")}\n\nUse get_conversation(id) to read the full transcript of any relevant result.`;
  } catch (error) {
    return `Failed to search conversations: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Tier 2 — fetch a specific conversation's full transcript.
 * Bounded by the 50-message per-conversation cap in useAIChat.
 */
export async function getConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<string> {
  try {
    if (!conversationId) {
      return "conversation_id is required.";
    }

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, message_count, created_at, updated_at, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log(`Error fetching conversation: ${error.message}`, "error");
      return `Failed to fetch conversation: ${error.message}`;
    }
    if (!data) {
      return `Conversation ${conversationId} not found (or not owned by this user).`;
    }

    const messages = (data.messages as ConversationMessage[] | null) ?? [];
    if (messages.length === 0) {
      return `Conversation "${data.title ?? "(untitled)"}" has no messages.`;
    }

    const transcript = messages
      .map((m) => {
        const role = m?.role === "assistant" ? "orion" : m?.role ?? "user";
        const ts = m?.timestamp ?? "";
        const content = (m?.content ?? "").trim();
        return `[${ts}] ${role}: ${content}`;
      })
      .join("\n\n");

    return (
      `Conversation "${data.title ?? "(untitled)"}" — ${messages.length} messages, ` +
      `created ${data.created_at}, last updated ${data.updated_at}:\n\n${transcript}`
    );
  } catch (error) {
    return `Failed to fetch conversation: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get tag definition from database
 * Supports partial matching: "3x Displacement" will match "Confluence:3x Displacement"
 */
export async function getTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
): Promise<string> {
  try {
    console.log(
      `[getTagDefinition] Looking up: "${tagName}" for user: ${userId}`,
    );
    log(`Looking up definition for tag: ${tagName}`, "info");

    // First try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .eq("tag_name", tagName)
      .single();

    if (exactError && exactError.code !== "PGRST116") {
      log(`Error fetching tag definition: ${exactError.message}`, "error");
      return `Error looking up tag definition: ${exactError.message}`;
    }

    if (exactMatch) {
      console.log(
        `[getTagDefinition] Found exact match: ${JSON.stringify(exactMatch)}`,
      );
      log(`Found exact definition for tag: ${tagName}`, "info");
      return `Tag "${tagName}" definition: ${exactMatch.definition}`;
    }

    console.log(
      `[getTagDefinition] No exact match, exactError: ${
        JSON.stringify(exactError)
      }`,
    );

    // If no exact match, try partial match (tag name part of grouped tags)
    // This allows "3x Displacement" to match "Confluence:3x Displacement"
    const { data: partialMatches, error: partialError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .ilike("tag_name", `%:${tagName}`);

    if (partialError) {
      log(
        `Error fetching partial tag definition: ${partialError.message}`,
        "error",
      );
      return `Error looking up tag definition: ${partialError.message}`;
    }

    if (partialMatches && partialMatches.length > 0) {
      // Return the first match (most likely the intended one)
      const match = partialMatches[0];
      log(
        `Found partial match for tag "${tagName}": ${match.tag_name}`,
        "info",
      );
      return `Tag "${match.tag_name}" definition: ${match.definition}`;
    }

    return `No definition found for tag "${tagName}". You may suggest a definition and ask the user if they'd like to save it.`;
  } catch (error) {
    return `Error looking up tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Save tag definition to database
 */
export async function saveTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
  definition: string,
): Promise<string> {
  try {
    log(`Saving definition for tag: ${tagName}`, "info");

    const { error } = await supabase.from("tag_definitions").upsert(
      {
        user_id: userId,
        tag_name: tagName,
        definition: definition,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tag_name" },
    );

    if (error) {
      log(`Error saving tag definition: ${error.message}`, "error");
      return `Error saving tag definition: ${error.message}`;
    }

    log(`Saved definition for tag: ${tagName}`, "info");
    return `Successfully saved definition for tag "${tagName}".`;
  } catch (error) {
    return `Error saving tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Check if URL is a stock/placeholder image that should be skipped
 */
function isStockImageUrl(url: string): boolean {
  const stockDomains = [
    "unsplash.com",
    "images.unsplash.com",
    "pexels.com",
    "pixabay.com",
    "stock",
    "placeholder",
    "via.placeholder.com",
  ];
  return stockDomains.some((domain) => url.toLowerCase().includes(domain));
}

/**
 * Prepare image for multimodal analysis
 * Returns a marker that the conversation builder will detect and inject as inline_data
 */
export function analyzeImage(
  imageUrl: string,
  analysisFocus: string = "overview",
  tradeContext?: string,
): string {
  try {
    // Skip stock/placeholder images
    if (isStockImageUrl(imageUrl)) {
      log(`Skipping stock image: ${imageUrl.substring(0, 50)}...`, "info");
      return `This appears to be a stock/placeholder image (${
        imageUrl.substring(0, 30)
      }...) and not an actual trade chart. Skipping analysis. Please provide a real trade chart image for analysis.`;
    }

    log(
      `Preparing image for analysis: ${imageUrl.substring(0, 50)}...`,
      "info",
    );

    // Build analysis instruction based on focus
    const focusPrompts: Record<string, string> = {
      entry:
        "Focus on analyzing the entry point: Was the entry well-timed? What price action or patterns preceded the entry? Was there confluence?",
      exit:
        "Focus on analyzing the exit: Was the exit optimal? Was profit left on the table? Was the stop loss placement appropriate?",
      patterns:
        "Focus on identifying chart patterns: What patterns are visible (head & shoulders, flags, wedges, etc.)? Are there trend lines or channels?",
      levels:
        "Focus on support/resistance levels: Identify key horizontal levels, trend lines, and areas of interest. Where are the key decision points?",
      overview:
        "Provide a general analysis of this trade chart including: entry/exit quality, patterns, key levels, and any notable observations.",
      general:
        "Describe this image in detail. What do you see? If it's a chart, describe the price action. If it's a screenshot, describe the content. If it's a diagram or reference material, explain what it shows.",
    };

    const focusInstruction = focusPrompts[analysisFocus] ||
      focusPrompts.overview;
    const contextNote = tradeContext
      ? ` Context: "${tradeContext}".`
      : "";

    // Use different prompts for general vs chart-focused analysis
    const isGeneralFocus = analysisFocus === "general";
    const taskInstruction = isGeneralFocus
      ? "YOUR TASK: Describe what you SEE in this image and respond with your findings (3-5 bullet points). Be specific about visual elements, text, diagrams, or any relevant details."
      : "YOUR TASK: Analyze what you SEE in this image and respond with your findings (3-5 bullet points). Describe specific visual elements you observe: candlesticks, indicators, levels, patterns, entry/exit markers, platform UI, annotations, etc.";

    // Return marker with image URL - conversation builder will inject the actual image
    return `[IMAGE_ANALYSIS:${imageUrl}]
IMAGE LOADED SUCCESSFULLY. You are now viewing the image above.
${focusInstruction}${contextNote}
${taskInstruction}`;
  } catch (error) {
    log(`Image preparation error: ${error}`, "error");
    return `Image analysis error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

// ============================================================
// REMINDERS TOOLS
// ============================================================

type SetReminderItemErrorCode =
  | "past_trigger_at"
  | "too_far_future"
  | "reminder_limit_reached"
  | "invalid_args"
  | "db_error";

type SetReminderBatchErrorCode =
  | "no_user_context"
  | "no_conversation_context"
  | "invalid_args"
  | "batch_too_large"
  | "db_error";

interface SetReminderItemSuccess {
  index: number;
  id: string;
  trigger_at: string;
  description?: string;
}

interface SetReminderItemFailure {
  index: number;
  trigger_at?: string;
  description?: string;
  error_code: SetReminderItemErrorCode;
  error: string;
}

interface SetReminderBatchResult {
  success: boolean;
  /** Present and shared across all rows when >1 row inserted, else null/omitted. */
  batch_id?: string | null;
  created: SetReminderItemSuccess[];
  failed: SetReminderItemFailure[];
  error_code?: SetReminderBatchErrorCode;
  error?: string;
}

const REMINDER_PENDING_CAP = 50;
const REMINDER_BATCH_CAP = 12;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface RawReminderInput {
  trigger_at?: unknown;
  instructions?: unknown;
  description?: unknown;
}

interface ValidatedReminder {
  index: number;
  trigger_iso: string;
  instructions: string;
  description: string;
}

function validateReminderItem(
  raw: RawReminderInput,
  index: number,
  now: number,
): ValidatedReminder | SetReminderItemFailure {
  const triggerAt = typeof raw.trigger_at === "string" ? raw.trigger_at : "";
  const instructions = typeof raw.instructions === "string" ? raw.instructions : "";
  const description = typeof raw.description === "string" ? raw.description : "";

  const trigger = new Date(triggerAt);
  if (!triggerAt || Number.isNaN(trigger.getTime())) {
    return {
      index,
      trigger_at: triggerAt || undefined,
      error_code: "invalid_args",
      error: "trigger_at not parseable",
    };
  }
  if (trigger.getTime() <= now) {
    return {
      index,
      trigger_at: triggerAt,
      error_code: "past_trigger_at",
      error: "trigger_at must be in the future",
    };
  }
  if (trigger.getTime() > now + ONE_YEAR_MS) {
    return {
      index,
      trigger_at: triggerAt,
      error_code: "too_far_future",
      error: "trigger_at must be within 1 year",
    };
  }
  if (instructions.length < 1 || instructions.length > 1000) {
    return {
      index,
      trigger_at: triggerAt,
      error_code: "invalid_args",
      error: "instructions must be 1-1000 chars",
    };
  }
  if (description.length > 200) {
    return {
      index,
      trigger_at: triggerAt,
      error_code: "invalid_args",
      error: "description must be <=200 chars",
    };
  }
  return {
    index,
    trigger_iso: trigger.toISOString(),
    instructions,
    description,
  };
}

async function executeSetReminder(
  reminders: unknown,
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  const result: SetReminderBatchResult = await (async () => {
    if (!supabase) {
      return { success: false, created: [], failed: [], error_code: "db_error" as const, error: "no supabase client" };
    }
    const userId = context.userId ?? "";
    if (!userId) {
      return { success: false, created: [], failed: [], error_code: "no_user_context" as const, error: "no user id" };
    }
    const conversationId = context.conversationId ?? "";
    if (!conversationId) {
      return { success: false, created: [], failed: [], error_code: "no_conversation_context" as const, error: "no conversation id" };
    }

    if (!Array.isArray(reminders)) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "invalid_args" as const,
        error: "reminders must be an array of {trigger_at, instructions, description?}",
      };
    }
    if (reminders.length === 0) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "invalid_args" as const,
        error: "reminders array is empty",
      };
    }
    if (reminders.length > REMINDER_BATCH_CAP) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "batch_too_large" as const,
        error: `max ${REMINDER_BATCH_CAP} reminders per call (got ${reminders.length})`,
      };
    }

    // Per-item validation. Failed items don't abort the batch.
    const now = Date.now();
    const valid: ValidatedReminder[] = [];
    const failed: SetReminderItemFailure[] = [];
    for (let i = 0; i < reminders.length; i++) {
      const checked = validateReminderItem(reminders[i] as RawReminderInput, i, now);
      if ("error_code" in checked) {
        failed.push(checked);
      } else {
        valid.push(checked);
      }
    }
    if (valid.length === 0) {
      return { success: false, created: [], failed };
    }

    // Verify the conversation actually belongs to this user. The conversation
    // FK only enforces existence, not ownership — without this check, a caller
    // could plant a reminder targeting another user's conversation, and it
    // would be visible in the victim's realtime sub. ai-trading-agent's
    // reminder mode also rejects on owner mismatch at fire time, but blocking
    // at write time keeps phantom rows out of the DB entirely. One check per
    // batch — owner doesn't change mid-call.
    const { data: convoOwner, error: ownerErr } = await supabase
      .from("ai_conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (ownerErr) {
      return { success: false, created: [], failed, error_code: "db_error" as const, error: ownerErr.message };
    }
    if (!convoOwner || convoOwner.user_id !== userId) {
      return {
        success: false,
        created: [],
        failed,
        error_code: "no_conversation_context" as const,
        error: "conversation not found or not owned by user",
      };
    }

    // Per-user pending cap (50). Compute remaining slots and trim batch.
    const { count, error: countErr } = await supabase
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (countErr) {
      return { success: false, created: [], failed, error_code: "db_error" as const, error: countErr.message };
    }
    const pending = count ?? 0;
    const remainingSlots = Math.max(0, REMINDER_PENDING_CAP - pending);
    if (remainingSlots === 0) {
      for (const v of valid) {
        failed.push({
          index: v.index,
          trigger_at: v.trigger_iso,
          description: v.description || undefined,
          error_code: "reminder_limit_reached",
          error: `max ${REMINDER_PENDING_CAP} pending reminders`,
        });
      }
      return { success: false, created: [], failed };
    }
    const toInsert = valid.slice(0, remainingSlots);
    for (const v of valid.slice(remainingSlots)) {
      failed.push({
        index: v.index,
        trigger_at: v.trigger_iso,
        description: v.description || undefined,
        error_code: "reminder_limit_reached",
        error: `max ${REMINDER_PENDING_CAP} pending reminders`,
      });
    }

    // Server-assigned batch_id when this call inserts >1 row. Solo inserts
    // stay batch_id=NULL so fire-time sibling logic knows to skip the group
    // hint. Generated here (not by the model) — no hallucination risk.
    const batchId = toInsert.length > 1 ? crypto.randomUUID() : null;

    // Bulk insert. Postgres preserves row order for VALUES lists, so the
    // returned rows match toInsert positionally.
    const rows = toInsert.map((v) => ({
      user_id: userId,
      conversation_id: conversationId,
      trigger_at: v.trigger_iso,
      instructions: v.instructions,
      description: v.description,
      batch_id: batchId,
    }));
    const { data, error } = await supabase
      .from("reminders")
      .insert(rows)
      .select("id, trigger_at, description");

    if (error) {
      for (const v of toInsert) {
        failed.push({
          index: v.index,
          trigger_at: v.trigger_iso,
          description: v.description || undefined,
          error_code: "db_error",
          error: error.message,
        });
      }
      return { success: false, created: [], failed, error_code: "db_error" as const, error: error.message };
    }

    const created: SetReminderItemSuccess[] = (data ?? []).map((row, i) => ({
      index: toInsert[i].index,
      id: row.id,
      trigger_at: row.trigger_at,
      description: row.description ?? undefined,
    }));
    return { success: created.length > 0, batch_id: batchId, created, failed };
  })();

  return JSON.stringify(result);
}

interface ListRemindersRow {
  id: string;
  description: string | null;
  trigger_at: string;
  instructions: string;
  conversation_id: string;
  conversation_title: string;
  batch_id: string | null;
}

async function executeListReminders(
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  if (!supabase) {
    return JSON.stringify({ success: false, error: "no supabase client" });
  }
  const userId = context.userId ?? "";
  if (!userId) {
    return JSON.stringify({ success: false, error: "no user id" });
  }

  const { data, error } = await supabase
    .from("reminders")
    .select(`
      id,
      description,
      trigger_at,
      instructions,
      conversation_id,
      batch_id,
      ai_conversations!inner(title)
    `)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("trigger_at", { ascending: true });

  if (error) {
    return JSON.stringify({ success: false, error: error.message });
  }

  const rows: ListRemindersRow[] = (data ?? []).map((r) => {
    const conv = (r as { ai_conversations: { title?: string } | { title?: string }[] | null })
      .ai_conversations;
    const title = Array.isArray(conv) ? conv[0]?.title : conv?.title;
    return {
      id: r.id,
      description: r.description ?? null,
      trigger_at: r.trigger_at,
      instructions: r.instructions,
      conversation_id: r.conversation_id,
      conversation_title: title ?? "(untitled)",
      batch_id: r.batch_id ?? null,
    };
  });

  return JSON.stringify({ success: true, reminders: rows });
}

async function executeCancelReminder(
  id: string,
  batchId: string,
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  if (!supabase) {
    return JSON.stringify({ success: false, error: "no supabase client" });
  }
  const userId = context.userId ?? "";
  if (!userId) {
    return JSON.stringify({ success: false, error: "no user id" });
  }
  const hasId = typeof id === "string" && id.length > 0;
  const hasBatchId = typeof batchId === "string" && batchId.length > 0;
  if (hasId === hasBatchId) {
    return JSON.stringify({
      success: false,
      error_code: "invalid_args",
      error: hasId
        ? "pass exactly one of {id, batch_id}, not both"
        : "id or batch_id required",
    });
  }

  // Conditional update: only flips pending -> cancelled. user_id match is
  // defense-in-depth (service-role bypasses RLS).
  if (hasBatchId) {
    // Batch cancel: every pending row in the batch. Returns the cancelled
    // ids so the LLM can confirm the count to the user.
    const { data, error } = await supabase
      .from("reminders")
      .update({ status: "cancelled" })
      .eq("batch_id", batchId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id");
    if (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
    const cancelledIds = (data ?? []).map((r: { id: string }) => r.id);
    if (cancelledIds.length === 0) {
      return JSON.stringify({
        success: false,
        error_code: "not_found",
        error: "no pending reminders matched batch_id",
      });
    }
    return JSON.stringify({
      success: true,
      batch_id: batchId,
      cancelled_ids: cancelledIds,
      cancelled_count: cancelledIds.length,
    });
  }

  // Single-id cancel (original path).
  const { data, error } = await supabase
    .from("reminders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return JSON.stringify({ success: false, error: error.message });
  }
  if (!data) {
    // Either not found or not pending. Inspect to give a useful error.
    const { data: existing } = await supabase
      .from("reminders")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      return JSON.stringify({
        success: false,
        error_code: "not_found",
        error: "reminder not found",
      });
    }
    return JSON.stringify({
      success: false,
      error_code: "not_pending",
      error: `reminder is ${existing.status}, not pending`,
    });
  }
  return JSON.stringify({ success: true, id });
}

interface EditReminderRow {
  id: string;
  trigger_at: string;
  instructions: string;
  description: string | null;
}

interface EditReminderResult {
  success: boolean;
  updated: EditReminderRow[];
  error_code?:
    | "invalid_args"
    | "not_found"
    | "not_pending"
    | "no_user_context"
    | "past_trigger_at"
    | "too_far_future"
    | "db_error";
  error?: string;
}

/**
 * Edit pending reminders. Two modes (mutually exclusive):
 *   - single: \`id\` + any of {trigger_at, instructions, description}
 *   - batch:  \`batch_id\` + any of {shift_minutes, instructions}
 *
 * Pending-only — firing/fired/cancelled rows are untouchable. Whitelist of
 * editable fields prevents the model from rewriting ownership/status/batch_id.
 */
async function executeEditReminder(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  const result: EditReminderResult = await (async () => {
    if (!supabase) {
      return { success: false, updated: [], error_code: "db_error" as const, error: "no supabase client" };
    }
    const userId = context.userId ?? "";
    if (!userId) {
      return { success: false, updated: [], error_code: "no_user_context" as const, error: "no user id" };
    }

    const id = typeof args.id === "string" ? args.id : "";
    const batchId = typeof args.batch_id === "string" ? args.batch_id : "";
    const hasId = id.length > 0;
    const hasBatchId = batchId.length > 0;
    if (hasId === hasBatchId) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: hasId ? "pass exactly one of {id, batch_id}, not both" : "id or batch_id required",
      };
    }

    const triggerAt = typeof args.trigger_at === "string" ? args.trigger_at : undefined;
    const instructions = typeof args.instructions === "string" ? args.instructions : undefined;
    const description = typeof args.description === "string" ? args.description : undefined;
    const shiftMinutes = typeof args.shift_minutes === "number" ? args.shift_minutes : undefined;

    // Mode-specific field validation: single can use trigger_at, batch can use shift_minutes.
    if (hasId && shiftMinutes !== undefined) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "shift_minutes is for batch_id mode only; use trigger_at for single edits",
      };
    }
    if (hasBatchId && triggerAt !== undefined) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "trigger_at is for single (id) mode only; use shift_minutes for batch edits",
      };
    }
    if (hasBatchId && description !== undefined) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "description is per-row; not editable in batch mode",
      };
    }

    const anyField =
      triggerAt !== undefined ||
      instructions !== undefined ||
      description !== undefined ||
      shiftMinutes !== undefined;
    if (!anyField) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "at least one editable field required",
      };
    }

    // Field-level validation (shared).
    const now = Date.now();
    if (instructions !== undefined && (instructions.length < 1 || instructions.length > 1000)) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "instructions must be 1-1000 chars",
      };
    }
    if (description !== undefined && description.length > 200) {
      return {
        success: false,
        updated: [],
        error_code: "invalid_args" as const,
        error: "description must be <=200 chars",
      };
    }
    if (triggerAt !== undefined) {
      const t = new Date(triggerAt);
      if (Number.isNaN(t.getTime())) {
        return { success: false, updated: [], error_code: "invalid_args" as const, error: "trigger_at not parseable" };
      }
      if (t.getTime() <= now) {
        return { success: false, updated: [], error_code: "past_trigger_at" as const, error: "trigger_at must be in the future" };
      }
      if (t.getTime() > now + ONE_YEAR_MS) {
        return { success: false, updated: [], error_code: "too_far_future" as const, error: "trigger_at must be within 1 year" };
      }
    }
    if (shiftMinutes !== undefined) {
      if (!Number.isFinite(shiftMinutes) || Math.abs(shiftMinutes) > 60 * 24 * 365) {
        return {
          success: false,
          updated: [],
          error_code: "invalid_args" as const,
          error: "shift_minutes must be finite and |shift| <= 1 year",
        };
      }
    }

    // ===== Single-row edit (id) =====
    if (hasId) {
      const patch: Record<string, unknown> = {};
      if (triggerAt !== undefined) patch.trigger_at = new Date(triggerAt).toISOString();
      if (instructions !== undefined) patch.instructions = instructions;
      if (description !== undefined) patch.description = description;

      const { data, error } = await supabase
        .from("reminders")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .select("id, trigger_at, instructions, description")
        .maybeSingle();
      if (error) {
        return { success: false, updated: [], error_code: "db_error" as const, error: error.message };
      }
      if (!data) {
        const { data: existing } = await supabase
          .from("reminders")
          .select("id, status")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!existing) {
          return { success: false, updated: [], error_code: "not_found" as const, error: "reminder not found" };
        }
        return {
          success: false,
          updated: [],
          error_code: "not_pending" as const,
          error: `reminder is ${existing.status}, not pending`,
        };
      }
      return { success: true, updated: [data as EditReminderRow] };
    }

    // ===== Batch edit (batch_id) =====
    // Instructions-only change: single UPDATE on batch_id.
    if (shiftMinutes === undefined && instructions !== undefined) {
      const { data, error } = await supabase
        .from("reminders")
        .update({ instructions })
        .eq("batch_id", batchId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .select("id, trigger_at, instructions, description");
      if (error) {
        return { success: false, updated: [], error_code: "db_error" as const, error: error.message };
      }
      if (!data || data.length === 0) {
        return { success: false, updated: [], error_code: "not_found" as const, error: "no pending reminders matched batch_id" };
      }
      return { success: true, updated: data as EditReminderRow[] };
    }

    // Shift mode (with optional instructions update). Fetch pending siblings,
    // compute per-row new trigger_at, validate, then parallel UPDATEs. Bounded
    // by REMINDER_BATCH_CAP (12) so fan-out is small.
    const { data: pending, error: fetchErr } = await supabase
      .from("reminders")
      .select("id, trigger_at")
      .eq("batch_id", batchId)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (fetchErr) {
      return { success: false, updated: [], error_code: "db_error" as const, error: fetchErr.message };
    }
    if (!pending || pending.length === 0) {
      return { success: false, updated: [], error_code: "not_found" as const, error: "no pending reminders matched batch_id" };
    }

    const shiftMs = (shiftMinutes ?? 0) * 60 * 1000;
    type ShiftPlan = { id: string; new_trigger_iso: string };
    const planned: ShiftPlan[] = [];
    for (const row of pending) {
      const newMs = new Date(row.trigger_at as string).getTime() + shiftMs;
      if (newMs <= now) {
        return {
          success: false,
          updated: [],
          error_code: "past_trigger_at" as const,
          error: `shift would put reminder ${row.id} in the past`,
        };
      }
      if (newMs > now + ONE_YEAR_MS) {
        return {
          success: false,
          updated: [],
          error_code: "too_far_future" as const,
          error: `shift would put reminder ${row.id} beyond 1 year`,
        };
      }
      planned.push({ id: row.id as string, new_trigger_iso: new Date(newMs).toISOString() });
    }

    const updates = await Promise.all(
      planned.map((p) => {
        const patch: Record<string, unknown> = { trigger_at: p.new_trigger_iso };
        if (instructions !== undefined) patch.instructions = instructions;
        return supabase
          .from("reminders")
          .update(patch)
          .eq("id", p.id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .select("id, trigger_at, instructions, description")
          .maybeSingle();
      }),
    );

    const updated: EditReminderRow[] = [];
    for (const u of updates) {
      if (u.error) {
        return { success: false, updated, error_code: "db_error" as const, error: u.error.message };
      }
      if (u.data) updated.push(u.data as EditReminderRow);
    }
    if (updated.length === 0) {
      return { success: false, updated: [], error_code: "not_pending" as const, error: "no rows matched after shift (likely raced with fire)" };
    }
    return { success: true, updated };
  })();

  return JSON.stringify(result);
}

/**
 * ============================================================================
 * TOOL EXECUTOR
 * ============================================================================
 */

/**
 * Execute a custom tool by name
 */
export async function executeCustomTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  try {
    switch (toolName) {
      case "search_web": {
        const query = typeof args.query === "string" ? args.query : "";
        const searchType = typeof args.type === "string" ? args.type : "search";
        const timeRange = typeof args.time_range === "string"
          ? args.time_range
          : undefined;
        return await executeWebSearch(query, searchType, timeRange, supabase);
      }

      case "scrape_url": {
        const url = typeof args.url === "string" ? args.url : "";
        return await scrapeUrl(url, supabase);
      }

      case "get_market_data": {
        const action = typeof args.action === "string" ? args.action : "";
        const sym = typeof args.symbol === "string" ? args.symbol : "";
        if (action === "quote") {
          if (!sym) {
            return `get_market_data action="quote" requires \`symbol\` (catalog format, e.g. "EURUSD=X", "AAPL").`;
          }
          return await executeGetMarketPrice(sym, supabase);
        }
        if (action === "history") {
          // Surface missing required fields before delegating — the downstream
          // "Invalid interval ''" error is less actionable than these hints.
          if (!sym) {
            return `get_market_data action="history" requires \`symbol\` (catalog format).`;
          }
          const interval =
            typeof args.interval === "string" ? args.interval.trim() : "";
          if (!interval) {
            return (
              `get_market_data action="history" requires \`interval\`. ` +
              `Common choices: "1day" for daily candles ("yesterday's range"), ` +
              `"1h" for intraday context, "5min" for sub-hour detail. ` +
              `Pick the coarsest that answers the question and retry.`
            );
          }
          return await executeGetMarketHistory({
            symbol: sym,
            interval,
            outputsize:
              typeof args.outputsize === "number" ? args.outputsize : undefined,
            start_date:
              typeof args.start_date === "string" ? args.start_date : undefined,
            end_date:
              typeof args.end_date === "string" ? args.end_date : undefined,
            chart_only: args.chart_only === true,
            include_chart: args.include_chart === true,
          });
        }
        if (action === "indicator") {
          if (!sym) {
            return `get_market_data action="indicator" requires \`symbol\` (catalog format).`;
          }
          const indicator =
            typeof args.indicator === "string" ? args.indicator : "";
          if (!indicator) {
            return (
              `get_market_data action="indicator" requires \`indicator\`. ` +
              `Valid: RSI, MACD, ATR, BBANDS.`
            );
          }
          const interval =
            typeof args.interval === "string" ? args.interval.trim() : "";
          if (!interval) {
            return (
              `get_market_data action="indicator" requires \`interval\`. ` +
              `Common choices: "1day" for daily readings, "1h" for intraday momentum.`
            );
          }
          // VWAP is intraday-only by convention — a 1day/1week/1month VWAP
          // collapses to single-bar values that aren't useful. Reject early
          // with a clear retry hint instead of returning a useless number.
          if (
            indicator.toUpperCase() === "VWAP" &&
            (interval === "1day" || interval === "1week" || interval === "1month")
          ) {
            return (
              `VWAP is intraday-only — daily/weekly/monthly aggregation ` +
              `returns single-bar values that aren't useful for the "fair ` +
              `value" reading traders watch. Retry with an intraday interval ` +
              `("15min" for "where's VWAP right now", "5min" for finer ` +
              `detail, "1h" for session-shape).`
            );
          }
          return await executeGetIndicator({
            symbol: sym,
            indicator,
            interval,
            period:
              typeof args.period === "number" ? args.period : undefined,
            outputsize:
              typeof args.outputsize === "number" ? args.outputsize : undefined,
          });
        }
        if (action === "search") {
          const query = typeof args.query === "string" ? args.query : "";
          if (!query) {
            return (
              `get_market_data action="search" requires \`query\` ` +
              `(free-text company or asset name, e.g. "Tesla", "Apple").`
            );
          }
          return await executeSymbolSearch({ query });
        }
        return (
          `get_market_data: invalid action "${action}". Valid: ` +
          `"quote" (current price), "history" (OHLC candles), ` +
          `"indicator" (RSI/MACD/ATR/BBANDS), "search" (name→ticker).`
        );
      }

      case "generate_chart": {
        const chartType = typeof args.chart_type === "string"
          ? args.chart_type
          : "line";
        const title = typeof args.title === "string" ? args.title : "Chart";
        const xLabel = typeof args.x_label === "string" ? args.x_label : "";
        const yLabel = typeof args.y_label === "string" ? args.y_label : "";
        const labels = Array.isArray(args.labels) ? args.labels : [];
        const datasets = Array.isArray(args.datasets) ? args.datasets : [];
        return await generateChart(
          chartType,
          title,
          xLabel,
          yLabel,
          labels,
          datasets,
        );
      }

      case "create_note": {
        if (!supabase) {
          return "Supabase client not available for note creation";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        const title = typeof args.title === "string" ? args.title : "";
        const content = typeof args.content === "string" ? args.content : "";
        const reminderType = typeof args.reminder_type === "string"
          ? args.reminder_type
          : undefined;
        const reminderDate = typeof args.reminder_date === "string"
          ? args.reminder_date
          : undefined;
        const reminderDays = Array.isArray(args.reminder_days)
          ? args.reminder_days
          : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;

        return await createNote(
          supabase,
          userId,
          calendarId,
          title,
          content,
          reminderType,
          reminderDate,
          reminderDays,
          tags,
        );
      }

      case "update_note": {
        if (!supabase) {
          return "Supabase client not available for note update";
        }
        const userId = context.userId || "";
        if (!userId) {
          return "User context required for note update";
        }
        const noteId = typeof args.note_id === "string" ? args.note_id : "";
        const title = typeof args.title === "string" ? args.title : undefined;
        const content = typeof args.content === "string"
          ? args.content
          : undefined;
        const reminderType = typeof args.reminder_type === "string"
          ? args.reminder_type
          : undefined;
        const reminderDate = typeof args.reminder_date === "string"
          ? args.reminder_date
          : undefined;
        const reminderDays = Array.isArray(args.reminder_days)
          ? args.reminder_days
          : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        const contentMode = args.content_mode === "append" ||
            args.content_mode === "replace" ||
            args.content_mode === "remove"
          ? args.content_mode
          : undefined;
        const contentText = typeof args.content_text === "string"
          ? args.content_text
          : undefined;
        const contentOldText = typeof args.content_old_text === "string"
          ? args.content_old_text
          : undefined;
        const replaceFullContent =
          typeof args.replace_full_content === "boolean"
            ? args.replace_full_content
            : undefined;
        return await updateNote(
          supabase,
          userId,
          noteId,
          title,
          content,
          reminderType,
          reminderDate,
          reminderDays,
          tags,
          contentMode,
          contentText,
          contentOldText,
          replaceFullContent,
        );
      }

      case "delete_note": {
        if (!supabase) {
          return "Supabase client not available for note deletion";
        }
        const userId = context.userId || "";
        if (!userId) {
          return "User context required for note deletion";
        }
        const noteId = typeof args.note_id === "string" ? args.note_id : "";
        return await deleteNote(supabase, userId, noteId);
      }

      case "search_notes": {
        if (!supabase) {
          return "Supabase client not available for note search";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        const searchQuery = typeof args.search_query === "string"
          ? args.search_query
          : undefined;
        const includeArchived = typeof args.include_archived === "boolean"
          ? args.include_archived
          : false;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        return await searchNotes(
          supabase,
          userId,
          calendarId,
          searchQuery,
          includeArchived,
          tags,
        );
      }

      case "get_recent_orion_briefings": {
        if (!supabase) {
          return "Supabase client not available for Orion briefings lookup";
        }
        const userId = context.userId || "";
        if (!userId) {
          return "User ID not available in context";
        }
        const taskType = typeof args.task_type === "string"
          ? args.task_type
          : undefined;
        const sinceHours = typeof args.since_hours === "number"
          ? args.since_hours
          : 72;
        const limit = typeof args.limit === "number" ? args.limit : 10;
        const sinceDate = typeof args.since_date === "string" ? args.since_date : undefined;
        const untilDate = typeof args.until_date === "string" ? args.until_date : undefined;
        const instrument = typeof args.instrument === "string" ? args.instrument : undefined;
        return await getRecentOrionBriefings(
          supabase,
          userId,
          taskType,
          sinceHours,
          limit,
          sinceDate,
          untilDate,
          instrument,
        );
      }

      case "search_conversations": {
        if (!supabase) {
          return "Supabase client not available for conversation search";
        }
        const userId = context.userId || "";
        if (!userId) {
          return "User ID not available in context";
        }
        const query = typeof args.query === "string" ? args.query : "";
        const sinceDays = typeof args.since_days === "number"
          ? args.since_days
          : 30;
        const limit = typeof args.limit === "number" ? args.limit : 5;
        return await searchConversations(
          supabase,
          userId,
          query,
          sinceDays,
          limit,
        );
      }

      case "get_conversation": {
        if (!supabase) {
          return "Supabase client not available for conversation fetch";
        }
        const userId = context.userId || "";
        if (!userId) {
          return "User ID not available in context";
        }
        const conversationId = typeof args.conversation_id === "string"
          ? args.conversation_id
          : "";
        return await getConversation(supabase, userId, conversationId);
      }

      case "analyze_image": {
        const imageUrl = typeof args.image_url === "string"
          ? args.image_url
          : "";
        const analysisFocus = typeof args.analysis_focus === "string"
          ? args.analysis_focus
          : "overview";
        const tradeContext = typeof args.trade_context === "string"
          ? args.trade_context
          : undefined;
        return analyzeImage(imageUrl, analysisFocus, tradeContext);
      }

      case "get_tag_definition": {
        if (!supabase) {
          return "Supabase client not available for tag lookup";
        }
        const userId = context.userId || "";
        const tagName = typeof args.tag_name === "string" ? args.tag_name : "";
        return await getTagDefinition(supabase, userId, tagName);
      }

      case "save_tag_definition": {
        if (!supabase) {
          return "Supabase client not available for saving tag definition";
        }
        const userId = context.userId || "";
        const tagName = typeof args.tag_name === "string" ? args.tag_name : "";
        const definition = typeof args.definition === "string"
          ? args.definition
          : "";
        return await saveTagDefinition(supabase, userId, tagName, definition);
      }

      case "update_memory": {
        if (!supabase) {
          return "Supabase client not available for memory update";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        // Pass-through: validation + permission gating live inside
        // updateMemory. Defaulting op to ADD preserves pre-Step-5
        // behaviour for any caller (or older prompt) that omits it.
        return await updateMemory(supabase, userId, calendarId, {
          op: typeof args.op === "string" ? args.op as MemoryOp : "ADD",
          section: args.section as MemorySection,
          new_insights: Array.isArray(args.new_insights)
            ? args.new_insights.map((i) => String(i))
            : undefined,
          target_text: typeof args.target_text === "string" ? args.target_text : undefined,
          new_text: typeof args.new_text === "string" ? args.new_text : undefined,
          // Chat function = full ops. briefing-agent overrides via its own
          // allowedOps (see run-orion-task/briefing-agent.ts). The context
          // field carries the per-caller override when present.
          allowedOps: context.allowedMemoryOps,
        });
      }

      case "apply_rule_change": {
        if (!supabase) {
          return "Supabase client not available for apply_rule_change";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        return await applyRuleChange(supabase, userId, calendarId, {
          event_type: args.event_type as EpisodicEventType,
          summary: typeof args.summary === "string" ? args.summary : "",
          metadata: { conversation_id: context.conversationId },
          memory_op: (typeof args.memory_op === "string"
            ? args.memory_op
            : "ADD") as MemoryOp,
          memory_section: args.memory_section as MemorySection,
          new_insights: Array.isArray(args.new_insights)
            ? args.new_insights.map((i) => String(i))
            : undefined,
          target_text: typeof args.target_text === "string"
            ? args.target_text
            : undefined,
          new_text: typeof args.new_text === "string"
            ? args.new_text
            : undefined,
          allowedOps: context.allowedMemoryOps,
        });
      }

      case "record_event": {
        if (!supabase) {
          return "Supabase client not available for record_event";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        // Pass-through dispatcher: hand args to episodic.ts unmodified so
        // its validator can produce an actionable error for any shape
        // problems. We do NOT coerce types here (e.g. via String(t)) —
        // that would silently mask the validator's "tags must be strings"
        // and "event_type must be one of ..." rejections.
        return await recordEvent(supabase, userId, calendarId, {
          event_type: args.event_type as EpisodicEventType,
          summary: args.summary as string,
          tags: args.tags as string[] | undefined,
          metadata: {
            conversation_id: context.conversationId,
            ...(args.metadata as Record<string, unknown> | undefined),
          },
        });
      }

      case "recall_events": {
        if (!supabase) {
          return "Supabase client not available for recall_events";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        // Same pass-through philosophy as record_event: normalizeRecallFilter
        // handles bad types, empty arrays, and clamping. Avoid pre-coercion
        // here so that filter logic is testable in one place.
        const result = await recallEvents(supabase, userId, calendarId, {
          event_types: args.event_types as EpisodicEventType[] | undefined,
          tags: args.tags as string[] | undefined,
          since: args.since as string | undefined,
          query: args.query as string | undefined,
          limit: args.limit as number | undefined,
        });
        // Format for the LLM: header line + one line per event. Keeps the
        // model's parsing job trivial and the response token-cheap.
        if (result.events.length === 0) return result.message;
        const lines = result.events.map((e) =>
          `- [${e.occurred_at}] (${e.event_type}) ${e.summary}${
            e.tags.length > 0 ? ` [tags: ${e.tags.join(", ")}]` : ""
          }`
        );
        return `${result.message}\n${lines.join("\n")}`;
      }

      case "set_reminder": {
        return await executeSetReminder(args.reminders, context, supabase);
      }

      case "list_reminders": {
        return await executeListReminders(context, supabase);
      }

      case "cancel_reminder": {
        const id = typeof args.id === "string" ? args.id : "";
        const batchId = typeof args.batch_id === "string" ? args.batch_id : "";
        return await executeCancelReminder(id, batchId, context, supabase);
      }

      case "edit_reminder": {
        return await executeEditReminder(args, context, supabase);
      }

      // -- Merged action-dispatched tools: re-dispatch to the per-action
      //    handler above. Param names are kept identical so args pass through
      //    untouched.
      case "manage_note": {
        const action = typeof args.action === "string" ? args.action : "";
        const target: Record<string, string> = {
          search: "search_notes",
          create: "create_note",
          update: "update_note",
          delete: "delete_note",
        };
        const t = target[action];
        if (!t) {
          return JSON.stringify({
            success: false,
            error: `manage_note: unknown action "${action}". Use search|create|update|delete.`,
          });
        }
        return await executeCustomTool(t, args, context, supabase);
      }

      case "manage_event": {
        const action = typeof args.action === "string" ? args.action : "";
        const target: Record<string, string> = {
          record: "record_event",
          recall: "recall_events",
        };
        const t = target[action];
        if (!t) {
          return JSON.stringify({
            success: false,
            error: `manage_event: unknown action "${action}". Use record|recall.`,
          });
        }
        return await executeCustomTool(t, args, context, supabase);
      }

      case "manage_tag": {
        const action = typeof args.action === "string" ? args.action : "";
        const target: Record<string, string> = {
          get: "get_tag_definition",
          save: "save_tag_definition",
        };
        const t = target[action];
        if (!t) {
          return JSON.stringify({
            success: false,
            error: `manage_tag: unknown action "${action}". Use get|save.`,
          });
        }
        return await executeCustomTool(t, args, context, supabase);
      }

      case "recall_conversations": {
        const action = typeof args.action === "string" ? args.action : "";
        const target: Record<string, string> = {
          search: "search_conversations",
          get: "get_conversation",
        };
        const t = target[action];
        if (!t) {
          return JSON.stringify({
            success: false,
            error: `recall_conversations: unknown action "${action}". Use search|get.`,
          });
        }
        return await executeCustomTool(t, args, context, supabase);
      }

      case "manage_reminder": {
        const action = typeof args.action === "string" ? args.action : "";
        const target: Record<string, string> = {
          set: "set_reminder",
          list: "list_reminders",
          cancel: "cancel_reminder",
          edit: "edit_reminder",
        };
        const t = target[action];
        if (!t) {
          return JSON.stringify({
            success: false,
            error: `manage_reminder: unknown action "${action}". Use set|list|cancel|edit.`,
          });
        }
        return await executeCustomTool(t, args, context, supabase);
      }

      default:
        return `Unknown custom tool: ${toolName}`;
    }
  } catch (error) {
    return `Tool execution error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get all custom tool definitions
 */
export function getAllCustomTools(): GeminiFunctionDeclaration[] {
  return [
    searchWebTool,
    scrapeUrlTool,
    getMarketDataTool,
    generateChartTool,
    analyzeImageTool,
    getRecentOrionBriefingsTool,
    updateMemoryTool,
    applyRuleChangeTool,
    // Merged action-dispatched tools (replace the former CRUD clusters).
    manageNoteTool,
    manageEventTool,
    manageTagTool,
    recallConversationsTool,
    manageReminderTool,
  ];
}

/**
 * Name lookup set derived from getAllCustomTools() so the dispatcher in
 * index.ts can't drift out of sync with the registered tool list.
 */
export const CUSTOM_TOOL_NAMES: ReadonlySet<string> = new Set(
  getAllCustomTools().map((t) => t.name),
);
