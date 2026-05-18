/**
 * manage_event — episodic event log access. Actions:
 *   - "record": append a time-stamped fact (rule_changed / decision_made etc.)
 *   - "recall": query with at least one filter (event_types | tags | since | query)
 *
 * For rule changes / corrections / decisions, prefer `apply_rule_change`
 * (atomic event + memory pairing). Use record here only for
 * pattern_observed / strategy_discussion.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type EpisodicEventType,
  recallEvents,
  recordEvent,
} from "../../_shared/memory/index.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

export const manageEventTool: GeminiFunctionDeclaration = {
  name: "manage_event",
  description:
    `Episodic event log — time-stamped facts about what happened (distinct from update_memory's stable profile). action="record" appends (event_type + ≤500-char past-tense summary; for rule changes / corrections / decisions prefer apply_rule_change instead — only use record here for pattern_observed / strategy_discussion). action="recall" queries — REQUIRES ≥1 filter (event_types | tags | since | query). Empty recall IS the answer; do not fall back to other tools. See TIER 3 Episodic Memory for trigger table.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["record", "recall"],
        description: "Write a new event or query existing ones.",
      },
      event_type: {
        type: "string",
        enum: [
          "pattern_observed",
          "user_correction",
          "strategy_discussion",
          "decision_made",
          "rule_changed",
        ],
        description: "Kind of event (action=record).",
      },
      summary: {
        type: "string",
        description: "Past-tense single sentence, ≤500 chars (action=record).",
      },
      metadata: {
        type: "object",
        description:
          "Optional structured context (trade_ids, source_note_id, confidence…) — action=record.",
      },
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
        description: "Filter recall to these event types.",
      },
      since: {
        type: "string",
        description:
          "ISO timestamp — recall events on/after this (action=recall).",
      },
      query: {
        type: "string",
        description:
          "Case-insensitive substring match on summary (action=recall).",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "record: tags to attach. recall: match events containing ALL these tags.",
      },
      limit: {
        type: "number",
        description: "Max events to return for action=recall (1..50, default 10).",
      },
    },
    required: ["action"],
  },
};

export async function executeManageEvent(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for manage_event";
  const userId = context.userId || "";
  const calendarId = context.calendarId || "";
  const action = typeof args.action === "string" ? args.action : "";

  if (action === "record") {
    // Pass-through: hand args to episodic.ts unmodified so its validator
    // can produce actionable errors for shape problems. We do NOT coerce
    // types here (e.g. String(t)) — that would silently mask the
    // "tags must be strings" / "event_type must be one of ..." rejections.
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

  if (action === "recall") {
    // Same pass-through philosophy: normalizeRecallFilter handles bad types,
    // empty arrays, and clamping. Avoid pre-coercion here so filter logic
    // stays testable in one place.
    const result = await recallEvents(supabase, userId, calendarId, {
      event_types: args.event_types as EpisodicEventType[] | undefined,
      tags: args.tags as string[] | undefined,
      since: args.since as string | undefined,
      query: args.query as string | undefined,
      limit: args.limit as number | undefined,
    });
    if (result.events.length === 0) return result.message;
    const lines = result.events.map((e) =>
      `- [${e.occurred_at}] (${e.event_type}) ${e.summary}${
        e.tags.length > 0 ? ` [tags: ${e.tags.join(", ")}]` : ""
      }`
    );
    return `${result.message}\n${lines.join("\n")}`;
  }

  return JSON.stringify({
    success: false,
    error: `manage_event: unknown action "${action}". Use record|recall.`,
  });
}
