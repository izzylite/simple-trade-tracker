import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
} from '../_shared/supabase.ts';
import {
  markTaskSuccess,
  markTaskFailure,
} from '../_shared/storeTaskResult.ts';
import { getHandler } from './handlers.ts';
import type { OrionTask, TaskResult } from './types.ts';

// Legacy inline store. This generic runner is dead-routed (the dispatcher
// sends market_research through the asset pool, and no other task types
// exist), but the shared storeTaskResult moved to thin briefing-pointer rows
// which this runner has no briefing to reference. Keep the old fat insert
// local so the source stays type-consistent if the function is ever revived.
async function storeLegacyResult(
  serviceClient: ReturnType<typeof createServiceClient>,
  task: { id: string; user_id: string; task_type: string },
  result: TaskResult,
): Promise<{ ok: boolean }> {
  const { error } = await serviceClient.from('orion_task_results').insert({
    task_id: task.id,
    user_id: task.user_id,
    task_type: task.task_type,
    content_html: result.content_html,
    content_plain: result.content_plain,
    significance: result.significance,
    metadata: result.metadata,
    group_date: new Date().toISOString().split('T')[0],
  });
  if (error) {
    log('Failed to store task result', 'error', error);
    return { ok: false };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { taskId } = await req.json();

    if (!taskId) {
      return new Response(
        JSON.stringify({ success: false, error: 'taskId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const serviceClient = createServiceClient();

    const { data: task, error: taskError } = await serviceClient
      .from('orion_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      log('Task not found', 'error', { taskId, taskError });
      return new Response(
        JSON.stringify({ success: false, error: 'Task not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const orionTask = task as OrionTask;

    if (orionTask.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, error: 'Task is not active' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const handler = getHandler(orionTask.task_type);
    if (!handler) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown task type: ${orionTask.task_type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let result: TaskResult | null;
    try {
      result = await handler(orionTask, serviceClient);
    } catch (handlerErr) {
      const message = handlerErr instanceof Error ? handlerErr.message : 'Handler error';
      log('Task handler failed', 'error', {
        taskId: orionTask.id,
        taskType: orionTask.task_type,
        message,
      });

      const failureResult: TaskResult = {
        content_html: `<p>Task failed to run. ${message}</p>`,
        content_plain: `Task failed to run. ${message}`,
        significance: null,
        metadata: { error: true, message },
      };
      await storeLegacyResult(serviceClient, orionTask, failureResult);
      await markTaskFailure(serviceClient, orionTask.id, message);
      // storeResult-side notification covers the inbox surface; no extra
      // work needed here even on failure.

      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Handler returning null means "suppress this result" — e.g. a market
    // research sweep below the configured significance threshold. No red dot,
    // no card; the run still counts as "executed" for scheduling purposes.
    if (result === null) {
      log('Task suppressed (below significance threshold)', 'info', {
        taskId: orionTask.id,
        taskType: orionTask.task_type,
      });
      await markTaskSuccess(serviceClient, orionTask.id);
      return new Response(
        JSON.stringify({ success: true, suppressed: true }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const stored = await storeLegacyResult(serviceClient, orionTask, result);
    if (!stored.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store result' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    await markTaskSuccess(serviceClient, orionTask.id);

    log('Task executed successfully', 'info', {
      taskId: orionTask.id,
      taskType: orionTask.task_type,
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    log('run-orion-task error', 'error', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
