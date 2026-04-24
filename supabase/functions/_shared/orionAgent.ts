/**
 * Non-streaming Orion multi-turn tool loop.
 *
 * Extracted from `ai-trading-agent/index.ts` so batch callers (rollup tasks)
 * can run the same Orion brain as chat without HTTP hops between functions.
 *
 * Scope & non-goals:
 * - Non-streaming ONLY. The SSE writer lifecycle in chat is chat-specific
 *   (tool_call/tool_result events, text_reset mid-stream), so this helper
 *   does not cover it — chat's streaming path stays where it is.
 * - Agnostic about *where* tools come from. Caller passes the full tool
 *   declaration list plus a dispatcher that resolves tool names to executors.
 *   This lets chat register MCP + custom tools, while rollups can pick a
 *   trimmed subset.
 * - Preserves Gemini 3.x `thoughtSignature` by echoing raw model parts
 *   verbatim on the next turn — reconstructing from {name,args} alone causes
 *   the next call to 400 with "Function call is missing a thought_signature".
 */

import { log } from './supabase.ts';
import {
  callGemini,
  type GeminiContent,
  type GeminiFunctionCall,
  type GeminiFunctionDeclaration,
} from './gemini.ts';

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: string;
}

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<string>;

export interface RunOrionAgentParams {
  systemPrompt: string;
  message: string;
  /**
   * Prior conversation turns. Optional — rollup callers pass nothing, chat
   * passes the running history.
   */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: GeminiFunctionDeclaration[];
  /** Resolves any tool name in `tools` to an executor result. */
  executeTool: ToolExecutor;
  /**
   * Initial tool-calling mode. Defaults to 'AUTO' — batch callers want the
   * model to decide. Chat forces 'ANY' on the very first turn to prevent
   * "I will search..." narration without action, but passes 'AUTO' for
   * continuation turns.
   */
  initialToolMode?: 'AUTO' | 'ANY' | 'NONE';
  maxTurns?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface RunOrionAgentResult {
  text: string;
  toolCalls: ToolCallRecord[];
  turnCount: number;
  /**
   * True when we had to force a final synthesis with toolMode=NONE because
   * the model kept tool-calling without producing text. Exposed so callers
   * can surface this as a quality signal.
   */
  forcedSynthesis: boolean;
}

/**
 * Run the Orion agent to completion and return the final text plus all tool
 * calls made along the way. Throws on Gemini API errors; returns a fallback
 * text (never empty) when the model misbehaves (empty bug, stuck in tool
 * loop) so callers never have to handle empty strings downstream.
 */
export async function runOrionAgent(
  params: RunOrionAgentParams
): Promise<RunOrionAgentResult> {
  const {
    systemPrompt,
    message,
    history = [],
    tools,
    executeTool,
    initialToolMode = 'AUTO',
    maxTurns = 15,
    maxOutputTokens = 4000,
    thinkingLevel = 'medium',
  } = params;

  const toolCalls: ToolCallRecord[] = [];
  let finalText = '';
  let turnCount = 0;
  let forcedSynthesis = false;

  // Build contents array. We embed the system prompt as the opening user
  // turn + a canned model ack so the model treats subsequent instructions
  // as binding without Gemini's `systemInstruction` param (which has worse
  // adherence for long security-critical prompts per our prior testing).
  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
    ...history.map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let currentToolMode: 'AUTO' | 'ANY' | 'NONE' = initialToolMode;
  let result = await callGemini({
    contents,
    tools: tools.length > 0 ? tools : undefined,
    toolMode: tools.length > 0 ? currentToolMode : undefined,
    maxOutputTokens,
    thinkingLevel,
  });

  // After turn 1, continuation turns use AUTO so the model can decide to
  // stop calling tools and synthesize.
  currentToolMode = 'AUTO';

  while (turnCount < maxTurns) {
    turnCount++;

    // Final answer: text with no function calls.
    if (result.text && result.functionCalls.length === 0) {
      finalText = result.text;
      break;
    }

    if (result.functionCalls.length === 0) {
      // No text and no calls — break and let the forced-synthesis path below
      // handle it.
      break;
    }

    // Short-circuit: if the model keeps re-calling the same tool with the
    // same args, break out of the loop. This indicates a stuck model, not
    // legitimate iterative querying.
    const firstCall = result.functionCalls[0];
    const lastRecorded = toolCalls[toolCalls.length - 1];
    if (
      result.functionCalls.length === 1 &&
      lastRecorded &&
      lastRecorded.name === firstCall.name &&
      JSON.stringify(lastRecorded.args) === JSON.stringify(firstCall.args)
    ) {
      log('Detected repeated function call — breaking loop', 'info');
      break;
    }

    // Execute all parallel calls concurrently. A single call still goes
    // through this path (length-1 array) — keeps the code path uniform.
    const executed = await Promise.all(
      result.functionCalls.map(async (call: GeminiFunctionCall) => {
        log(`Executing tool: ${call.name}`, 'info');
        try {
          const toolResult = await executeTool(call.name, call.args);
          return { call, result: toolResult };
        } catch (error) {
          log(`Tool ${call.name} threw: ${error}`, 'error');
          return { call, result: `Error: ${error instanceof Error ? error.message : 'unknown'}` };
        }
      })
    );

    const functionResponseParts: Array<Record<string, unknown>> = [];
    for (const { call, result: toolResult } of executed) {
      toolCalls.push({ name: call.name, args: call.args, result: toolResult });
      functionResponseParts.push({
        functionResponse: { name: call.name, response: { result: toolResult } },
      });
    }

    // Echo the model turn VERBATIM — Gemini 3.x emits thoughtSignature on a
    // Part preceding the functionCall, and reconstructing from {name,args}
    // drops it, causing the next call to 400.
    contents.push({ role: 'model', parts: result.rawParts });
    contents.push({ role: 'user', parts: functionResponseParts });

    result = await callGemini({
      contents,
      tools: tools.length > 0 ? tools : undefined,
      toolMode: tools.length > 0 ? currentToolMode : undefined,
      maxOutputTokens,
      thinkingLevel,
    });
  }

  if (!finalText && result.text) {
    finalText = result.text;
  }

  // Forced synthesis — the model can get stuck calling tools forever; the
  // Google-recommended mitigation is one final call with toolMode=NONE to
  // force it to summarize what it already has.
  if (!finalText) {
    log(`No text after ${turnCount} turns with ${toolCalls.length} tool calls — forcing synthesis`, 'warn');
    try {
      const synthesis = await callGemini({
        contents: [
          ...contents,
          {
            role: 'user',
            parts: [{
              text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.',
            }],
          },
        ],
        tools: tools.length > 0 ? tools : undefined,
        toolMode: 'NONE',
        maxOutputTokens,
        thinkingLevel,
      });
      if (synthesis.text) {
        finalText = synthesis.text;
        forcedSynthesis = true;
        log(`Forced synthesis succeeded (${finalText.length} chars)`, 'info');
      }
    } catch (err) {
      log(`Forced synthesis failed: ${err}`, 'error');
    }
  }

  if (!finalText) {
    finalText =
      'I gathered some data but ran into a temporary issue composing a response. Please try again.';
  }

  return { text: finalText, toolCalls, turnCount, forcedSynthesis };
}
