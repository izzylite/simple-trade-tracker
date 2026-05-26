// save / list / delete / set_enabled — persistence handlers.
//
// Writes use the service-role client because (a) we need to call vault
// RPCs that are service-role-only, and (b) RLS on custom_tools only
// grants SELECT to the owning user. All writes filter by user_id
// explicitly to prevent cross-user manipulation.

import { corsHeaders, createServiceClient, errorResponse, log } from "../_shared/supabase.ts";
import { validateWebhookUrlSync } from "../_shared/customTools/urlValidator.ts";
import { dispatchWebhookTool } from "../_shared/customTools/runtime.ts";
import {
  TOOL_CAP_PER_USER,
  type ArgsSchema,
  type CustomToolRow,
} from "../_shared/customTools/types.ts";

const NAME_REGEX = /^[a-z][a-z0-9_]*$/;
const SECRET_REGEX = /^[a-f0-9]{64}$/;

interface SaveRequest {
  name: string;
  description: string;
  args_schema: ArgsSchema;
  webhook_url: string;
  secret: string;
  is_read_only: boolean;
  baseline_sample: unknown;
}

function ok(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, ...payload }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateSavePayload(body: Record<string, unknown>): SaveRequest | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!NAME_REGEX.test(name) || name.length > 54) {
    return "name must match ^[a-z][a-z0-9_]*$ and be ≤ 54 chars";
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 10 || description.length > 1024) {
    return "description must be 10–1024 chars";
  }

  const args_schema = body.args_schema as ArgsSchema | undefined;
  if (
    !args_schema || typeof args_schema !== "object" ||
    args_schema.type !== "object" || !args_schema.properties ||
    typeof args_schema.properties !== "object"
  ) {
    return "args_schema must be a JSON object with type:'object' and properties";
  }

  const webhook_url = typeof body.webhook_url === "string" ? body.webhook_url.trim() : "";
  const urlSync = validateWebhookUrlSync(webhook_url);
  if (!urlSync.valid) {
    return `webhook_url rejected: ${urlSync.reason}`;
  }

  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!SECRET_REGEX.test(secret)) {
    return "secret must be 64 lowercase hex chars (returned from draft_schema)";
  }

  const is_read_only = body.is_read_only === true;
  const baseline_sample = body.baseline_sample ?? null;

  return {
    name,
    description,
    args_schema,
    webhook_url,
    secret,
    is_read_only,
    baseline_sample,
  };
}

export async function handleSave(
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validateSavePayload(body);
  if (typeof validated === "string") {
    return errorResponse(validated);
  }
  const req = validated;

  const admin = createServiceClient();

  // Tool cap — count existing tools for this user (any state).
  const { count, error: countErr } = await admin
    .from("custom_tools")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countErr) {
    return errorResponse(`count check failed: ${countErr.message}`, 500);
  }
  if ((count ?? 0) >= TOOL_CAP_PER_USER) {
    return errorResponse(
      `tool cap reached (${TOOL_CAP_PER_USER}); delete an existing tool first`,
      409,
    );
  }

  const toolId = crypto.randomUUID();
  const secretVaultKey = `custom_tool_secret_${toolId}`;

  // Vault-first ordering: write the secret BEFORE the row. If the process
  // is killed between row-insert and vault-write (or vault-write fails)
  // we'd leave a ghost row pointing at a missing secret — runtime would
  // surface "tool secret missing" but the user saw a "save succeeded"
  // toast. Writing the vault entry first inverts the failure mode: a
  // process kill between vault-write and row-insert leaves an orphan
  // vault entry with no row referring to it. That's a passive leak
  // (no readable row, no UI visibility) — strictly better than a ghost
  // row that breaks the tool from the user's perspective.
  const { error: vaultErr } = await admin.rpc("create_custom_tool_secret", {
    p_tool_id: toolId,
    p_secret: req.secret,
  });
  if (vaultErr) {
    return errorResponse(`vault write failed: ${vaultErr.message}`, 500);
  }

  const { error: insertErr } = await admin.from("custom_tools").insert({
    id: toolId,
    user_id: userId,
    name: req.name,
    registered_name: `user_tool_${req.name}`,
    description: req.description,
    args_schema: req.args_schema,
    webhook_url: req.webhook_url,
    secret_vault_key: secretVaultKey,
    is_read_only: req.is_read_only,
    baseline_sample: req.baseline_sample,
  });

  if (insertErr) {
    // Compensate — vault entry exists but no row references it. Burn it
    // so we don't accumulate orphans on retries (unique name collisions
    // are the common cause). Best-effort; orphan is harmless if cleanup
    // fails (no row points at it, so the read RPC will never surface it).
    let cleanupErrMessage: string | null = null;
    try {
      const { error: cleanupErr } = await admin.rpc("delete_custom_tool_secret", {
        p_tool_id: toolId,
      });
      if (cleanupErr) cleanupErrMessage = cleanupErr.message;
    } catch (err) {
      cleanupErrMessage = err instanceof Error ? err.message : String(err);
    }
    log("row insert failed, rolled back vault entry", "error", {
      toolId,
      message: insertErr.message,
      vault_cleanup_error: cleanupErrMessage,
    });
    return errorResponse(`save failed: ${insertErr.message}`, 500);
  }

  log("custom tool saved", "info", { toolId, name: req.name });
  return ok({ id: toolId });
}

export async function handleList(userId: string): Promise<Response> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("custom_tools")
    .select(
      "id, name, registered_name, description, args_schema, webhook_url, is_read_only, is_enabled, baseline_sample, consecutive_failures, last_success_at, last_failure_at, last_failure_reason, disabled_at, disabled_reason, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return errorResponse(`list failed: ${error.message}`, 500);
  }

  return ok({ tools: (data ?? []) as Partial<CustomToolRow>[] });
}

export async function handleDelete(
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return errorResponse("id required");

  const admin = createServiceClient();
  // The on-delete trigger (`trg_custom_tools_vault_cleanup`) burns the
  // vault entry — we don't need an explicit RPC call.
  const { error } = await admin
    .from("custom_tools")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return errorResponse(`delete failed: ${error.message}`, 500);
  return ok({ id });
}

/**
 * Edit an existing tool. Only fields explicitly present in the request body
 * are updated — the frontend tracks which fields the user changed and only
 * sends those, gated by the field-aware test-fire/audit matrix in the UI.
 *
 * Server-side trust model matches save(): the UI enforces "test-fire must
 * pass when URL/secret/args changed" and "audit must pass when name/desc/args
 * changed" before unlocking the save button. The server validates inputs
 * and applies them.
 */
export async function handleEdit(
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return errorResponse("id required");

  const admin = createServiceClient();

  const { data: existing, error: lookupErr } = await admin
    .from("custom_tools")
    .select("id, user_id, name, description, args_schema, webhook_url, is_read_only")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr || !existing) {
    return errorResponse("tool not found", 404);
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!NAME_REGEX.test(name) || name.length > 54) {
      return errorResponse("name must match ^[a-z][a-z0-9_]*$ and be ≤ 54 chars");
    }
    if (name !== existing.name) {
      patch.name = name;
      patch.registered_name = `user_tool_${name}`;
    }
  }

  if (typeof body.description === "string") {
    const description = body.description.trim();
    if (description.length < 10 || description.length > 1024) {
      return errorResponse("description must be 10–1024 chars");
    }
    patch.description = description;
  }

  if (body.args_schema !== undefined) {
    const argsSchema = body.args_schema as ArgsSchema | undefined;
    if (
      !argsSchema || typeof argsSchema !== "object" ||
      argsSchema.type !== "object" || !argsSchema.properties ||
      typeof argsSchema.properties !== "object"
    ) {
      return errorResponse("args_schema must be a JSON object with type:'object' and properties");
    }
    patch.args_schema = argsSchema;
  }

  if (typeof body.webhook_url === "string") {
    const webhookUrl = body.webhook_url.trim();
    const urlSync = validateWebhookUrlSync(webhookUrl);
    if (!urlSync.valid) {
      return errorResponse(`webhook_url rejected: ${urlSync.reason}`);
    }
    patch.webhook_url = webhookUrl;
  }

  if (typeof body.is_read_only === "boolean") {
    patch.is_read_only = body.is_read_only;
  }

  // baseline_sample is only passed when test-fire was re-run; replace it so
  // shape-drift detection compares against the new baseline going forward.
  if (body.baseline_sample !== undefined) {
    patch.baseline_sample = body.baseline_sample;
  }

  if (Object.keys(patch).length === 0) {
    return errorResponse("no fields to update");
  }

  const { error: updateErr } = await admin
    .from("custom_tools")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (updateErr) {
    if (updateErr.code === "23505") {
      return errorResponse("a tool with that name already exists", 409);
    }
    return errorResponse(`edit failed: ${updateErr.message}`, 500);
  }

  // Secret rotation deferred to Phase 5 — the existing vault entry stays
  // valid through edits. The trigger-driven `updated_at` bump is what
  // invalidates the in-process read-only cache (cache key includes it).
  return ok({ id });
}

/**
 * Per-user rate limit for the test_tool action. Returns `null` when
 * allowed; returns a 429 Response when blocked.
 *
 * Why a durable rate-limit table instead of the in-process counter:
 * Supabase Edge spreads requests across isolates so the in-process Map
 * in runtime.ts is per-isolate. A scripted attacker can fan out across
 * isolates and bypass the 20-cap easily. The Postgres-backed sliding
 * window in `check_and_bump_test_tool_limit` is the authoritative cap.
 *
 * Returns null on internal RPC failure — fail OPEN here is intentional
 * so a transient DB blip doesn't block legitimate Test clicks. The
 * worst case is the user's own webhook getting hit a few extra times.
 */
export async function checkTestToolRateLimit(
  userId: string,
): Promise<Response | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("check_and_bump_test_tool_limit", {
    p_user_id: userId,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return null;
  }
  const row = data[0] as { allowed: boolean; retry_after_seconds: number };
  if (row.allowed) return null;
  return new Response(
    JSON.stringify({
      success: false,
      error: `You're testing tools too quickly. Try again in ${row.retry_after_seconds}s.`,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(row.retry_after_seconds),
      },
    },
  );
}

/**
 * Whitelist of failure-reason strings safe to surface to the client.
 * Internal validator strings (e.g. "ipv4 169.254.169.254 is in a blocked
 * range") could expose server-side state — coarsen them to a small enum
 * of categories the user can act on.
 */
function publicFailureReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("timeout") || s.includes("timed out")) return "timeout";
  if (s.includes("ssrf") || s.includes("blocked range") || s.includes("hostname") || s.includes("redirect")) {
    return "webhook_url_rejected";
  }
  if (s.includes("size") && s.includes("exceed")) return "response_too_large";
  if (s.includes("invalid json") || s.includes("shape")) return "invalid_response_shape";
  if (s.includes("http ") || s.includes("http_error")) return "webhook_http_error";
  if (s.includes("signature")) return "signature_error";
  if (s.includes("secret")) return "secret_missing";
  return "webhook_error";
}

/**
 * On-demand test fire from the settings dialog. Loads the saved tool's
 * registered_name + baseline_sample, dispatches one call through the
 * normal pipeline (HMAC-signed, URL-validated, counter-bumping), then
 * reads the row back to surface what changed.
 *
 * Why diff the row state instead of trusting the fence string:
 * dispatchWebhookTool returns a fenced JSON string designed for Gemini,
 * not the UI. The counter delta is the authoritative source — if
 * success_count went up we succeeded; if failure_count went up we
 * failed; if neither moved we hit the rate limiter or a disabled tool.
 */
export async function handleTestTool(
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const toolId = typeof body.tool_id === "string" ? body.tool_id.trim() : "";
  if (!toolId) return errorResponse("tool_id required");

  const admin = createServiceClient();

  const { data: before, error: lookupErr } = await admin
    .from("custom_tools")
    .select(
      "id, registered_name, baseline_sample, is_enabled, success_count, failure_count, last_success_at, last_failure_at, last_failure_reason",
    )
    .eq("id", toolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr || !before) {
    return errorResponse("tool not found", 404);
  }

  const beforeRow = before as {
    registered_name: string;
    baseline_sample: unknown;
    is_enabled: boolean;
    success_count: number;
    failure_count: number;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_failure_reason: string | null;
  };

  if (!beforeRow.is_enabled) {
    return ok({
      status: "disabled",
      last_success_at: beforeRow.last_success_at,
      last_failure_at: beforeRow.last_failure_at,
      success_count: beforeRow.success_count,
      failure_count: beforeRow.failure_count,
      is_enabled: false,
    });
  }

  // Re-use the saved baseline_sample as args. It was captured during the
  // most recent test_fire so the webhook should already understand it.
  const args =
    beforeRow.baseline_sample &&
    typeof beforeRow.baseline_sample === "object"
      ? (beforeRow.baseline_sample as Record<string, unknown>)
      : {};

  await dispatchWebhookTool({
    userId,
    registeredName: beforeRow.registered_name,
    args,
    conversationId: null,
  });

  const { data: after } = await admin
    .from("custom_tools")
    .select(
      "success_count, failure_count, last_success_at, last_failure_at, last_failure_reason, is_enabled",
    )
    .eq("id", toolId)
    .maybeSingle();

  const afterRow = (after ?? {}) as {
    success_count?: number;
    failure_count?: number;
    last_success_at?: string | null;
    last_failure_at?: string | null;
    last_failure_reason?: string | null;
    is_enabled?: boolean;
  };

  const succeeded = (afterRow.success_count ?? 0) > beforeRow.success_count;
  const failed = (afterRow.failure_count ?? 0) > beforeRow.failure_count;
  const status: "success" | "failed" | "rate_limited" = succeeded
    ? "success"
    : failed
    ? "failed"
    : "rate_limited";

  return ok({
    status,
    error: failed ? publicFailureReason(afterRow.last_failure_reason) : null,
    last_success_at: afterRow.last_success_at ?? beforeRow.last_success_at,
    last_failure_at: afterRow.last_failure_at ?? beforeRow.last_failure_at,
    success_count: afterRow.success_count ?? beforeRow.success_count,
    failure_count: afterRow.failure_count ?? beforeRow.failure_count,
    is_enabled: afterRow.is_enabled ?? beforeRow.is_enabled,
  });
}

export async function handleSetEnabled(
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const enabled = body.enabled === true;
  if (!id) return errorResponse("id required");

  const admin = createServiceClient();
  // Re-enabling also clears the auto-disable counters so a recovered
  // webhook starts fresh.
  const patch: Record<string, unknown> = enabled
    ? {
      is_enabled: true,
      consecutive_failures: 0,
      disabled_at: null,
      disabled_reason: null,
    }
    : {
      is_enabled: false,
      disabled_at: new Date().toISOString(),
      disabled_reason: "user_disabled",
    };

  const { error } = await admin
    .from("custom_tools")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return errorResponse(`set_enabled failed: ${error.message}`, 500);
  return ok({ id, enabled });
}
