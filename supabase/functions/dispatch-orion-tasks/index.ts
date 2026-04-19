import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';

const MAX_TASKS_PER_DISPATCH = 500;

interface DueTask {
  id: string;
  task_type: string;
}

// Timing-safe string comparison to prevent leak of secret via response latency.
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

  // Shared-secret auth: the orion-dispatcher cron sends a secret in the
  // X-Orion-Dispatcher-Secret header. Anyone without it gets 401.
  // Required because verify_jwt is disabled (pg_cron can't send a JWT,
  // and the new sb_secret_* keys aren't JWT-format anyway).
  const expectedSecret = Deno.env.get('ORION_DISPATCHER_SECRET');
  if (!expectedSecret) {
    log('ORION_DISPATCHER_SECRET not set — refusing to dispatch', 'error');
    return errorResponse('Dispatcher not configured', 500);
  }
  const providedSecret = req.headers.get('x-orion-dispatcher-secret') ?? '';
  if (!constantTimeEquals(providedSecret, expectedSecret)) {
    log('Dispatcher auth failed', 'warn', {
      hasHeader: providedSecret.length > 0,
    });
    return errorResponse('Unauthorized', 401);
  }

  const startedAt = Date.now();
  const serviceClient = createServiceClient();

  // 1. Query tasks that are due
  const { data: dueTasks, error: queryError } = await serviceClient
    .from('orion_tasks')
    .select('id, task_type')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(MAX_TASKS_PER_DISPATCH);

  if (queryError) {
    log('Dispatcher query failed', 'error', queryError);
    return errorResponse(`Query failed: ${queryError.message}`, 500);
  }

  const tasks = (dueTasks ?? []) as DueTask[];

  if (tasks.length === 0) {
    return successResponse(
      { dispatched: 0, elapsed_ms: Date.now() - startedAt },
      'No due tasks'
    );
  }

  log(`Dispatching ${tasks.length} tasks`, 'info', {
    taskIds: tasks.map((t) => t.id),
  });

  // 2. Fire run-orion-task for each task in parallel
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return errorResponse('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing', 500);
  }

  const runUrl = `${supabaseUrl}/functions/v1/run-orion-task`;

  const outcomes = await Promise.allSettled(
    tasks.map(async (task) => {
      const response = await fetch(runUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId: task.id }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`run-orion-task ${response.status}: ${body.slice(0, 200)}`);
      }
      return response.json();
    })
  );

  const successCount = outcomes.filter((o) => o.status === 'fulfilled').length;
  const failureCount = outcomes.filter((o) => o.status === 'rejected').length;

  // Log failures individually so they show up in the edge function log stream
  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'rejected') {
      log('Task dispatch failed', 'error', {
        taskId: tasks[i].id,
        taskType: tasks[i].task_type,
        reason: outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason),
      });
    }
  });

  // 3. Advance next_run_at for every dispatched task (regardless of success).
  //    We deliberately advance on failure too: retrying a failed task on the
  //    next 5-minute tick would create a loop. Better to miss one run and wait
  //    for the next natural schedule.
  const { error: advanceError } = await serviceClient.rpc(
    'advance_orion_tasks_next_run_at',
    { p_task_ids: tasks.map((t) => t.id) }
  );

  if (advanceError) {
    log('Advance RPC failed', 'error', advanceError);
    return errorResponse(
      `Dispatched ${successCount}/${tasks.length} but failed to advance next_run_at: ${advanceError.message}`,
      500
    );
  }

  const elapsed = Date.now() - startedAt;
  log('Dispatch complete', 'info', {
    total: tasks.length,
    success: successCount,
    failure: failureCount,
    elapsed_ms: elapsed,
  });

  return successResponse({
    dispatched: tasks.length,
    success: successCount,
    failure: failureCount,
    elapsed_ms: elapsed,
  });
});
