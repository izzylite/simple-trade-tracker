/**
 * manage_reminder — schedule, list, cancel, edit future Orion turns.
 *
 * Actions:
 *   - "set"    — insert 1..12 reminders. Multi-row inserts get a shared
 *                server-assigned batch_id so fire-time + edit-time can
 *                operate on the whole group atomically.
 *   - "list"   — pending reminders across all conversations.
 *   - "cancel" — single id OR every pending sibling by batch_id.
 *   - "edit"   — single id (fields whitelisted) OR batch_id with
 *                shift_minutes / instructions.
 *
 * Owner check on every write (conversation FK only enforces existence).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

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
      action: {
        type: "string",
        enum: ["set", "list", "cancel", "edit"],
        description: "Schedule, list, cancel, or edit a reminder.",
      },
      reminders: {
        type: "array",
        description:
          "Reminders to schedule (action=set). 1–12 items. Single reminder is still a 1-element array.",
        items: {
          type: "object",
          properties: {
            trigger_at: {
              type: "string",
              description: "ISO timestamp when this reminder fires (future, within 1 year).",
            },
            instructions: {
              type: "string",
              description: "What Orion should do when this reminder fires (1–1000 chars).",
            },
            description: {
              type: "string",
              description: "Optional short label (<=200 chars).",
            },
          },
          required: ["trigger_at", "instructions"],
        },
      },
      id: {
        type: "string",
        description:
          "Reminder id (action=cancel or action=edit single mode). Mutually exclusive with batch_id.",
      },
      batch_id: {
        type: "string",
        description:
          "Batch id (action=cancel atomic batch cancel, or action=edit batch mode). Mutually exclusive with id.",
      },
      trigger_at: {
        type: "string",
        description:
          "New ISO timestamp (action=edit single mode ONLY — rejected if combined with batch_id; use shift_minutes for batch edits).",
      },
      instructions: {
        type: "string",
        description:
          "New instructions text 1-1000 chars (action=edit, single or batch mode).",
      },
      description: {
        type: "string",
        description:
          "New short label <=200 chars (action=edit single mode ONLY — per-row, rejected if combined with batch_id).",
      },
      shift_minutes: {
        type: "number",
        description:
          "Minutes to add to every pending sibling's trigger_at (action=edit batch mode ONLY — rejected if combined with id). Negative tightens (earlier), positive loosens/pushes (later). Validated to keep all rows within (now, now+1y).",
      },
    },
    required: ["action"],
  },
};

// ============================================================
// set
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
  /** Shared across all rows when >1 row inserted, else null/omitted. */
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
  const instructions = typeof raw.instructions === "string"
    ? raw.instructions
    : "";
  const description = typeof raw.description === "string"
    ? raw.description
    : "";

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
  return { index, trigger_iso: trigger.toISOString(), instructions, description };
}

async function executeSetReminder(
  reminders: unknown,
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  const result: SetReminderBatchResult = await (async () => {
    if (!supabase) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "db_error" as const,
        error: "no supabase client",
      };
    }
    const userId = context.userId ?? "";
    if (!userId) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "no_user_context" as const,
        error: "no user id",
      };
    }
    const conversationId = context.conversationId ?? "";
    if (!conversationId) {
      return {
        success: false,
        created: [],
        failed: [],
        error_code: "no_conversation_context" as const,
        error: "no conversation id",
      };
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
      const checked = validateReminderItem(
        reminders[i] as RawReminderInput,
        i,
        now,
      );
      if ("error_code" in checked) failed.push(checked);
      else valid.push(checked);
    }
    if (valid.length === 0) return { success: false, created: [], failed };

    // Verify the conversation belongs to this user. The conversation FK only
    // enforces existence, not ownership — without this check, a caller could
    // plant a reminder targeting another user's conversation, and it would be
    // visible in the victim's realtime sub. One check per batch — owner doesn't
    // change mid-call.
    const { data: convoOwner, error: ownerErr } = await supabase
      .from("ai_conversations")
      .select("user_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (ownerErr) {
      return {
        success: false,
        created: [],
        failed,
        error_code: "db_error" as const,
        error: ownerErr.message,
      };
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
      return {
        success: false,
        created: [],
        failed,
        error_code: "db_error" as const,
        error: countErr.message,
      };
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
    // stay batch_id=NULL so fire-time sibling logic knows to skip the group hint.
    const batchId = toInsert.length > 1 ? crypto.randomUUID() : null;

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
      return {
        success: false,
        created: [],
        failed,
        error_code: "db_error" as const,
        error: error.message,
      };
    }

    const created: SetReminderItemSuccess[] = (data ?? []).map((row, i) => ({
      index: toInsert[i].index,
      id: row.id,
      trigger_at: row.trigger_at,
      description: row.description ?? undefined,
    }));
    return {
      success: created.length > 0,
      batch_id: batchId,
      created,
      failed,
    };
  })();

  return JSON.stringify(result);
}

// ============================================================
// list
// ============================================================

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
    const conv =
      (r as { ai_conversations: { title?: string } | { title?: string }[] | null })
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

// ============================================================
// cancel
// ============================================================

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

  // Single-id cancel.
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

// ============================================================
// edit
// ============================================================

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

async function executeEditReminder(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase: SupabaseClient | undefined,
): Promise<string> {
  const result: EditReminderResult = await (async () => {
    if (!supabase) {
      return {
        success: false,
        updated: [],
        error_code: "db_error" as const,
        error: "no supabase client",
      };
    }
    const userId = context.userId ?? "";
    if (!userId) {
      return {
        success: false,
        updated: [],
        error_code: "no_user_context" as const,
        error: "no user id",
      };
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
        error: hasId
          ? "pass exactly one of {id, batch_id}, not both"
          : "id or batch_id required",
      };
    }

    const triggerAt = typeof args.trigger_at === "string"
      ? args.trigger_at
      : undefined;
    const instructions = typeof args.instructions === "string"
      ? args.instructions
      : undefined;
    const description = typeof args.description === "string"
      ? args.description
      : undefined;
    const shiftMinutes = typeof args.shift_minutes === "number"
      ? args.shift_minutes
      : undefined;

    // Mode-specific field validation.
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

    const anyField = triggerAt !== undefined ||
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

    const now = Date.now();
    if (
      instructions !== undefined &&
      (instructions.length < 1 || instructions.length > 1000)
    ) {
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
        return {
          success: false,
          updated: [],
          error_code: "invalid_args" as const,
          error: "trigger_at not parseable",
        };
      }
      if (t.getTime() <= now) {
        return {
          success: false,
          updated: [],
          error_code: "past_trigger_at" as const,
          error: "trigger_at must be in the future",
        };
      }
      if (t.getTime() > now + ONE_YEAR_MS) {
        return {
          success: false,
          updated: [],
          error_code: "too_far_future" as const,
          error: "trigger_at must be within 1 year",
        };
      }
    }
    if (shiftMinutes !== undefined) {
      if (
        !Number.isFinite(shiftMinutes) ||
        Math.abs(shiftMinutes) > 60 * 24 * 365
      ) {
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
      if (triggerAt !== undefined) {
        patch.trigger_at = new Date(triggerAt).toISOString();
      }
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
        return {
          success: false,
          updated: [],
          error_code: "db_error" as const,
          error: error.message,
        };
      }
      if (!data) {
        const { data: existing } = await supabase
          .from("reminders")
          .select("id, status")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!existing) {
          return {
            success: false,
            updated: [],
            error_code: "not_found" as const,
            error: "reminder not found",
          };
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
        return {
          success: false,
          updated: [],
          error_code: "db_error" as const,
          error: error.message,
        };
      }
      if (!data || data.length === 0) {
        return {
          success: false,
          updated: [],
          error_code: "not_found" as const,
          error: "no pending reminders matched batch_id",
        };
      }
      return { success: true, updated: data as EditReminderRow[] };
    }

    // Shift mode (with optional instructions update). Fetch pending siblings,
    // compute per-row new trigger_at, validate, then parallel UPDATEs.
    const { data: pending, error: fetchErr } = await supabase
      .from("reminders")
      .select("id, trigger_at")
      .eq("batch_id", batchId)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (fetchErr) {
      return {
        success: false,
        updated: [],
        error_code: "db_error" as const,
        error: fetchErr.message,
      };
    }
    if (!pending || pending.length === 0) {
      return {
        success: false,
        updated: [],
        error_code: "not_found" as const,
        error: "no pending reminders matched batch_id",
      };
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
      planned.push({
        id: row.id as string,
        new_trigger_iso: new Date(newMs).toISOString(),
      });
    }

    const updates = await Promise.all(
      planned.map((p) => {
        const patch: Record<string, unknown> = {
          trigger_at: p.new_trigger_iso,
        };
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
        return {
          success: false,
          updated,
          error_code: "db_error" as const,
          error: u.error.message,
        };
      }
      if (u.data) updated.push(u.data as EditReminderRow);
    }
    if (updated.length === 0) {
      return {
        success: false,
        updated: [],
        error_code: "not_pending" as const,
        error: "no rows matched after shift (likely raced with fire)",
      };
    }
    return { success: true, updated };
  })();

  return JSON.stringify(result);
}

// ============================================================
// dispatcher
// ============================================================

export async function executeManageReminder(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  const action = typeof args.action === "string" ? args.action : "";

  if (action === "set") {
    return await executeSetReminder(args.reminders, context, supabase);
  }
  if (action === "list") {
    return await executeListReminders(context, supabase);
  }
  if (action === "cancel") {
    const id = typeof args.id === "string" ? args.id : "";
    const batchId = typeof args.batch_id === "string" ? args.batch_id : "";
    return await executeCancelReminder(id, batchId, context, supabase);
  }
  if (action === "edit") {
    return await executeEditReminder(args, context, supabase);
  }

  return JSON.stringify({
    success: false,
    error: `manage_reminder: unknown action "${action}". Use set|list|cancel|edit.`,
  });
}
