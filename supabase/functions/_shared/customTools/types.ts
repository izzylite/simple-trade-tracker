// Shared types for the custom-tools feature
// (.planning/architecture/custom-tools-webhook.md).

/**
 * Gemini-compatible args schema. Same shape Gemini accepts in
 * function_declarations.parameters. Top-level is always type:"object".
 */
export interface ArgsSchema {
  type: "object";
  properties: Record<string, ArgsSchemaProperty>;
  required?: string[];
}

export interface ArgsSchemaProperty {
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  enum?: string[];
}

/**
 * Output of the draft_schema action — Gemini's first pass at a tool
 * definition based on the user's natural-language description.
 */
export interface DraftedSchema {
  /** snake_case, ≤54 chars, ^[a-z][a-z0-9_]*$ */
  name: string;
  /** "user_tool_" + name */
  registered_name: string;
  /** When to call AND when NOT to call. ≤1024 chars. */
  description: string;
  args_schema: ArgsSchema;
  /** Plausible sample args matching args_schema. Used by test_fire. */
  sample_args: Record<string, unknown>;
}

export type GateStatus = "pass" | "warn" | "fail";

export interface TestFireResult {
  speed: {
    median_ms: number;
    status: GateStatus;  // <800 pass, 800-2500 warn, >2500 fail
    calls: Array<{ latency_ms: number; http_status: number | null; error?: string }>;
  };
  size: {
    max_bytes: number;
    status: GateStatus;  // ≤256KB pass, >256KB fail
  };
  shape: {
    status: GateStatus;  // all 3 returned valid JSON object/array, status 2xx
    details: string;
  };
  /** Best successful response — stored as baseline_sample on save. */
  baseline_sample: unknown;
  /** Overall: pass if every gate is pass; warn if any warn but none fail; fail if any fail. */
  overall: GateStatus;
}

export interface AuditResult {
  status: GateStatus;
  warnings: string[];   // ambiguity, missing "when not to call" guidance
  blockers: string[];   // instructional/manipulative language, args-description mismatch
}

export type ToolAction =
  | "draft_schema"
  | "audit"
  | "test_fire"
  | "save"
  | "edit"
  | "list"
  | "delete"
  | "set_enabled"
  | "test_tool";

export interface TestToolResult {
  /** 'success' if the dispatch fired AND the webhook returned a usable
   *  response; 'failed' if the dispatch counted a failure; 'rate_limited'
   *  if the in-process rate limiter blocked the call; 'disabled' if the
   *  tool was disabled before we could fire. */
  status: "success" | "failed" | "rate_limited" | "disabled";
  /** Populated on 'failed' — Postgres `last_failure_reason` after the fire. */
  error?: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  success_count: number;
  failure_count: number;
  is_enabled: boolean;
}

export interface CustomToolRow {
  id: string;
  user_id: string;
  name: string;
  registered_name: string;
  description: string;
  args_schema: ArgsSchema;
  webhook_url: string;
  secret_vault_key: string;
  is_read_only: boolean;
  is_enabled: boolean;
  baseline_sample: unknown;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

// Limits / thresholds — match the design doc and the answers locked in
// conversation (.planning/architecture/custom-tools-webhook.md).
export const TOOL_CAP_PER_USER = 5;
export const TEST_FIRE_CALL_COUNT = 3;
export const TEST_FIRE_TIMEOUT_MS = 5000;
export const RESPONSE_SIZE_CAP_BYTES = 256 * 1024;
export const SPEED_GATE_GREEN_MS = 800;
export const SPEED_GATE_REJECT_MS = 2500;
export const AUTO_DISABLE_THRESHOLD = 10;
