/**
 * Shared harness for all Orion rollup briefings (daily/weekly/monthly).
 *
 * Wraps `_shared/orionAgent.runOrionAgent` with the tool set, system prompt,
 * memory pre-loading, and lenient response parsing that every rollup needs.
 * Keeping this in one place means a tone tweak, tool-budget change, or
 * parse-contract adjustment applies to all three rollup types at once.
 *
 * Response contract (suggested, NOT enforced):
 *   { significance: 'low'|'medium'|'high', title: string,
 *     briefing_html: string, briefing_plain: string }
 * If the model returns plain HTML/text instead, we treat the whole thing as
 * the briefing and fall back to defaults for significance/title. This is
 * deliberate — hard-requiring structured JSON with tools enabled has bitten
 * us before (Gemini's responseSchema is incompatible with function calls).
 */

import { createServiceClient, log } from '../_shared/supabase.ts';
import { runOrionAgent } from '../_shared/orionAgent.ts';
import { callMCPTool, getCachedMCPTools, getMcpConfig } from '../_shared/orionMcp.ts';
import { fetchAgentMemory } from '../_shared/orionMemory.ts';
import { summarizeToolCalls } from '../_shared/toolLabels.ts';
import {
  CUSTOM_TOOL_NAMES,
  executeCustomTool,
  getAllCustomTools,
} from '../ai-trading-agent/tools.ts';
import { buildSecureSystemPrompt } from '../ai-trading-agent/systemPrompt.ts';
import type { SupabaseClient, TaskResult } from './types.ts';

/**
 * Rendering guidance for briefings. The TaskResultCard now uses the same
 * HtmlMessageRenderer chat uses, so <trade-ref/>, <event-ref/>, <note-ref/>,
 * and <tag-chip/> all render as interactive chips. This constant simply
 * reinforces the ref convention so Orion leans into it for briefings too.
 * Frontend fetches referenced entities on-demand when the card expands,
 * so refs always show fresh data even for old briefings.
 */
export const BRIEFING_RENDER_RULES = `
BRIEFING RENDERING NOTES:
- Use <trade-ref id="uuid"/> to inline-reference a trade (renders as a clickable chip with P&L).
- Use <event-ref id="uuid"/> for an economic event, <note-ref id="uuid"/> for a note.
- Use <tag-chip>TagName</tag-chip> to highlight calendar tags inline.
- IDs MUST be real UUIDs you fetched via execute_sql in THIS run — never invent them.
- Keep section headers at <h3> or <h4>. Avoid <a href> / <img> — briefings are read in-place.
`;

/**
 * Count trades closed within [startIso, endIso). Used by rollup handlers to
 * short-circuit to a friendly default briefing when there's no activity —
 * saves an Orion invocation (and its token cost) on quiet days.
 *
 * Errors (network/RLS/etc.) return -1 so callers can fall through to the
 * Orion path. A failed count should NOT block the briefing.
 */
export async function countTradesInRange(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  startIso: string,
  endIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .gte('trade_date', startIso)
    .lt('trade_date', endIso);

  if (error) {
    log('countTradesInRange failed', 'warn', error);
    return -1;
  }
  return count ?? 0;
}

/**
 * Build a friendly default briefing for periods with zero trades. Mirrors
 * the original daily-analysis behaviour so the user still sees a card
 * acknowledging the empty day/week/month (rather than silence).
 */
export function emptyBriefingResult(
  message: string,
  defaultTitle: string
): TaskResult {
  return {
    content_html: `<p>${message}</p>`,
    content_plain: message,
    significance: null,
    metadata: {
      title: defaultTitle,
      generated_at: new Date().toISOString(),
      zero_trades: true,
    },
  };
}

export interface GenerateBriefingParams {
  userId: string;
  calendarId: string;
  /**
   * User-turn message. Callers build this with tone instruction + task spec
   * + the suggested JSON contract. The agent is free to query whatever it
   * needs via execute_sql / get_market_price / etc.
   */
  userMessage: string;
  /** Title to use when the model's JSON is missing or malformed. */
  defaultTitle: string;
  /** Cap on tool-calling turns. Rollups can allow more than chat (data gathering). */
  maxTurns?: number;
}

export async function generateBriefing(
  params: GenerateBriefingParams
): Promise<TaskResult> {
  const { userId, calendarId, userMessage, defaultTitle, maxTurns = 20 } = params;

  // 1. Pull MCP tools (execute_sql + list_tables — all the rollup needs from MCP).
  //    Other MCP tools would just bloat the Gemini tool registry.
  const { projectRef, accessToken } = getMcpConfig();
  const mcpTools = await getCachedMCPTools(projectRef, accessToken, [
    'execute_sql',
    'list_tables',
  ]);

  // 2. Combine with all custom tools (search_web, get_market_price, notes, memory, etc.).
  const customTools = getAllCustomTools();
  const allTools = [...mcpTools, ...customTools];

  // 3. Pre-load memory so the briefing is personalized from turn 0.
  const preloadedMemory = await fetchAgentMemory(userId, calendarId);

  // 4. Build the same Orion system prompt chat uses. Rollup tasks get the full
  //    persona, guardrails, and reference docs for free.
  const systemPrompt = buildSecureSystemPrompt(
    userId,
    calendarId,
    undefined, // calendarContext — agent can query if it needs it
    undefined, // focusedTradeId — rollups are not single-trade
    preloadedMemory,
    undefined
  );

  // 5. Tool dispatcher bridges the loop to our two tool sources.
  const supabase = createServiceClient();
  const executeTool = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<string> => {
    if (CUSTOM_TOOL_NAMES.has(name)) {
      return executeCustomTool(name, args, { userId, calendarId }, supabase);
    }
    return callMCPTool(projectRef, accessToken, name, args);
  };

  // 6. Run the agent. `initialToolMode: 'AUTO'` lets it go straight to a
  //    final answer on quiet days instead of being forced to call a tool.
  const agentResult = await runOrionAgent({
    systemPrompt,
    message: userMessage,
    tools: allTools,
    executeTool,
    initialToolMode: 'AUTO',
    maxTurns,
  });

  log(
    `Briefing agent done: ${agentResult.turnCount} turns, ${agentResult.toolCalls.length} tool calls` +
      (agentResult.forcedSynthesis ? ' (forced synthesis)' : ''),
    'info'
  );

  return parseBriefingResponse(agentResult.text, defaultTitle, {
    turnCount: agentResult.turnCount,
    toolCallCount: agentResult.toolCalls.length,
    forcedSynthesis: agentResult.forcedSynthesis,
    // {name,label} pairs rendered as a "N tools used" chip on the
    // TaskResultCard, matching the Orion chat UI. Kept in metadata (not a
    // top-level column) so we don't need a schema migration.
    tool_calls: summarizeToolCalls(agentResult.toolCalls),
  });
}

/**
 * Lenient parser. Tries JSON first (fenced or raw); falls back to treating
 * the whole response as HTML. We never reject a non-conforming response —
 * the briefing is always shown to the user, even if significance/title are
 * missing.
 */
function parseBriefingResponse(
  rawText: string,
  defaultTitle: string,
  meta: Record<string, unknown>
): TaskResult {
  const jsonMatch = extractJsonBlock(rawText);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch);
      const significance = ['low', 'medium', 'high'].includes(parsed.significance)
        ? parsed.significance
        : null;
      const html =
        typeof parsed.briefing_html === 'string' && parsed.briefing_html.length > 0
          ? parsed.briefing_html
          : null;
      const plain =
        typeof parsed.briefing_plain === 'string' && parsed.briefing_plain.length > 0
          ? parsed.briefing_plain
          : null;
      if (html) {
        return {
          content_html: html,
          content_plain: plain ?? stripHtml(html),
          significance,
          metadata: {
            ...meta,
            title: typeof parsed.title === 'string' ? parsed.title : defaultTitle,
            generated_at: new Date().toISOString(),
          },
        };
      }
    } catch (err) {
      log('Briefing JSON parse failed, falling back to plain text', 'warn', {
        err: String(err),
      });
    }
  }

  // Fallback: treat the whole response as the briefing body.
  const html = rawText.trim().startsWith('<') ? rawText : `<p>${escapeHtml(rawText)}</p>`;
  return {
    content_html: html,
    content_plain: stripHtml(html),
    significance: null,
    metadata: {
      ...meta,
      title: defaultTitle,
      generated_at: new Date().toISOString(),
      parse_fallback: true,
    },
  };
}

// Extract a JSON object from the response. Handles the three realistic
// shapes we see from Gemini:
//   1. Fenced in ```json ... ```
//   2. Raw `{...}` with nothing before/after
//   3. Preamble text + `{...}` ("Here is the briefing:\n{...}")
// and is string-aware (tracks quotes + escapes) so a literal `{` or `}` in
// briefing_html doesn't throw off the bracket counter.
function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) return fenced[1];

  // Walk every candidate `{` in the text, try to find a balanced object
  // starting there, and validate by JSON.parse. First parseable wins.
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            // Not a parseable object at this offset — break inner loop
            // and try the next `{`.
          }
          break;
        }
      }
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
