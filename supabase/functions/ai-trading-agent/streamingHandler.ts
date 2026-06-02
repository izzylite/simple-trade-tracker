/**
 * handleStreamingRequest — SSE streaming chat turn handler.
 *
 * Manages the function-calling loop for a streaming chat turn:
 * initial Gemini call → tool execution → continuation calls → synthesis.
 * Post-loop processing (ID validation, tag-chip injection, persist, done SSE)
 * is delegated to turnPostProcess.ts.
 */

import { log, createServiceClient, corsHeaders } from '../_shared/supabase.ts';
import {
  callMCPTool,
} from '../_shared/orionMcp.ts';
import { classifyProviderError } from './formatters.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import {
  CUSTOM_TOOL_NAMES,
  executeCustomTool,
} from './tools.ts';
import {
  dispatchWebhookTool,
  isWebhookTool,
} from '../_shared/customTools/runtime.ts';
import type { ThinkingLevel } from './agentConfig.ts';
import { finiteOrZero, billOrionTokensForRound } from './billing.ts';
import {
  buildFunctionCallPart,
  getWriteDedupeKey,
  DEDUP_SKIP_RESULT,
} from './functionCallHelpers.ts';
import { redactToolErrorForClient } from './requestHelpers.ts';
import { createSSEStream, sendSSE, buildFunctionResponseParts } from './sseHelpers.ts';
import { callGeminiStreaming } from './geminiStreaming.ts';
import { callGeminiWithContents } from './geminiCalls.ts';
import { turnPostProcess } from './turnPostProcess.ts';

/**
 * Handle streaming request with SSE
 */
export function handleStreamingRequest(
  googleApiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  allTools: GeminiFunctionDeclaration[],
  userId: string,
  _calendarId: string | undefined,
  projectRef: string,
  supabaseAccessToken: string,
  supabaseUrl: string,
  userImages?: Array<{ url: string; mimeType: string }>,
  calendarTags?: string[],
  conversationId?: string,
  thinkingLevel?: ThinkingLevel
): Response {
  const { stream, writer } = createSSEStream();

  (async () => {
    try {
      const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
      const executedWriteKeys = new Set<string>();
      let finalText = '';
      let turnCount = 0;
      const maxTurns = 15;
      const maxRetries = 3;
      let firstRoundUsage: Record<string, unknown> | undefined;
      let lastUsageMetadata: Record<string, unknown> | undefined;
      const roundUsages: Array<Record<string, unknown>> = [];
      let lastBilledPromptTokens = 0;
      const wallClockStartMs = Date.now();
      const WALL_CLOCK_BUDGET_MS = 130_000;

      // Initial streaming call with retry logic for known Gemini empty response bug
      let result = await callGeminiStreaming(
        googleApiKey, systemPrompt, message, conversationHistory,
        allTools, writer, userImages, thinkingLevel
      );
      if (result.usageMetadata) {
        firstRoundUsage = result.usageMetadata;
        lastUsageMetadata = result.usageMetadata;
        roundUsages.push(result.usageMetadata);
        billOrionTokensForRound(userId, result.usageMetadata);
        lastBilledPromptTokens = finiteOrZero(result.usageMetadata.promptTokenCount);
      }

      // RETRY LOGIC: Handle known Gemini empty content bug
      if (result.emptyBug) {
        log('Detected Gemini empty content bug, attempting retry with context enhancement', 'warn');
        const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
        const contextPrefix = lastAssistantMsg
          ? `(Continuing our conversation - you previously said: "${lastAssistantMsg.content.substring(0, 200)}...")\n\n`
          : '';

        for (let retryAttempt = 1; retryAttempt <= maxRetries; retryAttempt++) {
          // The empty-bug retries (backoff sleeps + extra streaming calls) run
          // BEFORE the main loop's own wall-clock guard kicks in. Without this
          // check a slow turn could burn most of the 150s budget here, leaving
          // no time to persist. Stop retrying once the budget is spent — the
          // fallback below still sets finalText so the turn is never silent.
          if (Date.now() - wallClockStartMs > WALL_CLOCK_BUDGET_MS) {
            log('Wall-clock budget exhausted during empty-bug retries — stopping retries', 'warn');
            break;
          }
          const delayMs = Math.pow(2, retryAttempt - 1) * 1000;
          log(`Retry ${retryAttempt}/${maxRetries} after ${delayMs}ms delay`, 'info');
          await new Promise(resolve => setTimeout(resolve, delayMs));

          let clarifiedMessage: string;
          let retryTools = allTools;
          if (retryAttempt === 1) {
            clarifiedMessage = `${contextPrefix}User response: "${message}"\n\nPlease respond to the user's message above.`;
          } else if (retryAttempt === 2) {
            clarifiedMessage = `${contextPrefix}User says: "${message}"\n\nProvide a helpful response.`;
            retryTools = allTools.filter(t =>
              ['execute_sql', 'search_web', 'get_market_data', 'manage_note', 'update_memory'].includes(t.name)
            );
            log(`Retry 2: Using reduced tool set (${retryTools.length} tools)`, 'info');
          } else {
            clarifiedMessage = `The user said: "${message}"\n\nBased on our conversation, please provide a helpful response. You can ask clarifying questions if needed.`;
            retryTools = [];
            log('Retry 3: No tools - forcing text response', 'info');
          }

          result = await callGeminiStreaming(
            googleApiKey, systemPrompt, clarifiedMessage, conversationHistory,
            retryTools, writer, userImages, thinkingLevel
          );
          if (result.usageMetadata) {
            firstRoundUsage = result.usageMetadata;
            lastUsageMetadata = result.usageMetadata;
            roundUsages.push(result.usageMetadata);
            billOrionTokensForRound(userId, result.usageMetadata, lastBilledPromptTokens);
            lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(result.usageMetadata.promptTokenCount));
          }
          if (!result.emptyBug && (result.text || result.functionCall || result.functionCalls)) {
            log(`Retry ${retryAttempt} succeeded`, 'info');
            break;
          }
          log(`Retry ${retryAttempt} also returned empty`, 'warn');
        }

        if (result.emptyBug || (!result.text && !result.functionCall && !result.functionCalls)) {
          log('All retries failed - providing fallback response', 'warn');
          finalText = "I apologize, but I'm having trouble generating a response right now. This appears to be a temporary issue with the AI service. Please try rephrasing your question or try again in a moment.";
          await sendSSE(writer, 'text_chunk', { text: finalText });
        }
      }

      const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      // Function calling loop
      let lastBatchKey = '';
      while (turnCount < maxTurns) {
        turnCount++;
        const elapsedMs = Date.now() - wallClockStartMs;
        if (elapsedMs > WALL_CLOCK_BUDGET_MS) {
          log(`Wall-clock budget exhausted (${elapsedMs}ms) after ${turnCount} turns — breaking loop`, 'warn');
          break;
        }

        if (result.functionCall && !result.functionCalls) {
          result = { ...result, functionCalls: [result.functionCall], functionCall: undefined };
        }
        if (!result.functionCalls?.length) {
          if (result.text) finalText = result.text;
          else if (!finalText) log('Warning: No function calls and no text in response — breaking loop', 'warn');
          break;
        }

        const batchKey = result.functionCalls.map(c => `${c.name}:${JSON.stringify(c.args)}`).sort().join('|');
        if (batchKey === lastBatchKey) {
          log('Detected repeated function batch — breaking loop to prevent infinite loop', 'info');
          break;
        }
        lastBatchKey = batchKey;

        const searchWebExecuted = functionCalls.filter(fc => fc.name === 'search_web').length;
        if (searchWebExecuted >= 3 && result.functionCalls.some(c => c.name === 'search_web')) {
          log('search_web rate limit reached (3 calls per turn) — breaking loop', 'info');
          break;
        }

        log(`Executing ${result.functionCalls.length} function(s)`, 'info');
        for (const call of result.functionCalls) {
          await sendSSE(writer, 'tool_call', { name: call.name, args: call.args });
        }

        const supabaseClient = createServiceClient();
        const executionPromises = result.functionCalls.map(async (call) => {
          try {
            const dedupeKey = getWriteDedupeKey(call.name, call.args);
            if (dedupeKey && executedWriteKeys.has(dedupeKey)) {
              log(`Dedup: skipping duplicate write ${call.name}`, 'warn');
              return { call, result: DEDUP_SKIP_RESULT, success: true };
            }
            if (dedupeKey) executedWriteKeys.add(dedupeKey);

            const toolResult = CUSTOM_TOOL_NAMES.has(call.name)
              ? await executeCustomTool(call.name, call.args, {
                userId, calendarId: _calendarId, conversationId
              }, supabaseClient)
              : isWebhookTool(call.name)
              ? await dispatchWebhookTool({
                userId, registeredName: call.name, args: call.args,
                conversationId: conversationId ?? null,
              })
              : await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
            return { call, result: toolResult, success: true };
          } catch (error) {
            log(`Error executing ${call.name}: ${error}`, 'error');
            return { call, result: `Error: ${error}`, success: false };
          }
        });

        const results = await Promise.all(executionPromises);
        const userParts: Array<Record<string, unknown>> = [];
        for (const { call, result: funcResult } of results) {
          await sendSSE(writer, 'tool_result', {
            name: call.name,
            result: redactToolErrorForClient(call.name, funcResult)
          });
          functionCalls.push({ name: call.name, args: call.args, result: funcResult });
          const responseParts = await buildFunctionResponseParts(call.name, funcResult, call.id);
          userParts.push(...responseParts);
        }

        const modelParts = result.rawParts && result.rawParts.length > 0
          ? result.rawParts
          : result.functionCalls!.map(buildFunctionCallPart);
        conversationContents.push({ role: 'model', parts: modelParts });
        conversationContents.push({ role: 'user', parts: userParts });

        const {
          text: newText,
          functionCall: newFunctionCall,
          functionCalls: newFunctionCalls,
          rawParts: newRawParts,
          usageMetadata: newUsage,
        } = await callGeminiWithContents(
          googleApiKey, conversationContents, allTools,
          { streaming: true, writer, maxOutputTokens: 8000, systemInstruction: systemPrompt, thinkingLevel }
        );
        if (newUsage) {
          lastUsageMetadata = newUsage;
          roundUsages.push(newUsage);
          billOrionTokensForRound(userId, newUsage, lastBilledPromptTokens);
          lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(newUsage.promptTokenCount));
        }

        const hasNewCalls = (newFunctionCalls?.length ?? 0) > 0 || !!newFunctionCall;
        if (!hasNewCalls && newText) {
          finalText = newText;
        } else if (hasNewCalls && newText) {
          await sendSSE(writer, 'text_reset', {});
          await sendSSE(writer, 'thought_chunk', { text: newText });
        }

        result = newFunctionCalls && newFunctionCalls.length > 0
          ? { functionCalls: newFunctionCalls, text: newText || undefined, rawParts: newRawParts }
          : newFunctionCall
          ? { functionCalls: [newFunctionCall], text: newText || undefined, rawParts: newRawParts }
          : { text: newText, rawParts: newRawParts };
      }

      if (!finalText && result.text) finalText = result.text;

      // Force synthesis if no text after loop
      if (!finalText) {
        log(`Warning: Completed in ${turnCount} turns with ${functionCalls.length} function calls but NO TEXT — forcing synthesis with tool_config=NONE`, 'warn');
        try {
          const synthesisResult = await callGeminiWithContents(
            googleApiKey,
            [
              ...conversationContents,
              { role: 'user', parts: [{ text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.' }] }
            ],
            allTools,
            { streaming: false, maxOutputTokens: 8192, mode: 'NONE', thinkingLevel: 'low', systemInstruction: systemPrompt }
          );
          if (synthesisResult.usageMetadata) {
            lastUsageMetadata = synthesisResult.usageMetadata;
            roundUsages.push(synthesisResult.usageMetadata);
            billOrionTokensForRound(userId, synthesisResult.usageMetadata, lastBilledPromptTokens);
            lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(synthesisResult.usageMetadata.promptTokenCount));
          }
          if (synthesisResult.text) {
            finalText = synthesisResult.text;
            await sendSSE(writer, 'text_chunk', { text: finalText });
            log(`Forced synthesis succeeded (${finalText.length} chars)`, 'info');
          } else if (synthesisResult.finishReason === 'MAX_TOKENS') {
            log('Forced synthesis hit MAX_TOKENS with empty text — tool-result history too large to summarise in one turn', 'warn');
          }
        } catch (synthErr) {
          log(`Forced synthesis failed: ${synthErr}`, 'error');
        }
        if (!finalText) {
          finalText = "I gathered some data but ran into a temporary issue composing my response. Please try again.";
          await sendSSE(writer, 'text_chunk', { text: finalText });
        }
      } else {
        log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');
      }

      // Delegate ID validation, tag-chip, persist, citations, embedded data, done SSE
      await turnPostProcess({
        googleApiKey,
        systemPrompt,
        supabaseUrl,
        userId,
        conversationId,
        calendarTags,
        thinkingLevel,
        allTools,
        conversationContents,
        writer,
        finalText,
        functionCalls,
        firstRoundUsage,
        lastUsageMetadata,
        roundUsages,
        lastBilledPromptTokens,
        wallClockStartMs,
        turnCount,
      });

    } catch (error) {
      log(`Error in streaming handler: ${error}`, 'error');
      const rawMessage = error instanceof Error ? error.message : 'Unknown error';
      const classified = classifyProviderError(rawMessage);
      await sendSSE(writer, 'error', {
        error: classified.userMessage,
        errorType: classified.errorType,
        retryAfter: classified.retryAfterSeconds,
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
