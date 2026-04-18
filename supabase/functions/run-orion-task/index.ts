import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
} from '../_shared/supabase.ts';
import { getHandler } from './handlers.ts';
import type { OrionTask, TaskResult, RunMode } from './types.ts';

async function storeResult(
  serviceClient: ReturnType<typeof createServiceClient>,
  task: OrionTask,
  result: TaskResult
) {
  const { error: insertError } = await serviceClient
    .from('orion_task_results')
    .insert({
      task_id: task.id,
      user_id: task.user_id,
      task_type: task.task_type,
      content_html: result.content_html,
      content_plain: result.content_plain,
      significance: result.significance,
      metadata: result.metadata,
      group_date: new Date().toISOString().split('T')[0],
    });

  if (insertError) {
    log('Failed to store task result', 'error', insertError);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { taskId } = body;
    const mode: RunMode = body.mode === 'alert' ? 'alert' : 'scheduled';

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
      result = await handler(orionTask, serviceClient, mode);
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
      await storeResult(serviceClient, orionTask, failureResult);

      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Handler returning null means "suppress this result" — e.g. alert-mode
    // ran but nothing significant was found, so we don't spam the user.
    if (result === null) {
      log('Task suppressed (below significance threshold)', 'info', {
        taskId: orionTask.id,
        taskType: orionTask.task_type,
        mode,
      });
      return new Response(
        JSON.stringify({ success: true, suppressed: true }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const stored = await storeResult(serviceClient, orionTask, result);
    if (!stored) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store result' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    log('Task executed successfully', 'info', {
      taskId: orionTask.id,
      taskType: orionTask.task_type,
      mode,
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
