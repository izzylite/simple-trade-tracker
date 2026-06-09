import { log, createServiceClient } from './supabase.ts';

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface ThinResultPayload {
  briefingId: string;
  title: string;
  significance: string | null;
  preview: string; // notification body, from briefing.content_plain
}

interface TaskRef {
  id: string;
  user_id: string;
  task_type: string;
}

export function buildThinResultRow(
  task: TaskRef,
  p: ThinResultPayload,
): Record<string, unknown> {
  return {
    task_id: task.id,
    user_id: task.user_id,
    task_type: task.task_type,
    briefing_id: p.briefingId,
    title: p.title,
    significance: p.significance,
    group_date: new Date().toISOString().split('T')[0],
  };
}

export async function storeTaskResult(
  serviceClient: ServiceClient,
  task: TaskRef,
  p: ThinResultPayload,
): Promise<{ ok: boolean; resultId?: string }> {
  const { data: insertedRow, error: insertError } = await serviceClient
    .from('orion_task_results')
    .upsert(buildThinResultRow(task, p), {
      onConflict: 'user_id,briefing_id',
      ignoreDuplicates: true,
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    log('Failed to store task result', 'error', insertError);
    return { ok: false };
  }
  if (!insertedRow) return { ok: true }; // duplicate (already delivered) — not an error

  const preview = p.preview.replace(/\s+/g, ' ').trim().slice(0, 117);
  const title = (p.title || 'Market Research').slice(0, 200);
  const { error: notifErr } = await serviceClient.from('notifications').insert({
    user_id: task.user_id,
    type: 'orion_task_result',
    title,
    payload: {
      taskId: task.id,
      resultId: insertedRow.id,
      taskType: task.task_type,
      significance: p.significance ?? null,
      isError: false,
      preview,
    },
  });
  if (notifErr) {
    log('Notification insert failed (non-fatal)', 'warn', { error: notifErr.message });
  }
  return { ok: true, resultId: insertedRow.id };
}

export async function markTaskSuccess(
  serviceClient: ServiceClient,
  taskId: string
): Promise<void> {
  const { error } = await serviceClient
    .from('orion_tasks')
    .update({
      last_error: null,
      last_error_at: null,
      consecutive_failures: 0,
    })
    .eq('id', taskId)
    .gt('consecutive_failures', 0);
  if (error) log('Failed to clear failure state', 'warn', error);
}

export async function markTaskFailure(
  serviceClient: ServiceClient,
  taskId: string,
  message: string
): Promise<void> {
  const truncated = message.length > 500 ? message.slice(0, 497) + '...' : message;
  const { data, error: selectErr } = await serviceClient
    .from('orion_tasks')
    .select('consecutive_failures')
    .eq('id', taskId)
    .single();
  if (selectErr) {
    log('Failed to read failure counter', 'warn', selectErr);
    return;
  }
  const next = (data?.consecutive_failures ?? 0) + 1;
  const shouldDisable = next >= 10;
  const updatePayload: Record<string, unknown> = {
    last_error: truncated,
    last_error_at: new Date().toISOString(),
    consecutive_failures: next,
  };
  if (shouldDisable) updatePayload.status = 'disabled';
  const { error: updateErr } = await serviceClient
    .from('orion_tasks')
    .update(updatePayload)
    .eq('id', taskId);
  if (updateErr) log('Failed to persist failure state', 'warn', updateErr);
}
