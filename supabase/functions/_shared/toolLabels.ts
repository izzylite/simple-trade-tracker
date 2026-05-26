/**
 * Shared tool-name → human-friendly label map.
 *
 * Kept alongside the agent so streaming chat, rollup briefings, and any
 * future Orion surface use the same vocabulary when surfacing tool use in
 * the UI. Frontend (`useAIChat`) has a near-identical map for the SSE
 * tool_call events it gets mid-stream; the two should stay in sync.
 *
 * Merged action-dispatched tools (manage_note, manage_event, …) resolve via
 * an `${name}:${action}` key when the action is known, falling back to a
 * generic per-tool label otherwise.
 */
export const ORION_TOOL_LABELS: Record<string, string> = {
  execute_sql: 'Querying database',
  list_tables: 'Listing tables',
  search_web: 'Searching web',
  scrape_url: 'Reading article',
  analyze_image: 'Analyzing chart',
  generate_chart: 'Generating chart',
  get_market_data: 'Fetching market data',
  update_memory: 'Updating memory',
  apply_rule_change: 'Updating memory',
  get_recent_orion_briefings: 'Reading briefings',

  // Merged tools — generic fallbacks
  manage_note: 'Working with notes',
  manage_event: 'Episodic memory',
  manage_tag: 'Working with tags',
  recall_conversations: 'Searching conversations',
  manage_reminder: 'Working with reminders',

  // Merged tools — per-action labels
  'manage_note:create': 'Creating note',
  'manage_note:update': 'Updating note',
  'manage_note:delete': 'Deleting note',
  'manage_note:search': 'Searching notes',
  'manage_event:record': 'Logging event',
  'manage_event:recall': 'Recalling events',
  'manage_tag:get': 'Looking up tag',
  'manage_tag:save': 'Saving tag definition',
  'recall_conversations:search': 'Searching conversations',
  'recall_conversations:get': 'Loading conversation',
  'manage_reminder:set': 'Setting reminder',
  'manage_reminder:list': 'Checking reminders',
  'manage_reminder:cancel': 'Cancelling reminder',
  'manage_reminder:edit': 'Editing reminder',
  // Gemini built-in tool (no namespacing — single label).
  code_execution: 'Running code',
  'get_market_data:quote': 'Checking market price',
  'get_market_data:history': 'Pulling historical candles',
  'get_market_data:indicator': 'Computing indicator',
  'get_market_data:search': 'Searching symbols',
};

/** Resolve a friendly label for a tool call, using `action` when present. */
export function labelForToolCall(
  name: string,
  args?: Record<string, unknown> | null,
): string {
  const action = args && typeof args.action === 'string' ? args.action : undefined;
  if (action && ORION_TOOL_LABELS[`${name}:${action}`]) {
    return ORION_TOOL_LABELS[`${name}:${action}`];
  }
  if (ORION_TOOL_LABELS[name]) return ORION_TOOL_LABELS[name];
  // User-defined webhook tools — strip the internal `user_tool_` namespace
  // prefix so chats show e.g. `get_unusual_options_flow`, not the raw
  // registered_name. Server-side and client-side label maps stay in sync.
  if (name.startsWith('user_tool_')) return name.slice('user_tool_'.length);
  return name;
}

export interface ToolCallSummary {
  name: string;
  label: string;
}

/** Convert raw tool calls into `{name,label}` pairs for UI rendering. */
export function summarizeToolCalls(
  toolCalls: Array<{ name: string; args?: Record<string, unknown> }>,
): ToolCallSummary[] {
  return toolCalls.map((t) => ({
    name: t.name,
    label: labelForToolCall(t.name, t.args),
  }));
}
