/**
 * Memory module — episodic event log.
 *
 * Backs the `record_event` and `recall_events` tools. The episodic table
 * (agent_memory_events) stores time-stamped facts about *what happened*
 * — corrections, rule changes, observations — separately from the
 * core AGENT_MEMORY note (which holds *what is true now*).
 *
 * Two clean boundaries:
 *   - `validateRecordEventInput` is pure and exhaustively tested.
 *   - `recordEvent` / `recallEvents` are thin DB wrappers around the
 *     validator and the supabase-js client.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EPISODIC_DAILY_WRITE_CAP,
  EPISODIC_EVENT_TYPES,
  EPISODIC_RECALL_DEFAULT_LIMIT,
  EPISODIC_RECALL_MAX_LIMIT,
  EPISODIC_SUMMARY_MAX_LENGTH,
  type EpisodicEvent,
  type EpisodicEventType,
  type RecallEventsFilter,
  type RecordEventInput,
} from "./types.ts";

// Inline log shim — keeps episodic.ts free of the supabase-js side-effect
// transitively imported by _shared/supabase.ts. Same shape as parser.ts.
type LogLevel = "info" | "warn" | "error";
function log(message: string, level: LogLevel = "info"): void {
  const ts = new Date().toISOString();
  console[level](`[${ts}] ${message.toUpperCase()}: ${message}`);
}

// =============================================================================
// Pure validation
// =============================================================================

export type ValidationResult =
  | { ok: true; value: Required<Pick<RecordEventInput, "event_type" | "summary">> & {
      tags: string[];
      metadata: Record<string, unknown>;
    } }
  | { ok: false; error: string };

/**
 * Validate a record_event input. Returns either a normalized event or an
 * actionable error message the LLM can read and retry against.
 *
 * Rules:
 *   - event_type must be one of the known ENUM values
 *   - summary must be 1..EPISODIC_SUMMARY_MAX_LENGTH chars after trim
 *   - tags must be a string[] (each entry trimmed, dropped if empty)
 *   - metadata must be a plain object (not array, not null)
 */
export function validateRecordEventInput(
  input: RecordEventInput,
): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Input must be an object." };
  }

  // event_type
  if (!EPISODIC_EVENT_TYPES.includes(input.event_type)) {
    return {
      ok: false,
      error: `Invalid event_type "${input.event_type}". Must be one of: ${
        EPISODIC_EVENT_TYPES.join(", ")
      }.`,
    };
  }

  // summary
  if (typeof input.summary !== "string") {
    return { ok: false, error: "summary must be a string." };
  }
  const summary = input.summary.trim();
  if (summary.length === 0) {
    return { ok: false, error: "summary is required." };
  }
  if (summary.length > EPISODIC_SUMMARY_MAX_LENGTH) {
    return {
      ok: false,
      error:
        `summary exceeds ${EPISODIC_SUMMARY_MAX_LENGTH} chars (got ${summary.length}). Keep to one sentence.`,
    };
  }

  // tags
  let tags: string[] = [];
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      return { ok: false, error: "tags must be an array of strings." };
    }
    for (const t of input.tags) {
      if (typeof t !== "string") {
        return { ok: false, error: "tags must be an array of strings." };
      }
    }
    tags = input.tags.map((t) => t.trim()).filter((t) => t.length > 0);
  }

  // metadata
  let metadata: Record<string, unknown> = {};
  if (input.metadata !== undefined) {
    if (
      input.metadata === null ||
      typeof input.metadata !== "object" ||
      Array.isArray(input.metadata)
    ) {
      return { ok: false, error: "metadata must be a plain object." };
    }
    metadata = input.metadata;
  }

  return {
    ok: true,
    value: {
      event_type: input.event_type,
      summary,
      tags,
      metadata,
    },
  };
}

/**
 * Normalize a recall filter. Clamps limit, drops obvious no-ops, returns
 * a fully-typed shape downstream code can consume without re-checking.
 */
export function normalizeRecallFilter(
  filter: RecallEventsFilter | undefined,
): {
  event_types: EpisodicEventType[] | undefined;
  tags: string[] | undefined;
  since: string | undefined;
  query: string | undefined;
  limit: number;
} {
  const f = filter ?? {};

  const event_types = Array.isArray(f.event_types) && f.event_types.length > 0
    ? f.event_types.filter((t): t is EpisodicEventType =>
      EPISODIC_EVENT_TYPES.includes(t as EpisodicEventType)
    )
    : undefined;

  const tags = Array.isArray(f.tags) && f.tags.length > 0
    ? f.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
    : undefined;

  const since = typeof f.since === "string" && f.since.trim().length > 0
    ? f.since.trim()
    : undefined;

  const query = typeof f.query === "string" && f.query.trim().length > 0
    ? f.query.trim()
    : undefined;

  const requested = typeof f.limit === "number" && f.limit > 0
    ? Math.floor(f.limit)
    : EPISODIC_RECALL_DEFAULT_LIMIT;
  const limit = Math.min(requested, EPISODIC_RECALL_MAX_LIMIT);

  return { event_types, tags, since, query, limit };
}

// =============================================================================
// Database operations
// =============================================================================

/**
 * Append a new event to the episodic log. Enforces:
 *   - input validation (validateRecordEventInput)
 *   - per-(user, calendar) daily write cap (EPISODIC_DAILY_WRITE_CAP)
 *
 * Returns a human-readable string the tool dispatcher hands back to the LLM.
 */
export async function recordEvent(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  input: RecordEventInput,
): Promise<string> {
  const validated = validateRecordEventInput(input);
  if (!validated.ok) {
    log(`[recordEvent] Validation failed: ${validated.error}`, "warn");
    return `record_event rejected: ${validated.error}`;
  }
  const { event_type, summary, tags, metadata } = validated.value;

  // Daily cap check. Reads "today" as the calendar-day boundary in UTC, which
  // is good enough — the cap exists to catch runaway prompts, not to be an
  // exact rate-limiter.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from("agent_memory_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("calendar_id", calendarId)
    .gte("occurred_at", todayStart.toISOString());

  if (countError) {
    log(
      `[recordEvent] Daily count query failed: ${countError.message}`,
      "error",
    );
    return `record_event error: ${countError.message}`;
  }

  if ((count ?? 0) >= EPISODIC_DAILY_WRITE_CAP) {
    log(
      `[recordEvent] Daily cap reached for ${userId}/${calendarId} (${count})`,
      "warn",
    );
    return `record_event skipped: event log is full for today (${EPISODIC_DAILY_WRITE_CAP} events). Existing events are retained; try again tomorrow.`;
  }

  const { error: insertError } = await supabase
    .from("agent_memory_events")
    .insert({
      user_id: userId,
      calendar_id: calendarId,
      event_type,
      summary,
      tags,
      metadata,
    });

  if (insertError) {
    log(`[recordEvent] Insert failed: ${insertError.message}`, "error");
    return `record_event error: ${insertError.message}`;
  }

  log(
    `[recordEvent] Recorded ${event_type} (${summary.length} chars)`,
    "info",
  );
  return `Event recorded (${event_type}).`;
}

/**
 * Query the episodic log. Returns up to `limit` events ordered most-recent-
 * first. All filter params are optional but at least one must be set —
 * unfiltered recall would just paginate the whole table.
 */
export async function recallEvents(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  filter: RecallEventsFilter | undefined,
): Promise<{ events: EpisodicEvent[]; message: string }> {
  const normalized = normalizeRecallFilter(filter);
  const { event_types, tags, since, query, limit } = normalized;

  // Require at least one signal. Unfiltered recall is almost never what the
  // agent actually wants — if there are no filters, it should reach for
  // search_chat_history or summarize_recent instead.
  if (
    !event_types && !tags && !since && !query
  ) {
    return {
      events: [],
      message:
        "recall_events requires at least one filter (event_types, tags, since, or query).",
    };
  }

  let q = supabase
    .from("agent_memory_events")
    .select("id, occurred_at, event_type, summary, tags, metadata")
    .eq("user_id", userId)
    .eq("calendar_id", calendarId);

  if (event_types) q = q.in("event_type", event_types);
  if (tags) q = q.contains("tags", tags);
  if (since) q = q.gte("occurred_at", since);
  if (query) q = q.ilike("summary", `%${query}%`);

  const { data, error } = await q
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    log(`[recallEvents] Query failed: ${error.message}`, "error");
    return { events: [], message: `recall_events error: ${error.message}` };
  }

  const events = (data ?? []) as EpisodicEvent[];
  log(`[recallEvents] Returned ${events.length} events`, "info");
  return {
    events,
    message: events.length === 0
      ? "No matching events found."
      : `Found ${events.length} event(s).`,
  };
}
