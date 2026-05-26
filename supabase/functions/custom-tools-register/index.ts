/**
 * custom-tools-register
 *
 * Phase 2 of the custom-tools-via-webhook feature
 * (.planning/architecture/custom-tools-webhook.md).
 *
 * Action-dispatched edge function for the elite-tier registration flow:
 *
 *   draft_schema  — Gemini drafts name + description + args + sample_args
 *                   from the user's natural-language description. Returns
 *                   a freshly generated HMAC signing secret ONCE; the
 *                   client must keep it until save (and the user must
 *                   paste it into their webhook for signature verification).
 *   audit         — Gemini reviews the user-edited schema for description
 *                   quality + manipulative language + args coverage.
 *   test_fire     — fires 3 HMAC-signed POSTs at the user's webhook,
 *                   measures speed / size / shape gates, returns the best
 *                   response as baseline_sample.
 *   save          — persists the row, writes the secret to vault.
 *   list / delete / set_enabled — straightforward CRUD.
 *
 * Auth: user JWT on every action. Tier: elite-only on every action.
 * Tool cap: 5 per user, enforced on save.
 */

import {
  errorResponse,
  handleCors,
  log,
  parseJsonBody,
} from "../_shared/supabase.ts";
import { checkOrionAccess } from "../_shared/tierEnforcement.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ToolAction } from "../_shared/customTools/types.ts";
import { handleDraftSchema } from "./draft.ts";
import { handleAudit } from "./audit.ts";
import { handleTestFire } from "./testFire.ts";
import {
  checkTestToolRateLimit,
  handleDelete,
  handleEdit,
  handleList,
  handleSave,
  handleSetEnabled,
  handleTestTool,
} from "./manage.ts";

interface BaseRequest {
  action: ToolAction;
}

// Inlined to avoid the typing issue in _shared/supabase.ts's
// createAuthenticatedClient (its return type's `supabase` field doesn't
// match what the SDK actually returns). Same approach as
// suggest-tag-definition.
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const userId = await getUserId(req);
  if (!userId) return errorResponse("Unauthorized", 401);

  const tier = await checkOrionAccess(userId);
  if (tier.tier !== "elite") {
    return errorResponse("Custom tools are an elite-tier feature", 403);
  }

  const body = await parseJsonBody<BaseRequest & Record<string, unknown>>(req);
  if (!body || typeof body.action !== "string") {
    return errorResponse("Missing or invalid `action` field");
  }

  try {
    switch (body.action as ToolAction) {
      case "draft_schema":
        return await handleDraftSchema(body);
      case "audit":
        return await handleAudit(body);
      case "test_fire":
        return await handleTestFire(body);
      case "save":
        return await handleSave(userId, body);
      case "edit":
        return await handleEdit(userId, body);
      case "list":
        return await handleList(userId);
      case "delete":
        return await handleDelete(userId, body);
      case "set_enabled":
        return await handleSetEnabled(userId, body);
      case "test_tool": {
        // Per-user durable rate limit BEFORE dispatch — the in-process
        // counter in runtime.ts is per-isolate so a fan-out attacker can
        // bypass it. This is the authoritative cap.
        const limited = await checkTestToolRateLimit(userId);
        if (limited) return limited;
        return await handleTestTool(userId, body);
      }
      default:
        return errorResponse(`Unknown action: ${String(body.action)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log("custom-tools-register action failed", "error", {
      action: body.action,
      message,
    });
    return errorResponse(message, 500);
  }
});
