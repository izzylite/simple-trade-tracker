/**
 * reminderAgentLoop — runs the non-streaming Gemini function-calling loop
 * for a reminder fire.
 *
 * Accepts pre-built tools + conversation history, executes up to 15 turns,
 * and returns { finalText, functionCalls, firstRoundUsage, lastUsageMetadata,
 * roundUsages } so the caller (reminderHandler) can append the result and
 * update the reminder row.
 */

import { log } from '../_shared/supabase.ts';
import {
  callMCPTool,
} from '../_shared/orionMcp.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import {
  CUSTOM_TOOL_NAMES,
  executeCustomTool,
} from './tools.ts';
import {
  dispatchWebhookTool,
  isWebhookTool,
} from '../_shared/customTools/runtime.ts';
import { finiteOrZero, billOrionTokensForRound } from './billing.ts';
import {
  buildFunctionCallPart,
  getWriteDedupeKey,
  DEDUP_SKIP_RESULT,
} from './functionCallHelpers.ts';
import { buildFunctionResponseParts } from './sseHelpers.ts';
import { callGemini, callGeminiWithContents } from './geminiCalls.ts';

export interface ReminderAgentLoopParams {
  googleApiKey: string;
  systemPrompt: string;
  userTurnMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  allTools: GeminiFunctionDeclaration[];
  userId: string;
  calendarId: string | undefined;
  conversationId: string;
  projectRef: string;
  supabaseAccessToken: string;
  serviceClient: ReturnType<typeof import('../_shared/supabase.ts').createServiceClient>;
}

export interface ReminderAgentLoopResult {
  finalText: string;
  functionCalls: Array<{ name: string; args: unknown; result: string }>;
  firstRoundUsage: Record<string, unknown> | undefined;
  lastUsageMetadata: Record<string, unknown> | undefined;
  roundUsages: Array<Record<string, unknown>>;
}

export async function reminderAgentLoop(p: ReminderAgentLoopParams): Promise<ReminderAgentLoopResult> {
  const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
  const executedWriteKeys = new Set<string>();
  let firstRoundUsage: Record<string, unknown> | undefined;
  let lastUsageMetadata: Record<string, unknown> | undefined;
  const roundUsages: Array<Record<string, unknown>> = [];
  let lastBilledPromptTokens = 0;
  let lastBatchKey = '';
  let finalText = '';

  let result = await callGemini(
    p.googleApiKey, p.systemPrompt, p.userTurnMessage, p.conversationHistory, p.allTools
  );
  if (result.usageMetadata) {
    firstRoundUsage = result.usageMetadata;
    lastUsageMetadata = result.usageMetadata;
    roundUsages.push(result.usageMetadata);
    billOrionTokensForRound(p.userId, result.usageMetadata);
    lastBilledPromptTokens = finiteOrZero(result.usageMetadata.promptTokenCount);
  }

  const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    ...p.conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: p.userTurnMessage }] }
  ];

  let turnCount = 0;
  const maxTurns = 15;
  const reminderStartMs = Date.now();
  const REMINDER_BUDGET_MS = 130_000;

  while (turnCount < maxTurns) {
    turnCount++;
    const elapsed = Date.now() - reminderStartMs;
    if (elapsed > REMINDER_BUDGET_MS) {
      log(`[reminder] Wall-clock budget exhausted (${elapsed}ms) after ${turnCount} turns — breaking loop`, 'warn');
      break;
    }

    if (result.functionCall && !result.functionCalls) {
      result = { ...result, functionCalls: [result.functionCall], functionCall: undefined };
    }
    if (!result.functionCalls?.length) {
      if (result.text) finalText = result.text;
      break;
    }

    // Repeated-batch guard: same tool batch twice = stuck loop.
    const batchKey = result.functionCalls.map(c => `${c.name}:${JSON.stringify(c.args)}`).sort().join('|');
    if (batchKey === lastBatchKey) {
      log('[reminder] Repeated function batch detected — breaking loop', 'warn');
      break;
    }
    lastBatchKey = batchKey;

    // search_web rate cap: 3 calls per turn maximum.
    const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
    if (searchWebCount >= 3 && result.functionCalls.some(c => c.name === 'search_web')) {
      log('[reminder] search_web rate limit (3/turn) reached — breaking loop', 'info');
      break;
    }

    log(`[reminder] Executing ${result.functionCalls.length} function(s)`, 'info');
    const execResults = await Promise.all(result.functionCalls.map(async (call) => {
      try {
        const dedupeKey = getWriteDedupeKey(call.name, call.args);
        if (dedupeKey && executedWriteKeys.has(dedupeKey)) {
          log(`[reminder] Dedup: skipping duplicate write ${call.name}`, 'warn');
          return { call, result: DEDUP_SKIP_RESULT };
        }
        if (dedupeKey) executedWriteKeys.add(dedupeKey);

        const r = CUSTOM_TOOL_NAMES.has(call.name)
          ? await executeCustomTool(call.name, call.args, {
            userId: p.userId, calendarId: p.calendarId, conversationId: p.conversationId
          }, p.serviceClient)
          : isWebhookTool(call.name)
          ? await dispatchWebhookTool({
            userId: p.userId, registeredName: call.name, args: call.args,
            conversationId: p.conversationId ?? null
          })
          : await callMCPTool(p.projectRef, p.supabaseAccessToken, call.name, call.args);
        return { call, result: r };
      } catch (error) {
        log(`[reminder] Error executing ${call.name}: ${error}`, 'error');
        return { call, result: `Error: ${error}` };
      }
    }));

    const userParts: Array<Record<string, unknown>> = [];
    for (const { call, result: funcResult } of execResults) {
      functionCalls.push({ name: call.name, args: call.args, result: funcResult });
      const responseParts = await buildFunctionResponseParts(call.name, funcResult, call.id);
      userParts.push(...responseParts);
    }
    const modelParts = result.rawParts && result.rawParts.length > 0
      ? result.rawParts
      : result.functionCalls.map(buildFunctionCallPart);
    conversationContents.push({ role: 'model', parts: modelParts });
    conversationContents.push({ role: 'user', parts: userParts });

    const cont = await callGeminiWithContents(
      p.googleApiKey, conversationContents, p.allTools,
      { streaming: false, maxOutputTokens: 8000, systemInstruction: p.systemPrompt }
    );
    if (cont.usageMetadata) {
      lastUsageMetadata = cont.usageMetadata;
      roundUsages.push(cont.usageMetadata);
      billOrionTokensForRound(p.userId, cont.usageMetadata, lastBilledPromptTokens);
      lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(cont.usageMetadata.promptTokenCount));
    }
    result = cont.functionCalls && cont.functionCalls.length > 0
      ? { functionCalls: cont.functionCalls, rawParts: cont.rawParts }
      : cont.functionCall
      ? { functionCalls: [cont.functionCall], rawParts: cont.rawParts }
      : { text: cont.text, rawParts: cont.rawParts };
  }

  // Force-synthesis fallback
  if (!finalText) {
    log('[reminder] No final text — forcing synthesis with tool_config=NONE', 'warn');
    try {
      const synth = await callGeminiWithContents(
        p.googleApiKey,
        [
          ...conversationContents,
          { role: 'user', parts: [{ text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.' }] }
        ],
        p.allTools,
        { streaming: false, maxOutputTokens: 8192, mode: 'NONE', thinkingLevel: 'low', systemInstruction: p.systemPrompt }
      );
      if (synth.usageMetadata) {
        lastUsageMetadata = synth.usageMetadata;
        roundUsages.push(synth.usageMetadata);
        billOrionTokensForRound(p.userId, synth.usageMetadata, lastBilledPromptTokens);
        lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(synth.usageMetadata.promptTokenCount));
      }
      if (synth.text) finalText = synth.text;
    } catch (synthErr) {
      log(`[reminder] Forced synthesis failed: ${synthErr}`, 'error');
    }
    if (!finalText) {
      finalText = "I attempted to follow up on the reminder but ran into a temporary issue composing my response.";
    }
  }

  return { finalText, functionCalls, firstRoundUsage, lastUsageMetadata, roundUsages };
}
