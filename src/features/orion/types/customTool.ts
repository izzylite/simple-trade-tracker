// Frontend types for the custom-tools feature. Mirror the backend
// shapes in supabase/functions/_shared/customTools/types.ts.

export interface ArgsSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description: string;
  enum?: string[];
}

export interface ArgsSchema {
  type: 'object';
  properties: Record<string, ArgsSchemaProperty>;
  required?: string[];
}

export type GateStatus = 'pass' | 'warn' | 'fail';

export interface DraftedSchemaResponse {
  name: string;
  registered_name: string;
  description: string;
  args_schema: ArgsSchema;
  sample_args: Record<string, unknown>;
  /** Returned ONCE — must be kept in client memory until save. */
  secret: string;
}

export interface AuditResult {
  status: GateStatus;
  warnings: string[];
  blockers: string[];
}

export interface TestFireResult {
  speed: {
    median_ms: number;
    status: GateStatus;
    calls: Array<{ latency_ms: number; http_status: number | null; error?: string }>;
  };
  size: { max_bytes: number; status: GateStatus };
  shape: { status: GateStatus; details: string };
  baseline_sample: unknown;
  overall: GateStatus;
}

export interface CustomToolListEntry {
  id: string;
  name: string;
  registered_name: string;
  description: string;
  args_schema: ArgsSchema;
  webhook_url: string;
  is_read_only: boolean;
  is_enabled: boolean;
  baseline_sample: unknown;
  consecutive_failures: number;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const TOOL_CAP_PER_USER = 5;

export interface TestToolResult {
  status: 'success' | 'failed' | 'rate_limited' | 'disabled';
  error?: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  success_count: number;
  failure_count: number;
  is_enabled: boolean;
}
