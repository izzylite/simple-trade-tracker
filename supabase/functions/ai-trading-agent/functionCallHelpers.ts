/**
 * Types and helpers for Gemini function-call parsing, part construction,
 * and within-turn write deduplication.
 */

import { isWebhookTool } from '../_shared/customTools/runtime.ts';

export { isWebhookTool };

/**
 * Parsed function call from Gemini response. `thoughtSignature` is required
 * by Gemini 3.x — the API emits it as a sibling field of `functionCall` on the
 * Part, and the next turn's model part must echo it back verbatim or the API
 * returns 400 ("Function call is missing a thought_signature in functionCall
 * parts"). See https://ai.google.dev/gemini-api/docs/thought-signatures
 */
export type ParsedFunctionCall = {
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
  /**
   * Gemini 3 returns a unique id on every functionCall. The matching
   * functionResponse MUST echo this id so the model maps results back to
   * calls correctly — critical for parallel calls. Older Gemini versions
   * (≤2.5) may omit it. See:
   * https://ai.google.dev/gemini-api/docs/function-calling#parallel-and-compositional
   */
  id?: string;
};

/**
 * Extract a ParsedFunctionCall from a response Part. `thoughtSignature`
 * may live on the Part itself, nested in the functionCall object, or on a
 * preceding standalone Part — all three are captured elsewhere via rawParts
 * preservation. Here we pull name/args/id for tool execution + result mapping.
 */
export function extractFunctionCall(part: Record<string, unknown>): ParsedFunctionCall | undefined {
  const fc = part.functionCall as {
    name?: string;
    args?: Record<string, unknown>;
    thoughtSignature?: string;
    id?: string;
  } | undefined;
  if (!fc?.name) return undefined;
  const thoughtSignature = (part as { thoughtSignature?: string }).thoughtSignature ?? fc.thoughtSignature;
  return { name: fc.name, args: fc.args || {}, thoughtSignature, id: fc.id };
}

/**
 * Fallback Part builder used only when a caller has no rawParts available
 * (e.g. a synthesised turn). Prefer echoing `result.rawParts` verbatim
 * whenever possible — Gemini 3.x emits thoughtSignature as its own Part
 * preceding the functionCall, and reconstructing loses that context.
 */
export function buildFunctionCallPart(call: ParsedFunctionCall): Record<string, unknown> {
  const fc: Record<string, unknown> = { name: call.name, args: call.args };
  if (call.id) fc.id = call.id;
  return {
    functionCall: fc,
    ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {})
  };
}

/**
 * Within-turn write-deduplication.
 *
 * The empty-bug retry and sequential repeated-call loop can both cause the
 * same write tool (manage_note create, manage_event record, etc.) to run twice
 * within a single user turn.  For every tool call we compute a stable key over
 * (name, args); if we've seen the key before we skip execution and return a
 * canned message so Gemini can synthesise from the earlier result without
 * re-applying the mutation.
 *
 * Only write-capable tool+action combinations are tracked.  Read-only actions
 * (search, get, list, recall) and all MCP tools (read_only=true on MCP URL)
 * are intentionally excluded — they're safe to re-execute and excluding them
 * would block legitimate clarification searches.
 */
export const WRITE_TOOL_ACTIONS = new Map<string, Set<string> | 'all'>([
  ['manage_note',      new Set(['create', 'update', 'delete'])],
  ['manage_event',     new Set(['record'])],
  ['manage_tag',       new Set(['save'])],
  ['manage_reminder',  new Set(['set', 'cancel', 'edit'])],
  ['update_memory',    'all'],
  ['apply_rule_change','all'],
]);

export function getWriteDedupeKey(toolName: string, args: Record<string, unknown>): string | null {
  // Webhook tools are always side-effecting; dedup any repeat.
  if (isWebhookTool(toolName)) return `${toolName}:${JSON.stringify(args)}`;

  const entry = WRITE_TOOL_ACTIONS.get(toolName);
  if (!entry) return null; // pure read-only tool or MCP tool

  if (entry === 'all') return `${toolName}:${JSON.stringify(args)}`;

  const action = typeof args.action === 'string' ? args.action : '';
  if (!(entry as Set<string>).has(action)) return null; // read action, safe to repeat

  return `${toolName}:${JSON.stringify(args)}`;
}

export const DEDUP_SKIP_RESULT =
  'This action was already performed earlier in this turn with the same arguments — skipping to prevent a duplicate write. The result from the earlier execution still applies.';
