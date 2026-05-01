import {
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';

const MAX_REMINDERS_PER_DISPATCH = 100;

interface DueReminder {
  id: string;
  user_id: string;
  conversation_id: string;
  instructions: string;
  description: string | null;
}

// Timing-safe comparison to avoid leaking the secret via response-time differences.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Shared-secret auth: pg_cron sends a secret in the X-Reminders-Dispatcher-Secret
  // header. Required because verify_jwt is disabled (pg_cron can't send a JWT).
  const expectedSecret = Deno.env.get('REMINDERS_DISPATCHER_SECRET');
  if (!expectedSecret) {
    log('REMINDERS_DISPATCHER_SECRET not set — refusing to dispatch', 'error');
    return errorResponse('Dispatcher not configured', 500);
  }
  const providedSecret = req.headers.get('x-reminders-dispatcher-secret') ?? '';
  if (!constantTimeEquals(providedSecret, expectedSecret)) {
    log('Reminders dispatcher auth failed', 'warn', {
      hasHeader: providedSecret.length > 0,
    });
    return errorResponse('Unauthorized', 401);
  }

  const startedAt = Date.now();
  const serviceClient = createServiceClient();

  // 1. Query due pending reminders. The partial index idx_reminders_due
  //    (WHERE status='pending') makes this a fast index scan.
  const { data: dueRows, error: queryError } = await serviceClient
    .from('reminders')
    .select('id, user_id, conversation_id, instructions, description')
    .eq('status', 'pending')
    .lte('trigger_at', new Date().toISOString())
    .limit(MAX_REMINDERS_PER_DISPATCH);

  if (queryError) {
    log('Reminders dispatcher query failed', 'error', queryError);
    return errorResponse(`Query failed: ${queryError.message}`, 500);
  }
  const reminders = (dueRows ?? []) as DueReminder[];
  if (reminders.length === 0) {
    return successResponse(
      { dispatched: 0, elapsed_ms: Date.now() - startedAt },
      'No due reminders'
    );
  }

  log(`Dispatching ${reminders.length} reminders`, 'info', {
    ids: reminders.map((r) => r.id),
  });

  // 2. Fan out to ai-trading-agent in mode='reminder'. The edge function
  //    performs the atomic claim itself — no double-fire risk if the
  //    browser local timer also POSTed for the same reminder.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return errorResponse('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing', 500);
  }
  const fireUrl = `${supabaseUrl}/functions/v1/ai-trading-agent`;

  const outcomes = await Promise.allSettled(
    reminders.map(async (r) => {
      const fireResp = await fetch(fireUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'reminder',
          userId: r.user_id,
          conversationId: r.conversation_id,
          reminderId: r.id,
          reminderDescription: r.description ?? undefined,
          message: r.instructions,
        }),
      });
      if (!fireResp.ok) {
        const body = await fireResp.text();
        // ai-trading-agent should have already marked the reminder failed
        // on its own error path; we still log here for visibility.
        throw new Error(`ai-trading-agent ${fireResp.status}: ${body.slice(0, 200)}`);
      }
      const fireBody = await fireResp.json().catch(() => ({}));
      // ai-trading-agent reports `claimed: false` when another caller (e.g.
      // the browser local timer) won the atomic claim race. That's not a
      // failure — it's the correct outcome.
      const wasClaimed = fireBody?.claimed !== false;
      return { id: r.id, claimed: wasClaimed };
    })
  );

  const claimed = outcomes.filter(
    (o) => o.status === 'fulfilled' && (o.value as { claimed: boolean }).claimed
  ).length;
  const skipped = outcomes.filter(
    (o) => o.status === 'fulfilled' && !(o.value as { claimed: boolean }).claimed
  ).length;
  const failed = outcomes.filter((o) => o.status === 'rejected').length;

  for (const o of outcomes) {
    if (o.status === 'rejected') {
      log('Reminder fire failed', 'error', { reason: String(o.reason) });
    }
  }

  log('Reminders dispatch complete', 'info', {
    total: reminders.length,
    claimed,
    skipped,
    failed,
    elapsed_ms: Date.now() - startedAt,
  });

  return successResponse({
    dispatched: reminders.length,
    claimed,
    skipped,
    failed,
    elapsed_ms: Date.now() - startedAt,
  });
});
