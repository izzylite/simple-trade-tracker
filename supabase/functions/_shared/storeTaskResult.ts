import { log, createServiceClient } from './supabase.ts';

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface TaskResultPayload {
  content_html: string;
  content_plain: string;
  significance: string | null;
  metadata: Record<string, unknown>;
}

interface TaskRef {
  id: string;
  user_id: string;
  task_type: string;
}

function prettyTaskType(taskType: string): string {
  const LABELS: Record<string, string> = { market_research: 'Market Research' };
  return LABELS[taskType] ?? (taskType
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim() || 'Orion Task');
}

export async function storeTaskResult(
  serviceClient: ServiceClient,
  task: TaskRef,
  result: TaskResultPayload
): Promise<{ ok: boolean; resultId?: string }> {
  const { data: insertedRow, error: insertError } = await serviceClient
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
    })
    .select('id')
    .single();

  if (insertError || !insertedRow) {
    log('Failed to store task result', 'error', insertError);
    return { ok: false };
  }

  try {
    const isError = (result.metadata as { error?: boolean } | null)?.error === true;
    const previewSource = (result.content_plain || '').replace(/\s+/g, ' ').trim();
    const preview = previewSource.length > 120
      ? previewSource.slice(0, 117) + '…'
      : previewSource;
    const metaTitle = (result.metadata as { title?: string } | null)?.title?.trim();
    const baseTitle = metaTitle || prettyTaskType(task.task_type);
    const title = (isError ? `${baseTitle} — failed` : baseTitle).slice(0, 200);

    const { error: notifErr } = await serviceClient
      .from('notifications')
      .insert({
        user_id: task.user_id,
        type: 'orion_task_result',
        title,
        payload: {
          taskId: task.id,
          resultId: insertedRow.id,
          taskType: task.task_type,
          significance: result.significance ?? null,
          isError,
          preview,
        },
      });
    if (notifErr) {
      log('Notification insert (task_result) failed (non-fatal)', 'warn', {
        taskId: task.id,
        error: notifErr.message,
      });
    }
  } catch (notifThrow) {
    log('Notification insert (task_result) threw (non-fatal)', 'warn', {
      taskId: task.id,
      error: notifThrow instanceof Error ? notifThrow.message : String(notifThrow),
    });
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
