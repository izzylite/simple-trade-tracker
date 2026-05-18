/**
 * apply_rule_change — atomic pairing of episodic event log + memory mutation.
 *
 * Designed because Gemini's function-calling consistently emits one tool
 * per turn. Asking the model to coordinate record_event + update_memory
 * via prompt rules failed in practice — model logged the event but
 * skipped the memory mutation, leaving stale state. This tool collapses
 * both writes into a single decision point.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyRuleChange,
  type EpisodicEventType,
  type MemoryOp,
  type MemorySection,
} from "../../_shared/memory/index.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

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
        description:
          "Past-tense single sentence (≤500 chars) describing what happened. Goes to the episodic log.",
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
        description:
          "UPDATE / REMOVE: text identifying the existing bullet to operate on.",
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

export async function executeApplyRuleChange(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for apply_rule_change";
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
    new_text: typeof args.new_text === "string" ? args.new_text : undefined,
    allowedOps: context.allowedMemoryOps,
  });
}
