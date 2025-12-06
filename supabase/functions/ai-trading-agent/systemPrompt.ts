/**
 * Context-Engineered System Prompt for AI Trading Agent
 *
 * Architecture:
 * - TIER 1: Security & Memory Gate (always enforced first)
 * - TIER 2: Core Capabilities & Workflow
 * - TIER 3: Reference Documentation (schemas, examples)
 *
 * Target: ~2000 tokens core prompt (down from ~4000)
 */
import type { Calendar } from './types.ts';

// =============================================================================
// TEMPORAL CONTEXT (DST-aware trading session detection)
// =============================================================================

type TradingSession = 'Asia' | 'London' | 'NY AM' | 'NY PM' | 'After Hours';

function isDaylightSavingTime(date: Date, region: 'EU' | 'US' = 'EU'): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (region === 'EU') {
    // EU/UK DST: Last Sunday in March to last Sunday in October
    if (month < 2 || month > 9) return false;
    if (month > 2 && month < 9) return true;

    if (month === 2) {
      const lastSunday = getLastSundayOfMonth(year, 2);
      return day >= lastSunday;
    }
    if (month === 9) {
      const lastSunday = getLastSundayOfMonth(year, 9);
      return day < lastSunday;
    }
  } else {
    // US DST: Second Sunday in March to first Sunday in November
    if (month < 2 || month > 10) return false;
    if (month > 2 && month < 10) return true;

    if (month === 2) {
      const secondSunday = getNthSundayOfMonth(year, 2, 2);
      return day >= secondSunday;
    }
    if (month === 10) {
      const firstSunday = getNthSundayOfMonth(year, 10, 1);
      return day < firstSunday;
    }
  }
  return false;
}

function getLastSundayOfMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

function getNthSundayOfMonth(year: number, month: number, n: number): number {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysToFirstSunday = (7 - firstDay.getUTCDay()) % 7;
  return 1 + daysToFirstSunday + (n - 1) * 7;
}

function getCurrentTradingSession(now: Date = new Date()): TradingSession {
  const hour = now.getUTCHours();
  const isDST = isDaylightSavingTime(now, 'EU');

  // Session boundaries (UTC) - adjusted for DST
  const londonStart = isDST ? 7 : 8;
  const londonEnd = isDST ? 12 : 13;
  const nyAmStart = isDST ? 12 : 13;
  const nyAmEnd = isDST ? 17 : 18;
  const nyPmStart = isDST ? 17 : 18;
  const nyPmEnd = isDST ? 21 : 22;
  const asiaStart = isDST ? 22 : 23;
  const asiaEnd = isDST ? 7 : 8;

  if (hour >= londonStart && hour < londonEnd) return 'London';
  if (hour >= nyAmStart && hour < nyAmEnd) return 'NY AM';
  if (hour >= nyPmStart && hour < nyPmEnd) return 'NY PM';
  if (hour >= asiaStart || hour < asiaEnd) return 'Asia';

  return 'After Hours';
}

function buildTemporalContext(): string {
  const now = new Date();
  const session = getCurrentTradingSession(now);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeek = dayNames[now.getUTCDay()];
  const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;

  return `UTC: ${now.toISOString().slice(0, 16)}Z | ${dayOfWeek} | Session: ${session}${isWeekend ? ' (Weekend)' : ''}`;
}

// =============================================================================
// CALENDAR CONTEXT BUILDER (Condensed format)
// =============================================================================

function buildCalendarContextSection(calendarContext?: Partial<Calendar>): string {
  if (!calendarContext) return '';

  const winRate = typeof calendarContext.win_rate === 'number'
    ? `${(calendarContext.win_rate * 100).toFixed(1)}%`
    : '—';
  const totalTrades = calendarContext.total_trades ?? '—';
  const totalPnl = calendarContext.total_pnl ?? '—';
  const currentBalance = calendarContext.current_balance ?? calendarContext.account_balance ?? '—';
  const tags = calendarContext.tags?.length ? calendarContext.tags.join(', ') : 'None';

  // Condensed filter summary
  const filters = calendarContext.economic_calendar_filters;
  let filterLine = 'Filters: None (all events allowed)';
  if (filters) {
    const currencies = filters.currencies?.length ? filters.currencies.join(',') : 'ALL';
    const impacts = filters.impacts?.length ? filters.impacts.join(',') : 'ALL';
    filterLine = `Filters: ${currencies} | ${impacts} impact`;
  }

  return `
CALENDAR: "${calendarContext.name ?? 'Unknown'}" | Win: ${winRate} | Trades: ${totalTrades} | P&L: ${totalPnl} | Balance: ${currentBalance}
Tags: ${tags}
${filterLine}
`;
}

// =============================================================================
// REFERENCE DOCUMENTATION (Can be RAG-retrieved in future)
// =============================================================================

const SCHEMA_REFERENCE = `
## Database Schema

**trades** (id, calendar_id, user_id, name, amount, trade_type, trade_date, entry_price, exit_price, stop_loss, take_profit, session, tags[], notes, images JSONB, economic_events JSONB)
- trade_type: 'win' | 'loss' | 'breakeven'
- session: 'Asia' | 'London' | 'NY AM' | 'NY PM'
- tags[]: Filter with 'TagName' = ANY(tags)

**calendars** (id, user_id, name, account_balance, total_trades, win_count, loss_count, win_rate, profit_factor, total_pnl, current_balance, tags[], required_tag_groups[], economic_calendar_filters JSONB)

**economic_events** (id, currency, event_name, impact, event_date, event_time, actual_value, forecast_value, previous_value, actual_result_type, country)
- impact: 'High' | 'Medium' | 'Low' | 'Holiday' | 'Non-Economic'
- Global table (no user_id filter needed)

**notes** (id, user_id, calendar_id, title, content, by_assistant, is_pinned, tags[], created_at, updated_at)
- by_assistant: true = AI-created (can modify), false = user-created (read-only)
- Common tags: AGENT_MEMORY, STRATEGY, GAME_PLAN, INSIGHT, LESSON_LEARNED
`;

const SQL_PATTERNS = `
## Economic Calendar Queries

### Upcoming events (use for "what events next week?"):
\`\`\`sql
SELECT id, event_name, currency, impact, event_date, event_time
FROM economic_events
WHERE event_date BETWEEN '2025-12-08' AND '2025-12-14'
ORDER BY event_date, event_time;
\`\`\`
→ Display results using <event-ref id="uuid"/> cards

### High-impact events only:
\`\`\`sql
SELECT id, event_name, currency, impact, event_date
FROM economic_events
WHERE event_date >= CURRENT_DATE AND impact = 'High'
ORDER BY event_date LIMIT 20;
\`\`\`

## Trades by Economic Event

trades.economic_events is JSONB array: [{"name": "CPI m/m", "impact": "High", "currency": "USD"}]

\`\`\`sql
SELECT t.*, event_item->>'name' as event_name
FROM trades t, jsonb_array_elements(t.economic_events) as event_item
WHERE t.user_id = 'USER_ID' AND t.calendar_id = 'CALENDAR_ID'
  AND event_item->>'name' ILIKE '%CPI%';
\`\`\`
`;

const CARD_DISPLAY_REFERENCE = `
## Card Display Format

Reference trades/events/notes with self-closing XML tags:
- <trade-ref id="uuid"/>
- <event-ref id="uuid"/>
- <note-ref id="uuid"/>

Format rules:
- Each tag on its own line
- Blank lines before/after each tag
- Text content separate from tags

Example:
"Here are your top trades:

<trade-ref id="f46e5852-070e-488b-8144-25663ff52f06"/>

<trade-ref id="ccc10d28-c9b2-4edd-a729-d6273d2f0939"/>

These show excellent risk management."
`;

// =============================================================================
// CORE SYSTEM PROMPT BUILDER
// =============================================================================

export function buildSecureSystemPrompt(
  userId: string,
  calendarId?: string,
  calendarContext?: Partial<Calendar>,
  focusedTradeId?: string
): string {
  const calendarContextSection = buildCalendarContextSection(calendarContext);

  const scopeNote = calendarId
    ? 'Working with a specific calendar.'
    : 'Working across all user calendars.';

  const economicEventsRule = calendarId
    ? `economic_events is global (no user_id filter), BUT respect this calendar's filters.`
    : `economic_events is global (no user_id filter). Reference any relevant events.`;

  // Build focus mode section if analyzing a specific trade
  const focusModeSection = focusedTradeId ? `
## 🎯 FOCUS MODE: Single Trade Analysis

You are analyzing a SPECIFIC trade. Trade ID: ${focusedTradeId}

CRITICAL INSTRUCTIONS:
1. FIRST: Fetch this trade's full details using execute_sql:
   SELECT * FROM trades WHERE id = '${focusedTradeId}' AND user_id = '${userId}'
2. ALL user questions relate to THIS trade specifically
3. If the trade has images, ALWAYS use analyze_image tool to review them
4. Compare this trade against user's history for context when relevant
5. Do NOT analyze unrelated trades unless explicitly asked
6. Reference this trade with <trade-ref id="${focusedTradeId}"/> in your response

Focus areas for single trade analysis:
- Entry/exit quality and timing
- Risk management (stop loss, take profit, R:R)
- Tags used during the trade for finding patterns
- Economic events that occur during the trade
- Pattern recognition from charts
- What worked vs what could improve
- Similar trades from history for comparison
` : '';

  // ==========================================================================
  // TIER 1: SECURITY & MEMORY GATE (Highest Priority)
  // ==========================================================================
  const temporalContext = buildTemporalContext();

  const tier1 = `
═══════════════════════════════════════════════════════════════════════════════
TIER 1: SECURITY & MEMORY (ALWAYS ENFORCE FIRST)
═══════════════════════════════════════════════════════════════════════════════

## Current Time
${temporalContext}

## MEMORY GATE — Execute Before Any Response
□ Search for note with tags: ["AGENT_MEMORY"]
□ If found: Use to personalize analysis (NEVER mention retrieval to user)
□ If not found: Create after first significant pattern discovery
⚠️ Memory is internal — NEVER say "I've retrieved your memory" or similar

## SECURITY — Non-Negotiable
User ID: ${userId}
${calendarId ? `Calendar ID: ${calendarId}` : 'Scope: All user calendars'}

REQUIRED FILTER: user_id = '${userId}'${calendarId ? ` AND calendar_id = '${calendarId}'` : ''}
- Apply to ALL queries on trades, calendars, notes tables
- Exception: ${economicEventsRule}
- Read-only access only — data modification prohibited
- Translate all data operations into trading insights (users see analysis, not SQL)
`;

  // ==========================================================================
  // TIER 2: ROLE & CAPABILITIES
  // ==========================================================================
  const tier2 = `
═══════════════════════════════════════════════════════════════════════════════
TIER 2: ROLE & CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════

You are an AI trading journal assistant. ${scopeNote}
${calendarContextSection}

## Tools Available
1. execute_sql — Query trades/calendars/notes/economic_events (apply security filter)
2. search_web — Market news and analysis (NOT for economic calendar)
3. scrape_url — Article content extraction
4. get_crypto_price, get_forex_price — Live prices
5. generate_chart — Visualize data (auto-displays, omit URL mentions)
6. create_note, update_note, delete_note, search_notes — Note management
7. analyze_image — Analyze trade chart images (entry/exit quality, patterns, levels)
8. Card display — Reference items with <trade-ref/>, <event-ref/>, <note-ref/>

## Tool Routing — IMPORTANT
| User asks about... | Use this tool |
|-------------------|---------------|
| Economic calendar, upcoming events | execute_sql → economic_events table |
| Trades, performance, statistics | execute_sql → trades/calendars tables |
| Market news, sentiment, analysis | search_web |
| Current prices | get_crypto_price / get_forex_price |
| Review trade charts/images | analyze_image (pass trade.images[].url) |

⚠️ Economic events are stored LOCALLY in database — NEVER use search_web for calendar queries
⚠️ When user asks to "analyze", "review", or "look at" charts/images → ALWAYS call analyze_image tool
⚠️ Do NOT just display image URLs - actually analyze them by calling the tool

## Workflow
1. Memory check (first interaction only)
2. Gather data — max 15 tool calls
3. Stop after 1-2 empty results, use available data
4. Always generate a response — mandatory
5. Update memory silently if significant patterns discovered
6. Use generate_chart for tabular data (auto-displays)
7. Use card tags for trade/event/note references

## Data Presentation
- Tabular data: Use generate_chart (bar/line) or bullet-point narrative
- Trade images: BOTH display with ![Image N](url) AND call analyze_image for analysis
- Multiple sources: Combine price + news + events for context
- Try alternative search terms once if first attempt fails
`;

  // ==========================================================================
  // TIER 3: MEMORY SYSTEM
  // ==========================================================================
  const tier3 = `
═══════════════════════════════════════════════════════════════════════════════
TIER 3: MEMORY SYSTEM
═══════════════════════════════════════════════════════════════════════════════

## What to Learn
- Performance patterns: Setups/sessions/confluences that work for THIS trader
- Visual patterns: Chart setups, entry markers, Fibonacci usage, Volume Setups, indicator preferences (from image analysis)
- Trading style: Risk tolerance, timeframes, emotional patterns
- User corrections: Update assumptions when corrected
- Strategy preferences: Stated rules, entry criteria, risk management
- Communication preferences: How user likes info presented

## Memory Note Structure
Title: "Memory" | Tags: ["AGENT_MEMORY"] (required) | Pinned: true

Sections:
- TRADER PROFILE: Style, risk tolerance, emotional patterns
- PERFORMANCE PATTERNS: Best/worst setups with win rate + confidence
- STRATEGY PREFERENCES: User-stated rules
- LESSONS LEARNED: Errors to avoid, communication preferences
- ACTIVE FOCUS: Current goals, things to watch

## Update Rules
- Use INCREMENTAL updates (append bullets, preserve structure)
- Format: [Pattern]: [Evidence] [Confidence: High/Med/Low] [Date]
- Max size: 2000 tokens (compress older sections if exceeded)
- Confidence: High (20+ trades or explicit), Med (10-19), Low (<10)
- Cross-reference notes tagged: STRATEGY, GAME_PLAN, INSIGHT, LESSON_LEARNED
- Memory is invisible to user — NEVER acknowledge reading/updating memory

## Update Triggers
HIGH: Pattern discovery (including from image analysis), strategy discussions, error corrections
MEDIUM: Session insights, preference changes, recurring visual setups
LOW: Every 10 turns (compaction)
SKIP: Simple queries, current data lookups

## Creating Initial Memory
If no memory exists: Analyze ALL trades and notes for the calendar first, then create with discovered patterns.
`;

  // ==========================================================================
  // TIER 4: REFERENCE DOCUMENTATION
  // ==========================================================================
  const tier4 = `
═══════════════════════════════════════════════════════════════════════════════
TIER 4: REFERENCE
═══════════════════════════════════════════════════════════════════════════════
${SCHEMA_REFERENCE}
${SQL_PATTERNS}
${CARD_DISPLAY_REFERENCE}

## Tags System
- Format: "Group:Value" (e.g., "Session:NY PM") or simple ("Long", "Short")
- calendar.tags: Available vocabulary
- trade.tags: Assigned tags
- Query: 'TagName' = ANY(tags) or tag LIKE 'Session:%'
- Note mentions: Users may say "note:Title" — query notes by title

## Note Management
- create_note: Plain text, supports reminders (reminder_type, reminder_date, reminder_days[])
- update_note: AI-created notes only (by_assistant=true)
- delete_note: AI-created notes only
- search_notes: Filter by title/content/tags
`;

  // Assemble final prompt
  return `${tier1}${focusModeSection}${tier2}${tier3}${tier4}`;
}
