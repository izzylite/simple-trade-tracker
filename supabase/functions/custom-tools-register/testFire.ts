// test_fire: HMAC-signs 3 POSTs to the user's webhook with sample args
// and measures the speed / size / shape gates. The "no registration
// without a passing test-fire" rule is what makes the overall feature
// safe to ship — every other gate depends on this actually running.

import { corsHeaders, createServiceClient, errorResponse, log } from "../_shared/supabase.ts";
import { validateWebhookUrl } from "../_shared/customTools/urlValidator.ts";
import { signWebhookBody } from "../_shared/customTools/signing.ts";
import {
  RESPONSE_SIZE_CAP_BYTES,
  SPEED_GATE_GREEN_MS,
  SPEED_GATE_REJECT_MS,
  TEST_FIRE_CALL_COUNT,
  TEST_FIRE_TIMEOUT_MS,
  type GateStatus,
  type TestFireResult,
} from "../_shared/customTools/types.ts";

interface TestFireRequest {
  webhook_url: string;
  sample_args: Record<string, unknown>;
  /** For new registrations — client passes the secret it got from draft_schema. */
  secret?: string;
  /** For edit retests — server resolves the secret from vault by tool_id. */
  tool_id?: string;
  registered_name: string;
}

interface SingleCallResult {
  latency_ms: number;
  http_status: number | null;
  size_bytes: number;
  size_exceeded: boolean;
  parsed_response: unknown;
  shape_ok: boolean;
  error?: string;
}

function ok(payload: TestFireResult): Response {
  return new Response(JSON.stringify({ success: true, test_fire: payload }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function classifySpeed(medianMs: number): GateStatus {
  if (medianMs < SPEED_GATE_GREEN_MS) return "pass";
  if (medianMs < SPEED_GATE_REJECT_MS) return "warn";
  return "fail";
}

function shapeOk(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  // Object or array — both are consumable by Orion's tool-result handler.
  return true;
}

/**
 * Stream the response body with a hard cap so a malicious / misconfigured
 * webhook can't OOM the edge function with a 1GB response. Cancels the
 * stream and returns size_exceeded=true the moment we cross the cap.
 */
async function readBodyWithCap(
  response: Response,
): Promise<{ text: string; size_bytes: number; size_exceeded: boolean }> {
  if (!response.body) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    return {
      text,
      size_bytes: bytes,
      size_exceeded: bytes > RESPONSE_SIZE_CAP_BYTES,
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > RESPONSE_SIZE_CAP_BYTES) {
        await reader.cancel().catch(() => {});
        return { text: "", size_bytes: received, size_exceeded: true };
      }
      chunks.push(value);
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw err;
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return {
    text: new TextDecoder().decode(combined),
    size_bytes: received,
    size_exceeded: false,
  };
}

async function fireOnce(
  url: string,
  body: string,
  signature: string,
  registeredName: string,
  idempotencyKey: string,
): Promise<SingleCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_FIRE_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Orion-Signature": signature,
        "X-Orion-Tool": registeredName,
        "X-Orion-Idempotency-Key": idempotencyKey,
        "X-Orion-Test": "true",
      },
      body,
      signal: controller.signal,
      // SSRF defense: never follow redirects. The registered URL passed
      // validateWebhookUrl but a 302 target would NOT be re-validated.
      // Refuse redirects outright.
      redirect: "manual",
    });

    const elapsed = Math.round(performance.now() - started);

    // Manual-redirect responses surface as opaque (Deno) or 3xx. Either
    // way the test should fail loudly so the user fixes their webhook
    // before registration.
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return {
        latency_ms: elapsed,
        http_status: response.status,
        size_bytes: 0,
        size_exceeded: false,
        parsed_response: null,
        shape_ok: false,
        error: `redirect (status ${response.status}) — redirects are blocked for SSRF safety; use the final URL directly`,
      };
    }

    const { text, size_bytes, size_exceeded } = await readBodyWithCap(response);

    if (size_exceeded) {
      return {
        latency_ms: elapsed,
        http_status: response.status,
        size_bytes,
        size_exceeded: true,
        parsed_response: null,
        shape_ok: false,
        error: `response exceeded ${RESPONSE_SIZE_CAP_BYTES} bytes`,
      };
    }

    let parsed: unknown = null;
    let parseError: string | undefined;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch (err) {
      parseError = `invalid JSON: ${(err as Error).message}`;
    }

    return {
      latency_ms: elapsed,
      http_status: response.status,
      size_bytes,
      size_exceeded: false,
      parsed_response: parsed,
      shape_ok: response.ok && parseError === undefined && shapeOk(parsed),
      error: parseError ?? (response.ok ? undefined : `http ${response.status}`),
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - started);
    const message = (err as Error).name === "AbortError"
      ? `timeout after ${TEST_FIRE_TIMEOUT_MS}ms`
      : (err as Error).message;
    return {
      latency_ms: elapsed,
      http_status: null,
      size_bytes: 0,
      size_exceeded: false,
      parsed_response: null,
      shape_ok: false,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleTestFire(
  body: Record<string, unknown>,
): Promise<Response> {
  const req: TestFireRequest = {
    webhook_url:
      typeof body.webhook_url === "string" ? body.webhook_url.trim() : "",
    sample_args:
      body.sample_args && typeof body.sample_args === "object"
        ? body.sample_args as Record<string, unknown>
        : {},
    secret: typeof body.secret === "string" ? body.secret : undefined,
    tool_id: typeof body.tool_id === "string" ? body.tool_id : undefined,
    registered_name:
      typeof body.registered_name === "string" ? body.registered_name : "",
  };

  if (!req.webhook_url || !req.registered_name) {
    return errorResponse("webhook_url and registered_name required");
  }

  // Resolve the secret: either inline (new registration) or from vault
  // (edit retest). Inline takes priority — the caller has just generated
  // it via draft_schema and we don't want to round-trip vault for that path.
  let effectiveSecret = req.secret;
  if (!effectiveSecret && req.tool_id) {
    const admin = createServiceClient();
    const { data, error } = await admin.rpc("read_custom_tool_secret", {
      p_tool_id: req.tool_id,
    });
    if (error || !data) {
      return errorResponse("could not load secret for tool retest", 500);
    }
    effectiveSecret = data as string;
  }
  if (!effectiveSecret) {
    return errorResponse("either secret or tool_id required for test_fire");
  }

  // Re-resolve DNS. validateWebhookUrl was already called at draft_schema
  // but a fresh check here protects against rebinding between actions.
  const urlCheck = await validateWebhookUrl(req.webhook_url);
  if (!urlCheck.valid) {
    return errorResponse(`webhook_url rejected: ${urlCheck.reason}`);
  }

  const calls: SingleCallResult[] = [];
  for (let i = 0; i < TEST_FIRE_CALL_COUNT; i++) {
    const payload = {
      tool_name: req.registered_name,
      args: req.sample_args,
      conversation_id: null,
      idempotency_key: `test_${crypto.randomUUID()}`,
      test: true,
    };
    const serialized = JSON.stringify(payload);
    const signature = await signWebhookBody(effectiveSecret, serialized);
    const result = await fireOnce(
      req.webhook_url,
      serialized,
      signature,
      req.registered_name,
      payload.idempotency_key,
    );
    calls.push(result);
  }

  const latencies = calls.map((c) => c.latency_ms);
  const medianMs = median(latencies);
  const speedStatus = classifySpeed(medianMs);

  const maxBytes = Math.max(...calls.map((c) => c.size_bytes), 0);
  const sizeStatus: GateStatus = calls.some((c) => c.size_exceeded)
    ? "fail"
    : "pass";

  const allShapeOk = calls.every((c) => c.shape_ok);
  const someShapeOk = calls.some((c) => c.shape_ok);
  const shapeStatus: GateStatus = allShapeOk
    ? "pass"
    : someShapeOk
    ? "warn"
    : "fail";
  const shapeDetails = calls
    .filter((c) => !c.shape_ok)
    .map((c, i) => `call ${i + 1}: ${c.error ?? "shape rejected"}`)
    .join("; ") || "all 3 calls returned a valid JSON object/array with 2xx status";

  // Best baseline: first call with shape_ok. If none, leave null.
  const baseline = calls.find((c) => c.shape_ok)?.parsed_response ?? null;

  const gates: GateStatus[] = [speedStatus, sizeStatus, shapeStatus];
  const overall: GateStatus = gates.includes("fail")
    ? "fail"
    : gates.includes("warn")
    ? "warn"
    : "pass";

  const result: TestFireResult = {
    speed: {
      median_ms: medianMs,
      status: speedStatus,
      calls: calls.map((c) => ({
        latency_ms: c.latency_ms,
        http_status: c.http_status,
        error: c.error,
      })),
    },
    size: { max_bytes: maxBytes, status: sizeStatus },
    shape: { status: shapeStatus, details: shapeDetails },
    baseline_sample: baseline,
    overall,
  };

  log("test_fire complete", "info", {
    registered_name: req.registered_name,
    median_ms: medianMs,
    overall,
  });

  return ok(result);
}
