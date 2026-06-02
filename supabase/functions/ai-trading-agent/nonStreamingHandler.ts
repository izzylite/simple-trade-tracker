/**
 * handleNonStreamingRequest — JSON (non-SSE) chat turn handler.
 *
 * Runs the same function-calling loop as the streaming path but returns a
 * single JSON response once the loop completes. Includes ID validation,
 * embedded-data fetch, security isolation check, and background persist.
 *
 * Note: images are not supported on this path — use streaming mode for
 * image analysis.
 */

import { log, createServiceClient, corsHeaders } from '../_shared/supabase.ts';
import {
  callMCPTool,
} from '../_shared/orionMcp.ts';
import { formatErrorResponse, formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { ToolCall } from './types.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import {
  CUSTOM_TOOL_NAMES,
  executeCustomTool,
} from './tools.ts';
import {
  dispatchWebhookTool,
  isWebhookTool,
} from '../_shared/customTools/runtime.ts';
import { fetchEmbeddedData, type EmbeddedData } from './embedDataFetcher.ts';
import {
  appendAssistantMessage,
  buildGate,
} from './conversationStore.ts';
import { maybeUpdateEmbedding } from './tools/recall-conversations.ts';
import { rehostChartUrlsInText } from './imageRehost.ts';
import { validateReferenceIds, hasReferenceTags } from './idValidator.ts';
import { MODEL } from './agentConfig.ts';
import { finiteOrZero, billOrionTokensForRound, logTurnAudit } from './billing.ts';
import {
  buildFunctionCallPart,
  getWriteDedupeKey,
  DEDUP_SKIP_RESULT,
} from './functionCallHelpers.ts';
import { scrubWebhookResults, validateUserDataIsolation } from './requestHelpers.ts';
import { buildFunctionResponseParts } from './sseHelpers.ts';
import { callGemini, callGeminiWithContents } from './geminiCalls.ts';

export interface NonStreamingParams {
  googleApiKey: string;
  systemPrompt: string;
  messageWithReminder: string;
  priorHistory: Array<{ role: string; content: string }>;
  allTools: GeminiFunctionDeclaration[];
  userId: string;
  calendarId: string | undefined;
  conversationId: string;
  supabaseUrl: string;
  projectRef: string;
  supabaseAccessToken: string;
  serviceClientForPersistence: ReturnType<typeof createServiceClient>;
}

export async function handleNonStreamingRequest(p: NonStreamingParams): Promise<Response> {
  let result = await callGemini(
    p.googleApiKey, p.systemPrompt, p.messageWithReminder, p.priorHistory, p.allTools
  );

  const initialUsage = result.usageMetadata;
  const firstRoundUsage: Record<string, unknown> | undefined = result.usageMetadata;
  let lastUsageMetadata: Record<string, unknown> | undefined = result.usageMetadata;
  const roundUsages: Array<Record<string, unknown>> = [];
  let lastBilledPromptTokensNS = 0;
  if (result.usageMetadata) {
    roundUsages.push(result.usageMetadata);
    billOrionTokensForRound(p.userId, result.usageMetadata);
    lastBilledPromptTokensNS = finiteOrZero(result.usageMetadata.promptTokenCount);
  }

  const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
  const executedWriteKeys = new Set<string>();
  let finalText = '';
  let turnCount = 0;
  const maxTurns = 15;
  const nonStreamStartMs = Date.now();
  const NON_STREAM_BUDGET_MS = 130_000;
  let lastBatchKey = '';

  const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    ...p.priorHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: p.messageWithReminder }] }
  ];

  while (turnCount < maxTurns) {
    turnCount++;
    const elapsed = Date.now() - nonStreamStartMs;
    if (elapsed > NON_STREAM_BUDGET_MS) {
      log(`[non-streaming] Wall-clock budget exhausted (${elapsed}ms) after ${turnCount} turns — breaking loop`, 'warn');
      break;
    }

    if (result.functionCall && !result.functionCalls) {
      result = { ...result, functionCalls: [result.functionCall], functionCall: undefined };
    }
    if (!result.functionCalls?.length) {
      if (result.text) finalText = result.text;
      break;
    }

    // Repeated-batch guard: same tool batch twice in a row = loop, break early.
    const batchKey = result.functionCalls.map(c => `${c.name}:${JSON.stringify(c.args)}`).sort().join('|');
    if (batchKey === lastBatchKey) {
      log('[non-streaming] Repeated function batch detected — breaking loop', 'warn');
      break;
    }
    lastBatchKey = batchKey;

    // search_web rate cap: mirrors the streaming handler's 3-call-per-turn limit.
    const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
    if (searchWebCount >= 3 && result.functionCalls.some(c => c.name === 'search_web')) {
      log('[non-streaming] search_web rate limit (3/turn) reached — breaking loop', 'info');
      break;
    }

    const supabaseClient = createServiceClient();
    log(`Executing ${result.functionCalls.length} function(s)`, 'info');
    const execResults = await Promise.all(result.functionCalls.map(async (call) => {
      try {
        const dedupeKey = getWriteDedupeKey(call.name, call.args);
        if (dedupeKey && executedWriteKeys.has(dedupeKey)) {
          log(`[non-streaming] Dedup: skipping duplicate write ${call.name}`, 'warn');
          return { call, result: DEDUP_SKIP_RESULT };
        }
        if (dedupeKey) executedWriteKeys.add(dedupeKey);

        const r = CUSTOM_TOOL_NAMES.has(call.name)
          ? await executeCustomTool(call.name, call.args, {
            userId: p.userId, calendarId: p.calendarId, conversationId: p.conversationId
          }, supabaseClient)
          : isWebhookTool(call.name)
          ? await dispatchWebhookTool({
            userId: p.userId, registeredName: call.name, args: call.args,
            conversationId: p.conversationId ?? null
          })
          : await callMCPTool(p.projectRef, p.supabaseAccessToken, call.name, call.args);
        return { call, result: r };
      } catch (error) {
        log(`Error executing ${call.name}: ${error}`, 'error');
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

    const {
      text: newText,
      functionCall: newFunctionCall,
      functionCalls: newFunctionCalls,
      rawParts: newRawParts,
      usageMetadata: newUsage,
    } = await callGeminiWithContents(
      p.googleApiKey, conversationContents, p.allTools,
      { streaming: false, maxOutputTokens: 8000, systemInstruction: p.systemPrompt }
    );
    if (newUsage) {
      lastUsageMetadata = newUsage;
      roundUsages.push(newUsage);
      billOrionTokensForRound(p.userId, newUsage, lastBilledPromptTokensNS);
      lastBilledPromptTokensNS = Math.max(lastBilledPromptTokensNS, finiteOrZero(newUsage.promptTokenCount));
    }
    result = newFunctionCalls && newFunctionCalls.length > 0
      ? { functionCalls: newFunctionCalls, rawParts: newRawParts }
      : newFunctionCall
      ? { functionCalls: [newFunctionCall], rawParts: newRawParts }
      : { text: newText, rawParts: newRawParts };
  }

  log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');

  // Force synthesis if no text after loop
  if (!finalText) {
    log('No final text generated — forcing synthesis with tool_config=NONE', 'warn');
    try {
      const synthesisResult = await callGeminiWithContents(
        p.googleApiKey,
        [
          ...conversationContents,
          { role: 'user', parts: [{ text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.' }] }
        ],
        p.allTools,
        { streaming: false, maxOutputTokens: 8192, mode: 'NONE', thinkingLevel: 'low', systemInstruction: p.systemPrompt }
      );
      if (synthesisResult.usageMetadata) {
        lastUsageMetadata = synthesisResult.usageMetadata;
        roundUsages.push(synthesisResult.usageMetadata);
        billOrionTokensForRound(p.userId, synthesisResult.usageMetadata, lastBilledPromptTokensNS);
        lastBilledPromptTokensNS = Math.max(lastBilledPromptTokensNS, finiteOrZero(synthesisResult.usageMetadata.promptTokenCount));
      }
      if (synthesisResult.text) {
        finalText = synthesisResult.text;
        log(`Forced synthesis succeeded (${finalText.length} chars)`, 'info');
      }
    } catch (synthErr) {
      log(`Forced synthesis failed: ${synthErr}`, 'error');
    }
    if (!finalText) {
      finalText = "I gathered some data but ran into a temporary issue composing my response. Please try again.";
    }
  }

  // ID Validation Feedback Loop (Non-streaming)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');

  let cleanedFinalText = finalText || '';
  const maxValidationRetries = 2;
  let validationRetryCount = 0;

  while (hasReferenceTags(cleanedFinalText) && validationRetryCount < maxValidationRetries) {
    log(`Validating reference IDs in response (attempt ${validationRetryCount + 1}/${maxValidationRetries})...`, 'info');
    const idValidationResult = await validateReferenceIds(
      cleanedFinalText, p.supabaseUrl, serviceKey, p.userId
    );
    if (idValidationResult.isValid) {
      log('ID Validation: All reference IDs are valid', 'info');
      break;
    }

    validationRetryCount++;
    log(`ID Validation: Found ${idValidationResult.invalidCount} invalid refs`, 'warn');

    const idValidationOverBudget = Date.now() - nonStreamStartMs > NON_STREAM_BUDGET_MS;
    if (validationRetryCount >= maxValidationRetries || idValidationOverBudget) {
      log(idValidationOverBudget
        ? 'Wall-clock budget exhausted during ID validation - stripping invalid refs'
        : 'Max validation retries reached - proceeding with partial response', 'warn');
      for (const id of idValidationResult.invalidIds.trades) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<trade-ref\\s+id="${id}"\\s*/?>(</trade-ref>)?`, 'gi'), '');
      }
      for (const id of idValidationResult.invalidIds.events) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<event-ref\\s+id="${id}"\\s*/?>(</event-ref>)?`, 'gi'), '');
      }
      for (const id of idValidationResult.invalidIds.notes) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<note-ref\\s+id="${id}"\\s*/?>(</note-ref>)?`, 'gi'), '');
      }
      break;
    }

    if (idValidationResult.correctionPrompt) {
      log('Sending correction prompt to AI for ID fix (non-streaming)...', 'info');
      conversationContents.push({ role: 'model', parts: [{ text: cleanedFinalText }] });
      conversationContents.push({ role: 'user', parts: [{ text: idValidationResult.correctionPrompt }] });
      let correctedText = '';
      try {
        const corrResult = await callGeminiWithContents(
          p.googleApiKey, conversationContents, p.allTools,
          { streaming: false, maxOutputTokens: 8000, systemInstruction: p.systemPrompt }
        );
        if (corrResult.usageMetadata) {
          lastUsageMetadata = corrResult.usageMetadata;
          roundUsages.push(corrResult.usageMetadata);
          billOrionTokensForRound(p.userId, corrResult.usageMetadata, lastBilledPromptTokensNS);
          lastBilledPromptTokensNS = Math.max(lastBilledPromptTokensNS, finiteOrZero(corrResult.usageMetadata.promptTokenCount));
        }
        correctedText = corrResult.text;
      } catch (error) {
        log(`Gemini correction call failed: ${error}`, 'error');
        break;
      }
      cleanedFinalText = correctedText;
      finalText = correctedText;
      log(`Received corrected response (${correctedText.length} chars)`, 'info');
    }
  }

  // Format response
  const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
    cleanedFinalText, functionCalls as ToolCall[]
  );

  log('Fetching embedded data for inline references', 'info');
  const embeddedData: EmbeddedData = await fetchEmbeddedData(
    cleanedFinalText, p.supabaseUrl, serviceKey, p.userId
  );
  const embeddedTrades = Object.fromEntries(embeddedData.trades);
  const embeddedEvents = Object.fromEntries(embeddedData.events);
  const embeddedNotes = Object.fromEntries(embeddedData.notes);
  log(`Fetched ${embeddedData.trades.size} embedded trades, ${embeddedData.events.size} events, ${embeddedData.notes.size} notes`, 'info');

  const nextTurnEstimate =
    finiteOrZero(firstRoundUsage?.promptTokenCount) +
    finiteOrZero(lastUsageMetadata?.candidatesTokenCount);
  const gate = p.conversationId ? buildGate(nextTurnEstimate) : undefined;

  const formattedResponse = {
    success: !!cleanedFinalText,
    message: cleanedFinalText,
    messageHtml,
    gate,
    citations,
    embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
    embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
    embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined,
    metadata: {
      functionCalls: scrubWebhookResults(functionCalls),
      model: MODEL,
      timestamp: new Date().toISOString(),
      usage: initialUsage,
    }
  };

  // Security validation
  const isolationCheck = validateUserDataIsolation(formattedResponse, p.userId);
  if (!isolationCheck.valid) {
    log(`Security violation: ${isolationCheck.reason}`, 'error');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Security validation failed',
        metadata: { functionCalls: [], model: MODEL, timestamp: new Date().toISOString() },
        error: 'Data leak detected',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  log('Response validated - security check passed', 'info');

  logTurnAudit(p.conversationId, functionCalls, firstRoundUsage, lastUsageMetadata, roundUsages);

  // Persist the assistant reply
  const assistantRecord = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: cleanedFinalText,
    timestamp: new Date().toISOString(),
    status: 'received',
    toolCalls: functionCalls.map(fc => ({ name: fc.name, label: fc.name })),
  };
  const persistTask = (async () => {
    const rehostCtx = { userId: p.userId, conversationId: p.conversationId, messageId: assistantRecord.id };
    const rehostedContent = await rehostChartUrlsInText(
      p.serviceClientForPersistence, rehostCtx, assistantRecord.content,
    );
    const assistantPersist = await appendAssistantMessage(p.serviceClientForPersistence, {
      conversationId: p.conversationId,
      userId: p.userId,
      assistantMessage: { ...assistantRecord, content: rehostedContent },
      promptTokenCount: nextTurnEstimate > 0 ? nextTurnEstimate : undefined,
    });
    if (!assistantPersist.ok && !assistantPersist.deleted) {
      log('Assistant message persist failed (non-streaming)', 'error', {
        conversationId: p.conversationId, error: assistantPersist.error,
      });
    }
    if (assistantPersist.ok && !assistantPersist.deleted) {
      await maybeUpdateEmbedding(p.serviceClientForPersistence, p.conversationId, p.userId);
    }
  })();
  const er = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(persistTask);
  } else {
    await persistTask;
  }

  return new Response(JSON.stringify(formattedResponse), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
