/**
 * AI Trading Agent — Tool Registry
 *
 * Thin orchestration layer. Each tool's definition + implementation lives in
 * its own file under `./tools/` — this module re-exports the public surface
 * (`getAllCustomTools`, `executeCustomTool`, `CUSTOM_TOOL_NAMES`) consumed by
 * index.ts and run-orion-task/market-research.ts.
 *
 * When changing a tool's behaviour, edit `tools/<name>.ts` (description and
 * implementation are co-located there). When adding a new tool, register it
 * in the CUSTOM_TOOLS array below.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { GeminiFunctionDeclaration, ToolContext } from "./tools/types.ts";
import {
  executeSearchWeb,
  searchWebTool,
} from "./tools/search-web.ts";
import {
  executeScrapeUrl,
  scrapeUrlTool,
} from "./tools/scrape-url.ts";
import {
  executeGetMarketData,
  getMarketDataTool,
} from "./tools/market-data/index.ts";
import {
  executeGenerateChart,
  generateChartTool,
} from "./tools/generate-chart.ts";
import {
  executeAnalyzeImage,
  analyzeImageTool,
} from "./tools/analyze-image.ts";
import {
  executeGetRecentOrionBriefings,
  getRecentOrionBriefingsTool,
} from "./tools/get-recent-orion-briefings.ts";
import {
  executeUpdateMemory,
  updateMemoryTool,
} from "./tools/update-memory.ts";
import {
  applyRuleChangeTool,
  executeApplyRuleChange,
} from "./tools/apply-rule-change.ts";
import {
  executeManageNote,
  manageNoteTool,
} from "./tools/manage-note.ts";
import {
  executeManageEvent,
  manageEventTool,
} from "./tools/manage-event.ts";
import {
  executeManageTag,
  manageTagTool,
} from "./tools/manage-tag.ts";
import {
  executeRecallConversations,
  recallConversationsTool,
} from "./tools/recall-conversations.ts";
import {
  executeManageReminder,
  manageReminderTool,
} from "./tools/manage-reminder.ts";

// Re-export shared types so callers can keep importing from "./tools.ts".
export type { GeminiFunctionDeclaration, ToolContext };

/**
 * Per-tool execute signature. Each per-tool file picks the args it needs from
 * the bag; tools.ts hands the same shape to every executor for uniformity.
 */
type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
) => Promise<string> | string;

interface CustomTool {
  definition: GeminiFunctionDeclaration;
  execute: ToolExecutor;
}

/**
 * Registry. Order here is the order Gemini sees in the function-declarations
 * array; the model leans on the first few when descriptions tie. Keep the
 * heavily-used tools (execute_sql is in the MCP set; search_web / market_data
 * lead the custom set) near the top.
 */
const CUSTOM_TOOLS: readonly CustomTool[] = [
  { definition: searchWebTool, execute: (a, _c, s) => executeSearchWeb(a, s) },
  { definition: scrapeUrlTool, execute: (a, _c, s) => executeScrapeUrl(a, s) },
  { definition: getMarketDataTool, execute: (a, _c, s) => executeGetMarketData(a, s) },
  { definition: generateChartTool, execute: (a) => executeGenerateChart(a) },
  { definition: analyzeImageTool, execute: (a) => executeAnalyzeImage(a) },
  { definition: getRecentOrionBriefingsTool, execute: executeGetRecentOrionBriefings },
  { definition: updateMemoryTool, execute: executeUpdateMemory },
  { definition: applyRuleChangeTool, execute: executeApplyRuleChange },
  // Action-dispatched (merged) tools — internal sub-actions live in their files.
  { definition: manageNoteTool, execute: executeManageNote },
  { definition: manageEventTool, execute: executeManageEvent },
  { definition: manageTagTool, execute: executeManageTag },
  { definition: recallConversationsTool, execute: executeRecallConversations },
  { definition: manageReminderTool, execute: executeManageReminder },
];

const TOOL_BY_NAME: ReadonlyMap<string, CustomTool> = new Map(
  CUSTOM_TOOLS.map((t) => [t.definition.name, t]),
);

/** All custom tool declarations, in registration order. */
export function getAllCustomTools(): GeminiFunctionDeclaration[] {
  return CUSTOM_TOOLS.map((t) => t.definition);
}

/**
 * Name lookup set derived from getAllCustomTools() so the dispatcher in
 * index.ts can't drift out of sync with the registered tool list.
 */
export const CUSTOM_TOOL_NAMES: ReadonlySet<string> = new Set(
  CUSTOM_TOOLS.map((t) => t.definition.name),
);

/** Execute a custom tool by name. Unknown names + thrown errors get rendered
 *  to a string so the LLM always gets a textual function-response part. */
export async function executeCustomTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  const tool = TOOL_BY_NAME.get(toolName);
  if (!tool) return `Unknown custom tool: ${toolName}`;
  try {
    return await tool.execute(args, context, supabase);
  } catch (error) {
    return `Tool execution error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}
