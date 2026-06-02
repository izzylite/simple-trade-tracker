/**
 * turnPostProcess — post-loop processing shared by the streaming chat handler.
 *
 * After the function-calling loop produces `finalText`:
 *   1. ID validation feedback loop (streaming variant — can call Gemini for
 *      corrections, streaming results to the writer)
 *   2. Calendar tag-chip injection
 *   3. HTML formatting + citation extraction
 *   4. Embedded data fetch + SSE emit
 *   5. Assistant-message persist (via EdgeRuntime.waitUntil)
 *   6. `done` SSE event
 *
 * Returns { cleanedFinalText, messageHtml, citations, nextTurnEstimate } so
 * the caller can still use those values if needed.
 */

import { log, createServiceClient } from '../_shared/supabase.ts';
import { formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { ToolCall } from './types.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import { fetchEmbeddedData, type EmbeddedData } from './embedDataFetcher.ts';
import {
  appendAssistantMessage,
  buildGate,
  type ConversationGate,
} from './conversationStore.ts';
import { maybeUpdateEmbedding } from './tools/recall-conversations.ts';
import { rehostChartUrlsInText } from './imageRehost.ts';
import { validateReferenceIds, hasReferenceTags } from './idValidator.ts';
import { MODEL } from './agentConfig.ts';
import type { ThinkingLevel } from './agentConfig.ts';
import { finiteOrZero, billOrionTokensForRound, logTurnAudit } from './billing.ts';
import { scrubWebhookResults } from './requestHelpers.ts';
import { sendSSE } from './sseHelpers.ts';
import { callGeminiWithContents } from './geminiCalls.ts';

export interface TurnPostProcessParams {
  googleApiKey: string;
  systemPrompt: string;
  supabaseUrl: string;
  userId: string;
  conversationId: string | undefined;
  calendarTags: string[] | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  allTools: GeminiFunctionDeclaration[];
  conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  writer: WritableStreamDefaultWriter;
  finalText: string;
  functionCalls: Array<{ name: string; args: unknown; result: string }>;
  firstRoundUsage: Record<string, unknown> | undefined;
  lastUsageMetadata: Record<string, unknown> | undefined;
  roundUsages: Array<Record<string, unknown>>;
  lastBilledPromptTokens: number;
  wallClockStartMs: number;
  turnCount: number;
}

const WALL_CLOCK_BUDGET_MS = 130_000;

export async function turnPostProcess(p: TurnPostProcessParams): Promise<void> {
  let {
    finalText,
    lastUsageMetadata,
    roundUsages,
    lastBilledPromptTokens,
  } = p;

  // ---- ID Validation Feedback Loop ----
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let cleanedFinalText = finalText || '';
  const maxValidationRetries = 2;
  let validationRetryCount = 0;

  while (serviceKey && hasReferenceTags(cleanedFinalText) && validationRetryCount < maxValidationRetries) {
    log(`Validating reference IDs in response (attempt ${validationRetryCount + 1}/${maxValidationRetries})...`, 'info');
    const validationResult = await validateReferenceIds(
      cleanedFinalText,
      p.supabaseUrl,
      serviceKey,
      p.userId
    );

    if (validationResult.isValid) {
      log('ID Validation: All reference IDs are valid', 'info');
      break;
    }

    validationRetryCount++;
    log(`ID Validation: Found ${validationResult.invalidCount} invalid refs (trades: ${validationResult.invalidIds.trades.length}, events: ${validationResult.invalidIds.events.length}, notes: ${validationResult.invalidIds.notes.length})`, 'warn');

    const validationOverBudget = Date.now() - p.wallClockStartMs > WALL_CLOCK_BUDGET_MS;
    if (validationRetryCount >= maxValidationRetries || validationOverBudget) {
      log(validationOverBudget
        ? 'Wall-clock budget exhausted during ID validation - stripping invalid refs instead of another correction call'
        : 'Max validation retries reached - proceeding with partial response', 'warn');
      for (const id of validationResult.invalidIds.trades) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<trade-ref\\s+id="${id}"\\s*/?>(</trade-ref>)?`, 'gi'), '');
      }
      for (const id of validationResult.invalidIds.events) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<event-ref\\s+id="${id}"\\s*/?>(</event-ref>)?`, 'gi'), '');
      }
      for (const id of validationResult.invalidIds.notes) {
        cleanedFinalText = cleanedFinalText.replace(new RegExp(`<note-ref\\s+id="${id}"\\s*/?>(</note-ref>)?`, 'gi'), '');
      }
      break;
    }

    if (validationResult.correctionPrompt) {
      log('Sending correction prompt to AI for ID fix...', 'info');
      p.conversationContents.push({ role: 'model', parts: [{ text: cleanedFinalText }] });
      p.conversationContents.push({ role: 'user', parts: [{ text: validationResult.correctionPrompt }] });
      await sendSSE(p.writer, 'text_chunk', { text: '\n\n[Correcting response...]\n\n' });

      let correctedText = '';
      try {
        const corrResult = await callGeminiWithContents(
          p.googleApiKey,
          p.conversationContents,
          p.allTools,
          { streaming: true, writer: p.writer, maxOutputTokens: 8000, systemInstruction: p.systemPrompt, thinkingLevel: p.thinkingLevel }
        );
        if (corrResult.usageMetadata) {
          lastUsageMetadata = corrResult.usageMetadata;
          roundUsages.push(corrResult.usageMetadata);
          billOrionTokensForRound(p.userId, corrResult.usageMetadata, lastBilledPromptTokens);
          lastBilledPromptTokens = Math.max(lastBilledPromptTokens, finiteOrZero(corrResult.usageMetadata.promptTokenCount));
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

  // ---- Calendar tag-chip injection ----
  if (p.calendarTags && p.calendarTags.length > 0) {
    const sortedTags = [...p.calendarTags].sort((a, b) => b.length - a.length);
    const escapedTags = sortedTags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const injectPattern = new RegExp(
      `(<tag-chip>[\\s\\S]*?<\\/tag-chip>|<[^>]+>)|(${escapedTags.join('|')})`,
      'g'
    );
    cleanedFinalText = cleanedFinalText.replace(
      injectPattern,
      (_match, htmlPart, tagName) => htmlPart !== undefined ? _match : `<tag-chip>${tagName}</tag-chip>`
    );
    log(`Tag-chip injection complete for ${sortedTags.length} calendar tags`, 'info');
  }

  // ---- Format response with HTML and citations ----
  const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
    cleanedFinalText,
    p.functionCalls as ToolCall[]
  );

  if (citations.length > 0) {
    await sendSSE(p.writer, 'citation', { citations });
  }

  // ---- Fetch embedded data ----
  if (serviceKey) {
    const embeddedData: EmbeddedData = await fetchEmbeddedData(
      cleanedFinalText,
      p.supabaseUrl,
      serviceKey,
      p.userId
    );
    const embeddedTrades = Object.fromEntries(embeddedData.trades);
    const embeddedEvents = Object.fromEntries(embeddedData.events);
    const embeddedNotes = Object.fromEntries(embeddedData.notes);

    if (Object.keys(embeddedTrades).length > 0 || Object.keys(embeddedEvents).length > 0 || Object.keys(embeddedNotes).length > 0) {
      await sendSSE(p.writer, 'embedded_data', {
        embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
        embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
        embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined
      });
    }
  }

  // ---- Persist the assistant reply at turn end ----
  let nextTurnEstimate = 0;
  if (p.conversationId) {
    const assistantRecord = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: cleanedFinalText,
      timestamp: new Date().toISOString(),
      status: 'received',
      messageHtml: messageHtml ?? undefined,
      citations: citations ?? undefined,
      toolCalls: p.functionCalls && p.functionCalls.length > 0
        ? p.functionCalls.map(fc => ({ name: fc.name, label: fc.name }))
        : undefined,
    };
    nextTurnEstimate =
      finiteOrZero(p.firstRoundUsage?.promptTokenCount) +
      finiteOrZero(lastUsageMetadata?.candidatesTokenCount);
    const persistTask = (async () => {
      const persistClient = createServiceClient();
      const rehostCtx = {
        userId: p.userId,
        conversationId: p.conversationId!,
        messageId: assistantRecord.id,
      };
      const [rehostedContent, rehostedHtml] = await Promise.all([
        rehostChartUrlsInText(persistClient, rehostCtx, assistantRecord.content),
        rehostChartUrlsInText(persistClient, rehostCtx, assistantRecord.messageHtml),
      ]);
      const assistantPersist = await appendAssistantMessage(persistClient, {
        conversationId: p.conversationId!,
        userId: p.userId,
        assistantMessage: {
          ...assistantRecord,
          content: rehostedContent,
          messageHtml: rehostedHtml || undefined,
        },
        promptTokenCount: nextTurnEstimate > 0 ? nextTurnEstimate : undefined,
      });
      if (!assistantPersist.ok && !assistantPersist.deleted) {
        log('Assistant message persist failed (streaming)', 'error', {
          conversationId: p.conversationId,
          error: assistantPersist.error,
        });
      }
      if (assistantPersist.ok && !assistantPersist.deleted) {
        await maybeUpdateEmbedding(persistClient, p.conversationId!, p.userId);
      }
    })();
    const er = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(persistTask);
    } else {
      await persistTask;
    }
  }

  // ---- Per-turn token-cost audit ----
  logTurnAudit(p.conversationId, p.functionCalls, p.firstRoundUsage, lastUsageMetadata, roundUsages);

  // ---- Send done event ----
  const gateForDone: ConversationGate | undefined = p.conversationId
    ? buildGate(nextTurnEstimate)
    : undefined;
  await sendSSE(p.writer, 'done', {
    success: !!cleanedFinalText,
    messageHtml,
    gate: gateForDone,
    metadata: {
      functionCalls: scrubWebhookResults(p.functionCalls),
      model: MODEL,
      timestamp: new Date().toISOString(),
      turnCount: p.turnCount,
    }
  });
}
