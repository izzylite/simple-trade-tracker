// Custom-tools client — thin wrapper over the custom-tools-register
// edge function. One method per action.
//
// Errors: every method throws a CustomToolsError with the server's
// error string. UI components should catch and surface inline.

import { supabase } from 'config/supabase';
import type {
  ArgsSchema,
  AuditResult,
  CustomToolListEntry,
  DraftedSchemaResponse,
  TestFireResult,
  TestToolResult,
} from 'features/orion/types/customTool';

const FUNCTION_NAME = 'custom-tools-register';

export class CustomToolsError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CustomToolsError';
  }
}

async function callAction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, ...payload },
  });

  if (error) {
    // supabase-js wraps non-2xx into a FunctionsHttpError. The body usually
    // contains { success:false, error:"..." } from our errorResponse helper.
    let serverMessage = error.message;
    try {
      const ctx = (error as { context?: { error?: string } }).context;
      if (ctx?.error) serverMessage = ctx.error;
    } catch { /* fall through */ }
    throw new CustomToolsError(serverMessage);
  }

  if (!data || typeof data !== 'object') {
    throw new CustomToolsError('empty response from server');
  }

  const body = data as { success?: boolean; error?: string } & Record<string, unknown>;
  if (body.success === false) {
    throw new CustomToolsError(body.error ?? 'unknown server error');
  }

  return body as unknown as T;
}

export async function draftSchema(input: {
  description: string;
  webhook_url: string;
}): Promise<DraftedSchemaResponse> {
  const res = await callAction<{ draft: DraftedSchemaResponse }>('draft_schema', input);
  return res.draft;
}

export async function auditSchema(input: {
  name: string;
  description: string;
  args_schema: ArgsSchema;
}): Promise<AuditResult> {
  const res = await callAction<{ audit: AuditResult }>('audit', input);
  return res.audit;
}

export async function testFire(input: {
  webhook_url: string;
  sample_args: Record<string, unknown>;
  /** Pass `secret` for a new registration (draft_schema returned it).
   *  Pass `tool_id` for an edit retest (server resolves the vault secret). */
  secret?: string;
  tool_id?: string;
  registered_name: string;
}): Promise<TestFireResult> {
  const res = await callAction<{ test_fire: TestFireResult }>('test_fire', input);
  return res.test_fire;
}

export async function saveTool(input: {
  name: string;
  description: string;
  args_schema: ArgsSchema;
  webhook_url: string;
  secret: string;
  is_read_only: boolean;
  baseline_sample: unknown;
}): Promise<{ id: string }> {
  const res = await callAction<{ id: string }>('save', input);
  return { id: res.id };
}

/**
 * Partial edit. Only include fields the user changed — server validates each
 * provided field and updates the row. Field-aware gate matrix is enforced
 * client-side via the UI's enable/disable of the save button.
 */
export async function editTool(input: {
  id: string;
  name?: string;
  description?: string;
  args_schema?: ArgsSchema;
  webhook_url?: string;
  is_read_only?: boolean;
  baseline_sample?: unknown;
}): Promise<{ id: string }> {
  const res = await callAction<{ id: string }>('edit', input);
  return { id: res.id };
}

export async function listTools(): Promise<CustomToolListEntry[]> {
  const res = await callAction<{ tools: CustomToolListEntry[] }>('list');
  return res.tools ?? [];
}

export async function deleteTool(id: string): Promise<void> {
  await callAction('delete', { id });
}

export async function setToolEnabled(id: string, enabled: boolean): Promise<void> {
  await callAction('set_enabled', { id, enabled });
}

/**
 * Fire the saved tool against its live webhook from the settings card.
 * Uses the tool's stored baseline_sample as args, signs with the vault
 * secret, and bumps the success/failure counters server-side. Returns
 * the post-call counter snapshot plus an explicit status the UI can
 * surface inline.
 */
export async function testTool(toolId: string): Promise<TestToolResult> {
  return await callAction<TestToolResult>('test_tool', { tool_id: toolId });
}
