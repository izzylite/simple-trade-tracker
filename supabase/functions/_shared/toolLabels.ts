/**
 * Shared tool-name → human-friendly label map.
 *
 * Kept alongside the agent so streaming chat, rollup briefings, and any
 * future Orion surface use the same vocabulary when surfacing tool use in
 * the UI. Frontend (`useAIChat`) has a near-identical map for the SSE
 * tool_call events it gets mid-stream; the two should stay in sync.
 */
export const ORION_TOOL_LABELS: Record<string, string> = {
  execute_sql: 'Querying database',
  list_tables: 'Listing tables',
  search_web: 'Searching web',
  scrape_url: 'Reading article',
  analyze_image: 'Analyzing chart',
  generate_chart: 'Generating chart',
  get_market_price: 'Checking market price',
  get_economic_events: 'Checking economic calendar',
  get_crypto_price: 'Checking crypto price',
  get_forex_price: 'Checking forex price',
  create_note: 'Creating note',
  update_note: 'Updating note',
  delete_note: 'Deleting note',
  search_notes: 'Searching notes',
  update_memory: 'Updating memory',
  get_tag_definition: 'Looking up tag',
  save_tag_definition: 'Saving tag definition',
  get_recent_orion_briefings: 'Reading briefings',
  search_conversations: 'Searching conversations',
  get_conversation: 'Loading conversation',
};

export interface ToolCallSummary {
  name: string;
  label: string;
}

/** Convert raw tool names into `{name,label}` pairs for UI rendering. */
export function summarizeToolCalls(
  toolCalls: Array<{ name: string }>
): ToolCallSummary[] {
  return toolCalls.map((t) => ({
    name: t.name,
    label: ORION_TOOL_LABELS[t.name] ?? t.name,
  }));
}
