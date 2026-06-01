/**
 * AI Trading Agent - Pure HTTP Implementation
 * Direct HTTP calls to both Gemini API and Supabase MCP (no SDKs)
 *
 * Entry point only — all business logic lives in focused sub-modules:
 *   agentConfig.ts          — env-driven model/thinking/media config
 *   geminiHelpers.ts        — URL builder, request-shape helpers, preflight
 *   billing.ts              — token billing + per-turn audit logging
 *   functionCallHelpers.ts  — parsing, dedup, part builders
 *   sseHelpers.ts           — SSE stream helpers, event helpers, image injection
 *   requestHelpers.ts       — tool-result redaction, trade pre-fetch, isolation check
 *   geminiCalls.ts          — callGemini + callGeminiWithContents
 *   geminiStreaming.ts      — callGeminiStreaming
 *   turnPostProcess.ts      — ID validation, tag-chip, persist, done SSE (streaming)
 *   streamingHandler.ts     — handleStreamingRequest (SSE chat loop)
 *   nonStreamingHandler.ts  — handleNonStreamingRequest (JSON chat loop)
 *   reminderHandler.ts      — handleReminderRequest (mode=reminder)
 */

import { corsHeaders, handleCors, log, createServiceClient, successResponse } from '../_shared/supabase.ts';
import {
  getCachedMCPTools,
} from '../_shared/orionMcp.ts';
import { fetchMemory } from '../_shared/memory/index.ts';
import { fetchGuidelineReminder } from '../_shared/orionGuideline.ts';
import { GUIDELINE_TAG } from '../_shared/noteTags.ts';
import { formatErrorResponse } from './formatters.ts';
import type { AgentRequest } from './types.ts';
import { getAllCustomTools } from './tools.ts';
import { loadUserWebhookTools } from '../_shared/customTools/runtime.ts';
import { appendUserMessage, MAX_USER_MESSAGE_BYTES } from './conversationStore.ts';
import { handleBackfillEmbeddings } from './tools/recall-conversations.ts';
import { buildSecureSystemPrompt, buildTemporalContext } from "./systemPrompt.ts";
import { checkOrionAccess } from '../_shared/tierEnforcement.ts';
import { MODEL, resolveChatThinkingLevel } from './agentConfig.ts';
import { fetchFocusedTrade, fetchTradeImages } from './requestHelpers.ts';
import { frameBareSlashCommand } from './sseHelpers.ts';
import { handleStreamingRequest } from './streamingHandler.ts';
import { handleNonStreamingRequest } from './nonStreamingHandler.ts';
import { handleReminderRequest } from './reminderHandler.ts';

/**
 * Main edge function handler
 */
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Handle warmup pings (no processing, just keep instance alive)
  if (req.headers.get('X-Warmup') === 'true') {
    log('Received warmup ping - keeping function warm', 'info');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Function warmed up',
        timestamp: new Date().toISOString(),
        cacheStatus: 'warm',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body: AgentRequest = await req.json();

    // mode='reminder' branch — atomically claim + run + append + mark fired.
    if (body.mode === 'reminder') {
      return await handleReminderRequest(req, body);
    }

    // mode='backfill_embeddings' branch — service-role only, idempotent.
    if (body.mode === 'backfill_embeddings') {
      return await handleBackfillEmbeddings(req);
    }

    // NOTE: `conversationHistory` is intentionally NOT destructured from the
    // body. The server now reads prior history from the DB via the
    // appendUserMessage response below.
    const { message, userId, calendarId, focusedTradeId, calendarContext, images } = body;
    const conversationId = body.conversationId;
    const chatThinkingLevel = resolveChatThinkingLevel(body.thinkingLevel);

    if (Array.isArray(body.conversationHistory) && body.conversationHistory.length > 0) {
      log(
        `Ignoring body.conversationHistory (${body.conversationHistory.length} msgs) — server reads from DB now`,
        'warn',
      );
    }

    const hasContent = message || (images && images.length > 0);
    if (!hasContent || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: message or images, and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tier + budget gate
    const tierGate = await checkOrionAccess(userId);
    if (!tierGate.allowed) {
      log('Orion request denied by tier gate', 'info', {
        userId, tier: tierGate.tier, reason: tierGate.reason,
      });
      return successResponse(
        {
          blocked: true,
          reason: tierGate.reason,
          tier: tierGate.tier,
          reset_at: tierGate.resetAt ?? null,
          tokens_consumed: tierGate.tokensConsumed ?? null,
          tokens_budget: tierGate.tokensBudget ?? null,
        },
        'Orion access blocked'
      );
    }

    const MAX_IMAGES_PER_REQUEST = 4;
    if (images && images.length > MAX_IMAGES_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Too many images. Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per message.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: conversationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Per-message byte cap
    const messageBytes = typeof message === 'string'
      ? new TextEncoder().encode(message).byteLength
      : 0;
    if (messageBytes > MAX_USER_MESSAGE_BYTES) {
      log(`Rejecting oversized user message: ${messageBytes} bytes > ${MAX_USER_MESSAGE_BYTES}`, 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          code: 'message_too_large',
          error: `Message is too long (${Math.round(messageBytes / 1024)}KB). ` +
            `Maximum is ${Math.round(MAX_USER_MESSAGE_BYTES / 1024)}KB per message. ` +
            `Try splitting it into smaller chunks.`,
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClientForPersistence = createServiceClient();
    const userMessageRecord = {
      id: body.userMessageId ?? crypto.randomUUID(),
      role: 'user' as const,
      content: message ?? '',
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    const persistResult = await appendUserMessage(serviceClientForPersistence, {
      conversationId,
      userId,
      calendarId: calendarId ?? null,
      tradeId: focusedTradeId ?? null,
      userMessage: userMessageRecord,
      titleFallback: body.titleHint ?? (message ?? 'New conversation').slice(0, 60),
      editingMessageId: body.editingMessageId,
    });

    if (!persistResult.ok) {
      if (persistResult.code === 'token_budget_exceeded') {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'token_budget_exceeded',
            error: 'This conversation has used its context budget. Start a new chat to continue.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (persistResult.code === 'forbidden') {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: persistResult.message ?? 'Failed to persist message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priorHistory = persistResult.priorHistory;
    log(`Server-fetched history: ${priorHistory.length} prior messages`, 'info');

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveMessage = message || (images && images.length > 0
      ? `Please analyze ${images.length === 1 ? 'this image' : `these ${images.length} images`}.`
      : '');

    log(`Processing request for user ${userId}`, 'info');
    log(`Input message (first 200 chars): "${effectiveMessage.substring(0, 200)}"`, 'info');
    log(`Message length: ${effectiveMessage.length}, History: ${priorHistory.length}, Images: ${images?.length || 0}`, 'info');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const supabaseAccessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');
    if (!projectRef || !supabaseAccessToken) {
      throw new Error('Supabase configuration missing');
    }

    log(`Getting MCP tools for project ${projectRef}`, 'info');
    const [geminiMcpTools, preloadedMemory, guidelineReminder] = await Promise.all([
      getCachedMCPTools(projectRef, supabaseAccessToken, ['execute_sql', 'list_tables']),
      fetchMemory(userId, calendarId),
      fetchGuidelineReminder(userId, calendarId),
    ]);
    log(`Using ${geminiMcpTools.length} MCP tools (filtered)`, 'info');

    const customTools = getAllCustomTools();
    const userWebhookTools = await loadUserWebhookTools(userId);
    const allTools = [...geminiMcpTools, ...customTools, ...userWebhookTools];

    const preloadedTrade = focusedTradeId
      ? await fetchFocusedTrade(focusedTradeId, userId)
      : null;
    const tradeImages = preloadedTrade ? await fetchTradeImages(preloadedTrade) : [];
    const allImages = [...tradeImages, ...(images || [])].slice(0, 4);
    if (tradeImages.length > 0) {
      log(`Injecting ${tradeImages.length} trade chart images into context`, 'info');
    }

    const systemPrompt = buildSecureSystemPrompt(
      userId, calendarId, calendarContext, focusedTradeId, preloadedMemory, preloadedTrade
    );

    const temporalPrefix = `[Current time — ${buildTemporalContext()}]\n\n`;
    const guidelineReminderPrefix = guidelineReminder
      ? `[Reminder: user has an active ${GUIDELINE_TAG} note titled "${guidelineReminder.title}". ` +
        `If this turn involves strategy, risk, or preference decisions and the relevant rule ` +
        `is not already in your memory, call search_notes({tags:["${GUIDELINE_TAG}"]}) before answering. ` +
        `Do not mention this reminder to the user.]\n\n`
      : '';
    const framedMessage = frameBareSlashCommand(effectiveMessage);
    const messageWithReminder = temporalPrefix + guidelineReminderPrefix + framedMessage;
    if (guidelineReminder) {
      log(`Injecting GUIDELINE reminder for note "${guidelineReminder.title}"`, 'info');
    }
    if (framedMessage !== effectiveMessage) {
      log('Framed bare slash-command message with execute directive', 'info');
    }

    log('Sending request to Gemini with tools', 'info');

    const url = new URL(req.url);
    const streamParam = url.searchParams.get('stream');
    const acceptHeader = req.headers.get('Accept') || '';
    const streamHeader = req.headers.get('X-Stream') || '';
    const wantsStreaming = streamParam === 'true' || acceptHeader.includes('text/event-stream') || streamHeader === 'true';

    if (wantsStreaming) {
      log(`Using streaming mode (thinkingLevel=${chatThinkingLevel})`, 'info');
      return handleStreamingRequest(
        googleApiKey, systemPrompt, messageWithReminder, priorHistory, allTools,
        userId, calendarId, projectRef, supabaseAccessToken, supabaseUrl,
        allImages.length > 0 ? allImages : images,
        calendarContext?.tags, conversationId, chatThinkingLevel
      );
    }

    return await handleNonStreamingRequest({
      googleApiKey,
      systemPrompt,
      messageWithReminder,
      priorHistory,
      allTools,
      userId,
      calendarId,
      conversationId,
      supabaseUrl,
      projectRef,
      supabaseAccessToken,
      serviceClientForPersistence,
    });

  } catch (error) {
    log(`Error in AI agent: ${error instanceof Error ? error.message : 'Unknown'}`, 'error', error);
    const errResponse = formatErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      MODEL
    );
    return new Response(JSON.stringify(errResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
