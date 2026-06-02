/**
 * handleReminderRequest — mode='reminder' POST handler.
 *
 * Atomically claims the reminder, loads the conversation, runs the agent
 * loop (via reminderAgentLoop), appends the assistant message, and marks
 * the reminder fired. Both fire paths (cron dispatcher + browser local
 * timer) funnel here — whichever wins claim_reminder owns the fire.
 */

import { log, createServiceClient, errorResponse, successResponse } from '../_shared/supabase.ts';
import {
  getCachedMCPTools,
} from '../_shared/orionMcp.ts';
import { formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { ToolCall } from './types.ts';
import type { AgentRequest } from './types.ts';
import { getAllCustomTools } from './tools.ts';
import { loadUserWebhookTools } from '../_shared/customTools/runtime.ts';
import { MAX_PROMPT_TOKENS } from './conversationStore.ts';
import { maybeUpdateEmbedding } from './tools/recall-conversations.ts';
import { buildSecureSystemPrompt } from './systemPrompt.ts';
import { checkOrionAccess } from '../_shared/tierEnforcement.ts';
import { logTurnAudit } from './billing.ts';
import { reminderAgentLoop } from './reminderAgentLoop.ts';

/**
 * Constant-time string comparison for service-role bearer match.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify the Authorization header for a reminder-mode call.
 */
async function authReminderRequest(
  req: Request
): Promise<{ kind: 'service' } | { kind: 'user'; userId: string } | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceKey && constantTimeEqual(token, serviceKey)) {
    return { kind: 'service' };
  }

  try {
    const client = createServiceClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return { kind: 'user', userId: data.user.id };
  } catch (err) {
    log(`Reminder auth JWT verify failed: ${err instanceof Error ? err.message : String(err)}`, 'warn');
    return null;
  }
}

export async function handleReminderRequest(req: Request, body: AgentRequest): Promise<Response> {
  // ---- 3a. Dual auth check ----
  const auth = await authReminderRequest(req);
  if (!auth) return errorResponse('Unauthorized', 401);

  const userId = auth.kind === 'user' ? auth.userId : body.userId;

  // ---- 3b. Validate request ----
  const { conversationId, reminderId, message } = body;
  if (!conversationId || !reminderId || !userId || !message) {
    return errorResponse(
      'Missing required fields for mode=reminder: conversationId, reminderId, userId, message',
      400
    );
  }

  // ---- 3c. Atomic claim ----
  const serviceClient = createServiceClient();
  const { data: claimedRows, error: claimErr } = await serviceClient
    .rpc('claim_reminder', { p_id: reminderId });
  if (claimErr) {
    log('claim_reminder error', 'error', claimErr);
    return errorResponse(`claim failed: ${claimErr.message}`, 500);
  }
  if (!claimedRows || (Array.isArray(claimedRows) && claimedRows.length === 0)) {
    log('reminder already claimed', 'info', { reminderId });
    return successResponse({ claimed: false }, 'Already claimed');
  }
  const claimed = (Array.isArray(claimedRows) ? claimedRows[0] : claimedRows) as {
    id: string;
    user_id: string;
    conversation_id: string;
    instructions: string;
    description: string | null;
    created_at: string;
    batch_id: string | null;
  };

  // ---- 3d. Cross-check authorization vs claimed row ----
  if (claimed.user_id !== userId || claimed.conversation_id !== conversationId) {
    log('reminder ownership mismatch', 'error', {
      reminderId,
      claimedUserId: claimed.user_id, callerUserId: userId,
      claimedConversationId: claimed.conversation_id, callerConversationId: conversationId,
    });
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'ownership_mismatch' }).eq('id', reminderId);
    return errorResponse('Forbidden: reminder ownership mismatch', 403);
  }

  // ---- 3d.5. Tier + budget gate ----
  const reminderGate = await checkOrionAccess(userId);
  if (!reminderGate.allowed) {
    log('Reminder fire denied by tier gate', 'info', {
      userId, reminderId, tier: reminderGate.tier, reason: reminderGate.reason,
    });
    return successResponse(
      {
        blocked: true,
        reason: reminderGate.reason,
        tier: reminderGate.tier,
        reset_at: reminderGate.resetAt ?? null,
        tokens_consumed: reminderGate.tokensConsumed ?? null,
        tokens_budget: reminderGate.tokensBudget ?? null,
        kind: 'reminder',
      },
      'Reminder blocked by tier gate'
    );
  }

  // ---- 3e. Load conversation + check token-budget cap ----
  const { data: convo, error: convoErr } = await serviceClient
    .from('ai_conversations')
    .select('id, user_id, calendar_id, title, messages, message_count, last_prompt_tokens')
    .eq('id', conversationId)
    .single();

  if (convoErr || !convo) {
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'conversation_not_found' }).eq('id', reminderId);
    return errorResponse('conversation not found', 404);
  }

  if (convo.user_id !== userId) {
    log('Reminder conversation ownership mismatch — refusing to fire', 'warn', {
      reminderId, reminderUserId: userId, conversationOwner: convo.user_id,
    });
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'conversation_owner_mismatch' }).eq('id', reminderId);
    return errorResponse('conversation does not belong to reminder owner', 403);
  }

  const currentPromptTokens = Number(convo.last_prompt_tokens ?? 0);
  if (currentPromptTokens >= MAX_PROMPT_TOKENS) {
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'token_budget_exceeded' }).eq('id', reminderId);
    return successResponse(
      { claimed: true, fired: false, reason: 'token_budget_exceeded' },
      'Conversation token budget exhausted'
    );
  }

  const calendarId = (convo.calendar_id as string | null) ?? undefined;

  // ---- 3f. Build system prompt ----
  const baseSystemPrompt = buildSecureSystemPrompt(userId, calendarId);

  let batchHint = '';
  if (claimed.batch_id) {
    const { data: siblingRows } = await serviceClient
      .from('reminders')
      .select('id, trigger_at, description')
      .eq('batch_id', claimed.batch_id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('trigger_at', { ascending: true })
      .limit(20);
    const siblings = siblingRows ?? [];
    if (siblings.length > 0) {
      const nextIso = siblings[0].trigger_at;
      batchHint =
        `\nBATCH CONTEXT: this reminder belongs to batch_id="${claimed.batch_id}". ` +
        `${siblings.length} more fire(s) still pending in the same batch (next at ${nextIso}). ` +
        `If the user asks to stop / cancel / end the loop, call ` +
        `manage_reminder(action="cancel", batch_id="${claimed.batch_id}") — ` +
        `that cancels every sibling atomically WITHOUT touching unrelated reminders. ` +
        `Do NOT cancel by single id when the user means the whole loop. ` +
        `USER-FACING VOCAB: NEVER say "batch", "batch_id", "siblings", or "loop id" to the user — ` +
        `describe the action naturally ("stopped the every-5min check", "ended the monitoring", "cancelled the price watch").\n`;
    } else {
      batchHint =
        `\nBATCH CONTEXT: this is the final fire of batch_id="${claimed.batch_id}" — ` +
        `no more siblings pending. The scheduled loop is now complete.\n`;
    }
  }

  const reminderHint =
    `\n---\nThis turn is firing because of a reminder you (the user) set on ${claimed.created_at}.\n` +
    `The original instructions were: "${claimed.instructions}"\n${batchHint}` +
    `Conversation history follows. Respond directly as a continuation of the conversation —\n` +
    `do NOT greet the user as if starting fresh.\n`;
  const systemPrompt = baseSystemPrompt + reminderHint;

  const storedMessages = Array.isArray(convo.messages) ? convo.messages : [];
  const conversationHistory = storedMessages
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

  // ---- 3g. Run the agent loop ----
  const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!googleApiKey) {
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'GOOGLE_API_KEY missing' }).eq('id', reminderId);
    return errorResponse('AI service is not configured.', 500);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const supabaseAccessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');
  if (!supabaseUrl || !projectRef || !supabaseAccessToken) {
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: 'Supabase configuration missing' }).eq('id', reminderId);
    return errorResponse('Supabase configuration missing', 500);
  }

  let finalText = '';
  let functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
  let firstRoundUsage: Record<string, unknown> | undefined;
  let lastUsageMetadata: Record<string, unknown> | undefined;
  let roundUsages: Array<Record<string, unknown>> = [];

  try {
    const geminiMcpTools = await getCachedMCPTools(projectRef, supabaseAccessToken, ['execute_sql', 'list_tables']);
    const customTools = getAllCustomTools();
    const userWebhookTools = await loadUserWebhookTools(userId);
    const allTools = [...geminiMcpTools, ...customTools, ...userWebhookTools];

    const loopResult = await reminderAgentLoop({
      googleApiKey, systemPrompt, userTurnMessage: claimed.instructions,
      conversationHistory, allTools, userId, calendarId, conversationId,
      projectRef, supabaseAccessToken, serviceClient,
    });
    finalText = loopResult.finalText;
    functionCalls = loopResult.functionCalls;
    firstRoundUsage = loopResult.firstRoundUsage;
    lastUsageMetadata = loopResult.lastUsageMetadata;
    roundUsages = loopResult.roundUsages;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[reminder] agent failure: ${msg}`, 'error', err);
    await serviceClient.from('reminders')
      .update({ status: 'failed', last_error: msg.slice(0, 500) }).eq('id', reminderId);
    return errorResponse(`agent failure: ${msg}`, 500);
  }

  // ---- 3h. Append assistant message ----
  const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
    finalText, functionCalls as ToolCall[]
  );
  const newMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: finalText,
    messageHtml,
    timestamp: new Date().toISOString(),
    status: 'received',
    citations: citations ?? [],
    toolCalls: functionCalls.map(fc => ({ name: fc.name, label: fc.name })),
    metadata: {
      triggered_by: `reminder:${reminderId}`,
      reminder_description: claimed.description ?? null,
    },
  };

  const firstRoundPrompt = Number(firstRoundUsage?.promptTokenCount ?? 0);
  const assistantOutput = Number(lastUsageMetadata?.candidatesTokenCount ?? 0);
  const nextTurnEstimate = firstRoundPrompt + assistantOutput;
  // The agent loop can run up to 130s. Wrap all post-loop DB work in
  // EdgeRuntime.waitUntil so it survives past the 150s response window
  // even if the HTTP response has already been sent.
  // https://supabase.com/docs/guides/functions/background-tasks
  const er = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;

  let appendOk = false;
  let appendSkipped = false;
  let appendErrMsg = '';

  const appendTask = (async () => {
    const { data: appendData, error: appendErr } = await serviceClient.rpc('append_conversation_message', {
      p_id: conversationId,
      p_user_id: userId,
      p_message: newMessage,
      p_cap: MAX_PROMPT_TOKENS,
      p_prompt_tokens: nextTurnEstimate > 0 ? nextTurnEstimate : null,
      p_preview: finalText ? finalText.slice(0, 200) : null,
    });

    if (appendErr) {
      appendErrMsg = appendErr.message;
      await serviceClient.from('reminders')
        .update({ status: 'failed', last_error: `append: ${appendErr.message}`.slice(0, 500) })
        .eq('id', reminderId);
      return;
    }
    if (appendData !== true) {
      appendSkipped = true;
      await serviceClient.from('reminders')
        .update({ status: 'failed', last_error: 'token_budget_exceeded_or_gone' })
        .eq('id', reminderId);
      return;
    }
    appendOk = true;

    logTurnAudit(conversationId, functionCalls, firstRoundUsage, lastUsageMetadata, roundUsages);

    // Re-embed for semantic recall
    const embedTask = maybeUpdateEmbedding(serviceClient, conversationId, userId);
    if (er?.waitUntil) er.waitUntil(embedTask); else await embedTask;

    // Mark reminder fired
    const { error: markFiredErr } = await serviceClient.from('reminders')
      .update({ status: 'fired', fired_at: new Date().toISOString() }).eq('id', reminderId);
    if (markFiredErr) {
      log('Failed to mark reminder fired (stuck in firing state)', 'error', {
        reminderId, error: markFiredErr.message,
      });
    }

    // Insert notification row
    try {
      const previewSource = (finalText || '').replace(/\s+/g, ' ').trim();
      const preview = previewSource.length > 120 ? previewSource.slice(0, 117) + '…' : previewSource;
      const fallbackTitle = (claimed.instructions || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const title = (claimed.description?.trim() || fallbackTitle || 'Reminder fired').slice(0, 200);
      const { error: notifErr } = await serviceClient.from('notifications').insert({
        user_id: userId,
        type: 'reminder_fired',
        title,
        payload: {
          calendarId: calendarId ?? null,
          conversationId,
          reminderId,
          messageId: newMessage.id,
          preview,
          batchId: claimed.batch_id ?? null,
        },
      });
      if (notifErr) {
        log('Notification insert failed (non-fatal)', 'warn', { reminderId, error: notifErr.message });
      }
    } catch (notifThrow) {
      log('Notification insert threw (non-fatal)', 'warn', {
        reminderId,
        error: notifThrow instanceof Error ? notifThrow.message : String(notifThrow),
      });
    }
  })();

  if (er?.waitUntil) {
    er.waitUntil(appendTask);
    // Await anyway to capture the result flags before the response is sent.
    // waitUntil ensures the task runs to completion even if the await here
    // is cut short by the response being delivered first.
    await appendTask.catch(() => {});
  } else {
    await appendTask;
  }

  if (appendErrMsg) return errorResponse(`append failed: ${appendErrMsg}`, 500);
  if (appendSkipped) {
    return successResponse(
      { claimed: true, fired: false, reason: 'token_budget_exceeded_or_gone' },
      'Append skipped'
    );
  }

  return successResponse(
    { claimed: true, fired: true, reminderId, conversationId },
    'Reminder fired'
  );
}
