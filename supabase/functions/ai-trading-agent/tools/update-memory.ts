/**
 * update_memory — thin pass-through to `_shared/memory/operations.updateMemory`.
 * Validation, op gating, and Jaccard matching all live in the shared module
 * so chat + market-research + future callers share one implementation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type MemoryOp,
  type MemorySection,
  updateMemory,
} from "../../_shared/memory/index.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

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

export async function executeUpdateMemory(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for memory update";
  const userId = context.userId || "";
  const calendarId = context.calendarId || "";
  // Pass-through: validation + permission gating live inside updateMemory.
  // Defaulting op to ADD preserves pre-Step-5 behaviour for any caller
  // (or older prompt) that omits it.
  return await updateMemory(supabase, userId, calendarId, {
    op: typeof args.op === "string" ? args.op as MemoryOp : "ADD",
    section: args.section as MemorySection,
    new_insights: Array.isArray(args.new_insights)
      ? args.new_insights.map((i) => String(i))
      : undefined,
    target_text: typeof args.target_text === "string"
      ? args.target_text
      : undefined,
    new_text: typeof args.new_text === "string" ? args.new_text : undefined,
    // Chat function = full ops. market-research overrides via context.
    allowedOps: context.allowedMemoryOps,
  });
}
