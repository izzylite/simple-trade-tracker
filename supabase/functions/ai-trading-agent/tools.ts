/**
 * AI Trading Agent - Tool Definitions and Implementations
 * All custom tools (non-MCP) are defined and implemented here
 */

import { log } from "../_shared/supabase.ts";
import { fetchSerperScrape } from "../_shared/serperScrape.ts";
import { scrapeWithFallback } from "../_shared/scrapeProvider.ts";
import { getMarketPrice } from "../_shared/prices.ts";
import {
  SLASH_COMMAND_TAG,
  GAME_PLAN_TAG,
  LESSON_LEARNED_TAG,
  RISK_MANAGEMENT_TAG,
  PSYCHOLOGY_TAG,
  GENERAL_TAG,
  STRATEGY_TAG,
  INSIGHT_TAG,
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
 * Universal market price tool — Yahoo Finance (intraday) as primary, with
 * internal fallbacks to CoinGecko and Frankfurter. Covers all asset classes.
 */
export const getMarketPriceTool: GeminiFunctionDeclaration = {
  name: "get_market_price",
  description:
    `Get intraday price data for any instrument — forex, indices, commodities, crypto, bonds, or stocks. Returns: price, day change %, day high/low, previous close, and data source.

The tool automatically falls back to alternative providers internally if the primary source is unavailable. When fallback data is returned, the response will include a note indicating the source and freshness (e.g. "end-of-day reference rate" for forex fallback) — respect that in your wording (don't say "currently trading at" for end-of-day data).

COMMON SYMBOLS (Yahoo Finance format):
  Forex: EURUSD=X, GBPUSD=X, USDJPY=X, USDCHF=X, USDCAD=X, AUDUSD=X, NZDUSD=X, EURGBP=X, EURJPY=X, GBPJPY=X, DX-Y.NYB (Dollar Index)
  Indices: ^GSPC (S&P 500), ^IXIC (Nasdaq), ^DJI (Dow), ^VIX, ^FTSE, ^GDAXI (DAX), ^N225 (Nikkei), ^HSI (Hang Seng)
  Commodities: GC=F (Gold), SI=F (Silver), CL=F (WTI Oil), BZ=F (Brent), NG=F (Natural Gas), HG=F (Copper)
  Crypto: BTC-USD, ETH-USD, SOL-USD, XRP-USD, ADA-USD, DOGE-USD
  Bonds: ^TNX (10Y Yield), ^FVX (5Y), ^TYX (30Y), TLT (20Y+ ETF)
  Stocks: AAPL, MSFT, NVDA, GOOGL, META, AMZN, TSLA, JPM
  ETFs: SPY, QQQ, IWM`,
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description:
          'Yahoo Finance symbol. Examples: "EURUSD=X", "^GSPC", "GC=F", "BTC-USD", "AAPL"',
      },
    },
    required: ["symbol"],
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
 * Create note tool definition
 */
export const createNoteTool: GeminiFunctionDeclaration = {
  name: "create_note",
  description: `Create a new note for the user in their trading calendar.

USE CASES:
- Save trading strategies, insights, lessons learned, or game plans for the user
- Save a reusable prompt as a ${SLASH_COMMAND_TAG} note (see "Slash Commands" in system prompt) — title becomes the / autocomplete name, content becomes the instruction

⚠️ CANNOT create ${AGENT_MEMORY_TAG} notes - use update_memory tool instead (it auto-creates if needed).

Content should be in plain text format. User ID and Calendar ID are automatically provided from context.`,
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Note title (concise and descriptive)",
      },
      content: {
        type: "string",
        description:
          "Note content in plain text format. Use clear paragraphs and line breaks for readability. Do not use HTML tags.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          `Categorize the note. Available: "${STRATEGY_TAG}", "${GAME_PLAN_TAG}", "${INSIGHT_TAG}", "${LESSON_LEARNED_TAG}", "${RISK_MANAGEMENT_TAG}", "${PSYCHOLOGY_TAG}", "${GENERAL_TAG}", "${SLASH_COMMAND_TAG}" (reusable / commands — see system prompt). Use "${AGENT_MEMORY_TAG}" ONLY for AI memory notes.`,
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description:
          'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days)',
      },
      reminder_date: {
        type: "string",
        description:
          'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".',
      },
      reminder_days: {
        type: "array",
        items: {
          type: "string",
          enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        description:
          'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]',
      },
      color: {
        type: "string",
        description:
          "Optional background color name. Available: 'red', 'pink', 'purple', 'deepPurple', 'indigo', 'blue', 'lightBlue', 'cyan', 'teal', 'green', 'lightGreen', 'lime', 'yellow', 'amber', 'orange', 'deepOrange', 'brown', 'grey', 'blueGrey'. If not provided, a random color will be assigned.",
      },
    },
    required: ["title", "content"],
  },
};

/**
 * Update memory tool definition - dedicated tool for memory management with merge logic
 */
export const updateMemoryTool: GeminiFunctionDeclaration = {
  name: "update_memory",
  description:
    `Mutate your persistent memory with one of four ops:

- ADD (default): append new bullets to a section. The server dedups against existing bullets — provide ONLY new information.
- UPDATE: replace ONE existing bullet with refined text. Use when a fact changed but the topic is the same (e.g. user changed daily stop from $200 to $150 and the old "$200 stop" bullet is now wrong).
- REMOVE: delete ONE existing bullet that is no longer true (e.g. user no longer trades a session they used to avoid).
- REPLACE_SECTION: replace the entire ACTIVE_FOCUS section in one shot. Only valid for ACTIVE_FOCUS — other sections must use ADD/UPDATE/REMOVE.

UPDATE and REMOVE identify the target via fuzzy text matching (Jaccard ≥ 0.85). If multiple bullets match or none match, the call is rejected — you'll receive the section's current contents to retry with a more specific target_text.

SECTIONS:
- TRADER_PROFILE — style, risk tolerance, baseline preferences
- PERFORMANCE_PATTERNS — setups/sessions that work, with win rates + evidence
- STRATEGY_PREFERENCES — user-stated rules, entry criteria, risk management
- PSYCHOLOGICAL_PATTERNS — emotional triggers, tilt patterns, behavioral biases
- LESSONS_LEARNED — errors to avoid, corrections, communication preferences
- ACTIVE_FOCUS — current goals (this is the only section that supports REPLACE_SECTION)

FORMAT each insight as: "[Pattern/Rule]: [Evidence] [Confidence: High/Med/Low] [YYYY-MM]"

EXAMPLES:
ADD:    op="ADD",    section="PERFORMANCE_PATTERNS", new_insights=["London scalps: 72% wr on 15 trades [High] [2026-04]"]
UPDATE: op="UPDATE", section="STRATEGY_PREFERENCES", target_text="Daily stop $200", new_text="Daily stop $150 [High] [2026-04]"
REMOVE: op="REMOVE", section="STRATEGY_PREFERENCES", target_text="Avoids Asian session"
REPLACE_SECTION: op="REPLACE_SECTION", section="ACTIVE_FOCUS", new_insights=["Improve B+ execution discipline"]`,
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
    `ATOMIC PAIRING: logs an episodic event AND mutates core memory in a SINGLE call. Use this whenever the user changes a rule, makes a decision, or corrects something — INSTEAD OF calling record_event + update_memory separately.

WHEN TO CALL:
- User states they CHANGED, DECIDED, CORRECTED, TIGHTENED, LOOSENED, SWITCHED, or PIVOTED something.
- User says "I've decided", "I'm changing", "from now on", "going forward", "actually", "you're wrong", "no it's", "let's change".
- These triggers previously routed to record_event — now route to apply_rule_change so the stable memory state stays in sync with the event log.

WHEN NOT TO CALL (use record_event alone instead):
- You observed a pattern from data (no rule change) → record_event(pattern_observed)
- A strategy was discussed but no rule change was decided → record_event(strategy_discussion)
- You're extracting bullets from a note → update_memory(op=ADD)

MEMORY OP CHOICE:
- memory_op=UPDATE — for CHANGED facts: replace one bullet (provide target_text + new_text)
- memory_op=REMOVE — for REVERSED preferences: delete one bullet (provide target_text)
- memory_op=ADD — for genuinely-NEW rules with no existing bullet to update (provide new_insights)

If memory_op rejection happens (no match / multi-match), the event is still logged; retry the memory leg only by calling update_memory directly with a sharper target_text.

Example — user says "I'm tightening my max leverage from 2% to 1.5%":
  apply_rule_change(
    event_type="rule_changed",
    summary="User tightened max leverage from 2% to 1.5%",
    memory_op="UPDATE",
    memory_section="STRATEGY_PREFERENCES",
    target_text="Leverage Min 0.5% Max 2%",
    new_text="Leverage: Min 0.5%, Max 1.5% [High] [2026-04]"
  )`,
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
 * Record an episodic event — time-stamped fact about *what happened*
 * (separate from update_memory, which captures *what is true now*).
 *
 * Backed by the agent_memory_events table. Capped at 50 writes per
 * (user, calendar) per day to prevent runaway prompts from spamming
 * the log.
 */
export const recordEventTool: GeminiFunctionDeclaration = {
  name: "record_event",
  description:
    `Append a time-stamped event to the episodic log. Use this to capture *what happened* during a session — corrections, rule changes, observed patterns, decisions — separately from update_memory which captures the trader's stable profile.

WHEN TO CALL:
- The user corrected something you said: event_type="user_correction"
- The user changed a rule (stop, size, session, setup): event_type="rule_changed"
- A pattern was discovered (e.g. losing streaks after 2 wins): event_type="pattern_observed"
- A specific trading decision was discussed and agreed: event_type="decision_made"
- A strategy was discussed in detail: event_type="strategy_discussion"

WHEN NOT TO CALL:
- Casual chitchat, simple data lookups, or routine acknowledgements
- Anything the user wouldn't expect you to "remember happened on a specific day"

FORMAT summary as ONE past-tense sentence in third person, max 500 chars:
- Good: "User changed daily stop from $200 to $150 due to recent drawdown"
- Bad: "I should remember that the user's stop is now $150" (first person, future-facing)
- Bad: "Stop change" (too terse)

Limit: 50 events per day per (user, calendar). Excess calls return a "log full" notice — do NOT retry on this turn.`,
  parameters: {
    type: "object",
    properties: {
      event_type: {
        type: "string",
        enum: [
          "pattern_observed",
          "user_correction",
          "strategy_discussion",
          "decision_made",
          "rule_changed",
        ],
        description: "What kind of event to log.",
      },
      summary: {
        type: "string",
        description:
          "Single past-tense sentence describing the event (max 500 chars).",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional tags for later recall (e.g. ['risk', 'london-session']).",
      },
      metadata: {
        type: "object",
        description:
          "Optional structured context: trade_ids, source_note_id, confidence, etc.",
      },
    },
    required: ["event_type", "summary"],
  },
};

/**
 * Recall episodic events — answers "have we discussed X / what changed
 * last week / when did we decide Y" without scraping chat history.
 *
 * Backed by agent_memory_events. At least one filter is required to
 * avoid full-table paginates — unfiltered recall is almost never what
 * the agent actually wants.
 */
export const recallEventsTool: GeminiFunctionDeclaration = {
  name: "recall_events",
  description:
    `Query the episodic event log to answer questions about *what happened* across past sessions. Prefer this over search_chat_history for "have we discussed X", "last time we talked about Y", "what changed recently" — events are structured and timestamped, chat history is fuzzy.

REQUIRES at least one filter (event_types, tags, since, or query). Unfiltered calls are rejected.

FILTERS (combine freely):
- event_types: limit to specific kinds (rule_changed, user_correction, etc.)
- tags: events tagged with ALL of these (intersection)
- since: ISO timestamp — only events on/after this date
- query: substring match on the event summary (case-insensitive)

Returns at most 10 events by default (50 max), most recent first.

EXAMPLES:
- "What rules has the user changed in the last month?" → since=<30d ago>, event_types=['rule_changed']
- "Have we discussed FOMC before?" → query='FOMC'
- "Recent corrections about position sizing" → query='position', event_types=['user_correction']`,
  parameters: {
    type: "object",
    properties: {
      event_types: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "pattern_observed",
            "user_correction",
            "strategy_discussion",
            "decision_made",
            "rule_changed",
          ],
        },
        description: "Filter to these event types only.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Match events containing ALL of these tags.",
      },
      since: {
        type: "string",
        description: "ISO timestamp — only return events on/after this date.",
      },
      query: {
        type: "string",
        description: "Case-insensitive substring match on summary text.",
      },
      limit: {
        type: "number",
        description: "Max events to return (1..50, default 10).",
      },
    },
  },
};

/**
 * Update note tool definition
 */
export const updateNoteTool: GeminiFunctionDeclaration = {
  name: "update_note",
  description:
    `Update an existing note. By default you can only update AI-created notes (by_assistant=true). EXCEPTION: notes tagged "${SLASH_COMMAND_TAG}" are user-owned but you may still update them on user request (e.g. "change my Daily Review slash command to also flag oversized losses").

⚠️ CANNOT update ${AGENT_MEMORY_TAG} notes - use update_memory tool instead for memory management.

CONTENT EDITING — choose ONE approach:

A) INCREMENTAL EDITS (REQUIRED for ${SLASH_COMMAND_TAG} when user says "also", "add", "change X to Y", "remove X", etc.)
   1. Read the note's current text first (via search_notes or recent context).
   2. Set content_mode + the matching field(s):
      - "append": needs content_text (added on a new line at the end).
      - "replace": needs content_old_text (exact, unique substring) and content_text.
      - "remove": needs content_old_text (exact, unique substring).
   The server REJECTS with current content echoed back if content_old_text is missing or not unique. Re-read and retry — do not guess.

B) FULL REWRITE — use ONLY when the user explicitly asks to rewrite from scratch.
   Set "content" to the entire new note. For ${SLASH_COMMAND_TAG} notes you MUST also set replace_full_content=true to confirm the destructive overwrite, otherwise the call is rejected.

Note: incremental edits do not work on rich-text (Draft.js JSON) notes — those require full overwrite.

USE CASES:
- Tweak a strategy / insight → content_mode: "append" or "replace"
- Add/modify/remove tags or reminders → tags / reminder_* params
- Edit a saved ${SLASH_COMMAND_TAG} (user's reusable / prompt) → incremental edits, NOT full rewrite`,
  parameters: {
    type: "object",
    properties: {
      note_id: {
        type: "string",
        description: "ID of the note to update",
      },
      title: {
        type: "string",
        description: "New title (optional - only include if changing)",
      },
      content: {
        type: "string",
        description:
          "FULL REPLACEMENT of the note's content. Destructive — wipes existing text. Prefer content_mode for partial edits. SLASH_COMMAND notes additionally require replace_full_content=true. Plain text, no HTML.",
      },
      content_mode: {
        type: "string",
        enum: ["append", "replace", "remove"],
        description:
          "Incremental content edit. Mutually exclusive with the 'content' param. Not allowed on rich-text (Draft.js JSON) notes.",
      },
      content_text: {
        type: "string",
        description:
          "New text. Required for content_mode='append' (added at end on a new line) or 'replace' (replaces content_old_text). Plain text, no HTML.",
      },
      content_old_text: {
        type: "string",
        description:
          "Exact, unique substring of the current note to find. Required for content_mode='replace' or 'remove'. Whitespace-sensitive — must match the note verbatim. Read the note first.",
      },
      replace_full_content: {
        type: "boolean",
        description:
          "Required confirmation when overwriting a SLASH_COMMAND note via the full 'content' param. Prevents accidental destructive rewrites of user automations. Set true only when the user explicitly asked to rewrite the entire command.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          `Updated tags (optional). Available: "${STRATEGY_TAG}", "${GAME_PLAN_TAG}", "${INSIGHT_TAG}", "${LESSON_LEARNED_TAG}", "${RISK_MANAGEMENT_TAG}", "${PSYCHOLOGY_TAG}", "${GENERAL_TAG}", "${SLASH_COMMAND_TAG}", "${AGENT_MEMORY_TAG}".`,
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description:
          'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days). Use "none" to remove reminders.',
      },
      reminder_date: {
        type: "string",
        description:
          'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".',
      },
      reminder_days: {
        type: "array",
        items: {
          type: "string",
          enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        description:
          'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]',
      },
    },
    required: ["note_id"],
  },
};

/**
 * Delete note tool definition
 */
export const deleteNoteTool: GeminiFunctionDeclaration = {
  name: "delete_note",
  description:
    `Delete an existing note. By default you can only delete AI-created notes (by_assistant=true). EXCEPTION: notes tagged "${SLASH_COMMAND_TAG}" are user-owned but you may delete them on explicit user request (e.g. "remove my Quick Review slash command"). Use this to remove outdated or incorrect notes.`,
  parameters: {
    type: "object",
    properties: {
      note_id: {
        type: "string",
        description: "ID of the note to delete",
      },
    },
    required: ["note_id"],
  },
};

/**
 * Search notes tool definition
 */
export const searchNotesTool: GeminiFunctionDeclaration = {
  name: "search_notes",
  description: `Search and retrieve notes from the user's trading calendar.

CRITICAL: At the START of EVERY session, search with tags: ["${AGENT_MEMORY_TAG}"] to retrieve your persistent memory about this trader.

AVAILABLE TAGS (use these to filter by category):
- "${STRATEGY_TAG}" - Trading strategies and methodologies
- "${GAME_PLAN_TAG}" - Daily/weekly trading plans and preparation
- "${INSIGHT_TAG}" - Market observations and realizations
- "${LESSON_LEARNED_TAG}" - Post-trade reflections and mistakes to avoid
- "${RISK_MANAGEMENT_TAG}" - Position sizing, stop loss rules, risk parameters
- "${PSYCHOLOGY_TAG}" - Trading mindset, emotions, mental frameworks
- "${GENERAL_TAG}" - Miscellaneous notes
- "${SLASH_COMMAND_TAG}" - User-saved reusable prompts triggered via "/" in chat (see system prompt)
- "${AGENT_MEMORY_TAG}" - AI persistent memory (retrieve at session start)

SMART QUERYING EXAMPLES:
- Analyze user's risk approach: tags: ["${RISK_MANAGEMENT_TAG}"]
- Review strategies before trading: tags: ["${STRATEGY_TAG}"]
- Understand daily preparation: tags: ["${GAME_PLAN_TAG}"]
- Learn from past mistakes: tags: ["${LESSON_LEARNED_TAG}"]
- List user's saved slash commands (e.g. "what slash commands do I have?"): tags: ["${SLASH_COMMAND_TAG}"]
- Combine with search_query for precision: tags: ["${STRATEGY_TAG}"], search_query: "scalping"

EMBEDDED IMAGES:
- Notes may contain embedded images (diagrams, charts, frameworks)
- Results show: [Embedded images: url1, url2] when images exist
- Use analyze_image tool on these URLs for visual context
- Especially valuable for: strategy diagrams, setup examples, risk frameworks

Returns both user-created and AI-created notes. User ID and Calendar ID are automatically provided from context.`,
  parameters: {
    type: "object",
    properties: {
      search_query: {
        type: "string",
        description:
          "Optional text search to filter notes by title or content. Combine with tags for precision.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          `Filter by category. Available: "${STRATEGY_TAG}", "${GAME_PLAN_TAG}", "${INSIGHT_TAG}", "${LESSON_LEARNED_TAG}", "${RISK_MANAGEMENT_TAG}", "${PSYCHOLOGY_TAG}", "${GENERAL_TAG}", "${SLASH_COMMAND_TAG}", "${AGENT_MEMORY_TAG}". Notes must have ALL specified tags.`,
      },
      include_archived: {
        type: "boolean",
        description: "Whether to include archived notes. Default is false.",
      },
    },
    required: [],
  },
};

/**
 * Get recent Orion task briefings tool definition
 */
export const getRecentOrionBriefingsTool: GeminiFunctionDeclaration = {
  name: "get_recent_orion_briefings",
  description: `Retrieve recent Orion task briefings (Market Research, Daily Analysis, Weekly Review, Monthly Rollup) that Orion (You) has already sent this user.

Use this whenever the user references a briefing or alert you sent — whether past or just-delivered. Trigger signals:
- Backward refs: "what did you say about…", "your last alert", "summarize your briefings this week"
- Forward refs: "new briefing is out", "the latest briefing", "this briefing", "the alert you just sent"
- Implicit refs: user cites an event/claim as being "in the briefing" or "from your alert" without quoting it in full

When the user references a briefing AND asks a market/trading question, call this FIRST (before search_web) so you know what the briefing actually said — do not assume its contents from the user's paraphrase.

Do NOT use this for general market questions with no briefing reference; use search_web for those.

Results include: title, significance (low/medium/high), task type, plain-text body, and timestamp. User ID is automatically provided from context.`,
  parameters: {
    type: "object",
    properties: {
      task_type: {
        type: "string",
        description:
          'Optional filter by task type. Use when the user asks about a specific type, e.g. "what did you tell me in the weekly review".',
        enum: ["market_research", "daily_analysis", "weekly_review", "monthly_rollup"],
      },
      since_hours: {
        type: "number",
        description:
          "Optional: only return briefings from the last N hours. E.g. 24 for today, 168 for the past week. Default is 72 (past 3 days).",
      },
      limit: {
        type: "number",
        description: "Max briefings to return. Default 10, max 30.",
      },
    },
    required: [],
  },
};

/**
 * Search past conversations tool definition (Tier 1)
 */
export const searchConversationsTool: GeminiFunctionDeclaration = {
  name: "search_conversations",
  description: `Search the user's past chat conversations with you by keyword. Returns lightweight metadata (title + snippet + timestamp), NOT full message bodies. Use get_conversation(id) afterwards if a result looks relevant.

ONLY USE WHEN the user explicitly references a past chat — phrases like "last time", "yesterday we discussed", "you told me before", "our previous conversation", "remember when I asked about...". Do NOT use on every turn to pad context; ${AGENT_MEMORY_TAG} (via search_notes with tags:["${AGENT_MEMORY_TAG}"]) is the primary long-term memory.

Returns: [{ id, title, message_count, created_at, updated_at, snippet }]. The snippet is the first ~200 chars of the most recent message in each conversation.`,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search term to match against conversation titles and message content. Use the subject the user referenced (e.g. 'Powell', 'risk management', 'EURUSD strategy').",
      },
      since_days: {
        type: "number",
        description:
          "Optional: only return conversations updated in the last N days. Default 30.",
      },
      limit: {
        type: "number",
        description: "Max conversations to return. Default 5, max 10.",
      },
    },
    required: ["query"],
  },
};

/**
 * Fetch a specific conversation's full transcript tool definition (Tier 2)
 */
export const getConversationTool: GeminiFunctionDeclaration = {
  name: "get_conversation",
  description: `Fetch the full message transcript of a specific past conversation by id. Call this ONLY after search_conversations has identified a relevant conversation — do not guess conversation ids.

Each conversation is capped at 50 messages so the transcript is bounded (roughly 5-12k tokens). The returned transcript is formatted as "user: ..." / "orion: ..." turns with timestamps.`,
  parameters: {
    type: "object",
    properties: {
      conversation_id: {
        type: "string",
        description: "The id of the conversation to fetch (from search_conversations results).",
      },
    },
    required: ["conversation_id"],
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
 * Get tag definition tool - look up user-defined meanings for custom tags
 */
export const getTagDefinitionTool: GeminiFunctionDeclaration = {
  name: "get_tag_definition",
  description: `Look up the user's definition for a custom trading tag.

USE WHEN: You encounter a tag you don't understand (e.g., "Confluence:3x Displacement", "Setup:ICT OTE", "Risk:A++ Setup").

WORKFLOW:
1. If tag meaning is unclear, call this tool to get user's definition
2. If no definition exists, you may SUGGEST a definition based on context
3. ALWAYS ask user permission before saving a new definition
4. Present your suggested definition and ask: "Would you like me to save this definition for future reference?"

Returns the user's explanation of what this tag means to them, or null if no definition exists.`,
  parameters: {
    type: "object",
    properties: {
      tag_name: {
        type: "string",
        description:
          "The exact tag name to look up (e.g., 'Confluence:3x Displacement')",
      },
    },
    required: ["tag_name"],
  },
};

/**
 * Save tag definition tool - save a definition with user permission
 */
export const saveTagDefinitionTool: GeminiFunctionDeclaration = {
  name: "save_tag_definition",
  description:
    `Save or update a definition for a trading tag. IMPORTANT: Only use this AFTER getting explicit user permission.

WORKFLOW:
1. First suggest a definition to the user
2. Wait for user confirmation
3. Only then call this tool to save

Never call this tool without user consent.`,
  parameters: {
    type: "object",
    properties: {
      tag_name: {
        type: "string",
        description: "The exact tag name to define",
      },
      definition: {
        type: "string",
        description: "The definition/meaning of the tag",
      },
    },
    required: ["tag_name", "definition"],
  },
};

/**
 * ============================================================================
 * TOOL IMPLEMENTATIONS
 * ============================================================================
 */

/**
 * Execute web search using Serper API
 */
export async function executeWebSearch(
  query: string,
  searchType: string = "search",
  timeRange?: string,
): Promise<string> {
  try {
    const serperApiKey = Deno.env.get("SERPER_API_KEY");
    if (!serperApiKey) {
      return "Web search not configured";
    }

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

    if (!response.ok) {
      return `Search failed: ${response.status}`;
    }

    const data = await response.json();

    // Check if we have any results
    // For search endpoint: data.organic
    // For news endpoint: data.news
    const hasOrganic = data.organic && data.organic.length > 0;
    const hasNews = data.news && data.news.length > 0;
    const hasKnowledge = data.knowledgeGraph &&
      (data.knowledgeGraph.title || data.knowledgeGraph.description);

    if (!hasOrganic && !hasNews && !hasKnowledge) {
      return `⚠️ NO RESULTS FOUND for query: "${query}". Try different search terms or use your market knowledge.`;
    }

    let results = `Search results for: "${query}"\n\n`;

    if (hasOrganic) {
      results += "Top Results:\n";
      for (const result of data.organic.slice(0, 5)) {
        results +=
          `\n- ${result.title}\n  ${result.snippet}\n  ${result.link}\n`;
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
  } catch (error) {
    return `Search error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Scrape URL content using Tavily Extract with Serper fallback.
 *
 * Thin chat-shaped wrapper around scrapeProvider.scrapeWithFallback. Tavily
 * Extract is the primary path (LLM-tuned content, free 10-key pool); Serper
 * scrape is the fallback when Tavily can't render a URL (dynamic JS pages,
 * pool exhausted, transient extract failure). The shared DB cache is keyed
 * by URL so a successful scrape from either provider serves any future call.
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
    ? await scrapeWithFallback(supabase, url)
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
 * Get cryptocurrency price using CoinGecko API
 */
export async function getCryptoPrice(coinId: string): Promise<string> {
  try {
    // Normalize coin ID to lowercase
    coinId = coinId.toLowerCase().trim();

    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

    const response = await fetch(url);

    if (!response.ok) {
      return `Failed to fetch crypto price: ${response.status}`;
    }

    const data = await response.json();

    if (!data[coinId]) {
      return `Cryptocurrency '${coinId}' not found. Try common names like: bitcoin, ethereum, solana, cardano, ripple, dogecoin`;
    }

    const coin = data[coinId];
    const priceChange = coin.usd_24h_change || 0;
    const changeSymbol = priceChange >= 0 ? "📈" : "📉";

    let result = `${coinId.toUpperCase()} Market Data:\n\n`;
    result += `💰 Price: $${
      coin.usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }\n`;
    result += `${changeSymbol} 24h Change: ${priceChange.toFixed(2)}%\n`;
    result += `📊 24h Volume: $${(coin.usd_24h_vol / 1e6).toFixed(2)}M\n`;
    result += `🏦 Market Cap: $${(coin.usd_market_cap / 1e9).toFixed(2)}B\n`;

    return result;
  } catch (error) {
    return `Crypto price error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
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
 *   1. Yahoo Finance (intraday, all asset classes) via shared cache
 *   2. CoinGecko (crypto only, near-realtime)
 *   3. Frankfurter/ECB (forex only, end-of-day)
 *
 * Each fallback tags its `source` so Gemini knows the data freshness and
 * adjusts language accordingly ("intraday" vs "end-of-day reference rate").
 */
export async function executeGetMarketPrice(
  symbol: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const trimmed = symbol.trim();
  if (!trimmed) return "Symbol is required.";

  // --- Primary: Yahoo via shared cache ---
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
        `Source: Yahoo Finance (intraday)`,
        ``,
        `Price: ${priceStr} ${snap.currency}`,
        `Day change: ${arrow} ${snap.percentChange.toFixed(2)}%`,
        `Day range: ${snap.dayLow.toFixed(dp)} – ${snap.dayHigh.toFixed(dp)}`,
        `Previous close: ${snap.previousClose.toFixed(dp)}`,
      ].join("\n");
    }
  }

  log(`Yahoo miss for ${trimmed}, trying fallbacks`, "info");

  // --- Fallback: CoinGecko for crypto symbols (BTC-USD → bitcoin) ---
  if (trimmed.endsWith("-USD")) {
    const coinMap: Record<string, string> = {
      "BTC-USD": "bitcoin",
      "ETH-USD": "ethereum",
      "SOL-USD": "solana",
      "XRP-USD": "ripple",
      "ADA-USD": "cardano",
      "DOGE-USD": "dogecoin",
      "BNB-USD": "binancecoin",
      "AVAX-USD": "avalanche-2",
      "LINK-USD": "chainlink",
      "LTC-USD": "litecoin",
    };
    const coinId = coinMap[trimmed] ??
      trimmed.replace(/-USD$/, "").toLowerCase();
    const result = await getCryptoPrice(coinId);
    if (!result.startsWith("Crypto price error") && !result.startsWith("Failed")) {
      return `${result}\nSource: CoinGecko (near-realtime, ~60s delay)`;
    }
  }

  // --- Fallback: Frankfurter for forex symbols (EURUSD=X → EUR/USD) ---
  if (trimmed.endsWith("=X") && trimmed.length >= 8) {
    const pair = trimmed.replace("=X", "");
    const base = pair.substring(0, 3);
    const quote = pair.substring(3, 6);
    if (base.length === 3 && quote.length === 3) {
      const result = await getForexPrice(base, quote);
      if (!result.startsWith("Forex rate error") && !result.startsWith("Failed")) {
        return (
          result +
          "\n⚠️ Source: Frankfurter/ECB (end-of-day reference rate — NOT intraday). " +
          "This is the last published daily rate, not a live quote. " +
          "Do NOT present this as a current or real-time price."
        );
      }
    }
  }

  return `Could not fetch price for "${trimmed}". Yahoo, CoinGecko, and Frankfurter all failed or the symbol is unrecognized.`;
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
): Promise<string> {
  try {
    const boundedLimit = Math.max(1, Math.min(30, Math.floor(limit)));
    const sinceIso = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

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

    if (taskType) {
      query = query.eq("task_type", taskType);
    }

    const { data, error } = await query;

    if (error) {
      log(`Error fetching Orion briefings: ${error.message}`, "error");
      return `Failed to fetch briefings: ${error.message}`;
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return `No Orion briefings found in the last ${sinceHours} hours${
        taskType ? ` for task type "${taskType}"` : ""
      }.`;
    }

    const lines = rows.map((r, i) => {
      const title =
        (r.metadata as { title?: string } | null)?.title ?? "Briefing";
      const sig = r.significance ? r.significance.toUpperCase() : "—";
      const body = (r.content_plain ?? "").substring(0, 800);
      return (
        `[${i + 1}] ${r.created_at} | ${r.task_type} | ${sig}\n` +
        `    Title: ${title}\n` +
        `    ${body}${(r.content_plain?.length ?? 0) > 800 ? "..." : ""}`
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
        return await executeWebSearch(query, searchType, timeRange);
      }

      case "scrape_url": {
        const url = typeof args.url === "string" ? args.url : "";
        return await scrapeUrl(url, supabase);
      }

      case "get_market_price": {
        const sym = typeof args.symbol === "string" ? args.symbol : "";
        return await executeGetMarketPrice(sym, supabase);
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
        return await getRecentOrionBriefings(
          supabase,
          userId,
          taskType,
          sinceHours,
          limit,
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
          metadata: args.metadata as Record<string, unknown> | undefined,
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
    getMarketPriceTool,
    generateChartTool,
    createNoteTool,
    updateNoteTool,
    deleteNoteTool,
    searchNotesTool,
    getRecentOrionBriefingsTool,
    searchConversationsTool,
    getConversationTool,
    analyzeImageTool,
    getTagDefinitionTool,
    saveTagDefinitionTool,
    updateMemoryTool,
    applyRuleChangeTool,
    recordEventTool,
    recallEventsTool,
  ];
}

/**
 * Name lookup set derived from getAllCustomTools() so the dispatcher in
 * index.ts can't drift out of sync with the registered tool list.
 */
export const CUSTOM_TOOL_NAMES: ReadonlySet<string> = new Set(
  getAllCustomTools().map((t) => t.name),
);
