import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
} from '../_shared/supabase.ts';
import { getHandler } from './handlers.ts';
import type { OrionTask } from './types.ts';

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

    const result = await handler(orionTask);

    const { error: insertError } = await serviceClient
      .from('orion_task_results')
      .insert({
        task_id: orionTask.id,
        user_id: orionTask.user_id,
        task_type: orionTask.task_type,
        content_html: result.content_html,
        content_plain: result.content_plain,
        significance: result.significance,
        metadata: result.metadata,
        group_date: new Date().toISOString().split('T')[0],
      });

    if (insertError) {
      log('Failed to store task result', 'error', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store result' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

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
