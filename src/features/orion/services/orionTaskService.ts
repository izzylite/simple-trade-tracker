import { supabase } from 'config/supabase';
import { logger } from 'utils/logger';
import type {
  BriefingSnapshot,
  OrionTask,
  OrionTaskResult,
  TaskStatus,
  TaskConfig,
} from 'features/orion/types/orionTask';

export const orionTaskService = {
  async getTasks(userId: string, calendarId?: string): Promise<OrionTask[]> {
    let query = supabase
      .from('orion_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (calendarId) {
      query = query.eq('calendar_id', calendarId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch tasks', error);
      throw error;
    }
    return data ?? [];
  },

  async createTask(
    userId: string,
    calendarId: string,
    config: TaskConfig
  ): Promise<OrionTask> {
    const { data, error } = await supabase
      .from('orion_tasks')
      .insert({
        user_id: userId,
        calendar_id: calendarId,
        task_type: 'market_research',
        config,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create task', error);
      throw error;
    }
    return data;
  },

  async updateTask(
    taskId: string,
    updates: { status?: TaskStatus; config?: TaskConfig }
  ): Promise<OrionTask> {
    const { data, error } = await supabase
      .from('orion_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task', error);
      throw error;
    }
    return data;
  },

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('orion_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      logger.error('Failed to delete task', error);
      throw error;
    }
  },

  async getResults(
    userId: string,
    taskId?: string,
    limit = 10,
    offset = 0
  ): Promise<OrionTaskResult[]> {
    let query = supabase
      .from('orion_task_results')
      .select(
        '*, briefing:asset_research_briefings(content_html, content_plain, significance, citations, tool_calls)'
      )
      .eq('user_id', userId)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch task results', error);
      throw error;
    }
    return data ?? [];
  },

  async getBriefing(briefingId: string): Promise<BriefingSnapshot | null> {
    const { data, error } = await supabase
      .from('asset_research_briefings')
      .select('content_html, content_plain, significance, citations, tool_calls')
      .eq('id', briefingId)
      .maybeSingle();
    if (error) {
      logger.error('Failed to fetch briefing', error);
      return null;
    }
    return data as BriefingSnapshot | null;
  },

  async markResultRead(resultId: string): Promise<void> {
    const { error } = await supabase
      .from('orion_task_results')
      .update({ is_read: true })
      .eq('id', resultId);

    if (error) {
      logger.error('Failed to mark result read', error);
      throw error;
    }
  },

  async markAllResultsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('orion_task_results')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('hidden_at', null);

    if (error) {
      logger.error('Failed to mark all results read', error);
      throw error;
    }
  },

  /**
   * Soft-delete: hides the result from the user feed but leaves the row in
   * place so Orion's dedup context (fetchRecentBriefings) can still see it
   * and avoid re-reporting the same catalyst the user just dismissed.
   */
  async hideResult(resultId: string): Promise<void> {
    const { error } = await supabase
      .from('orion_task_results')
      .update({ hidden_at: new Date().toISOString() })
      .eq('id', resultId);

    if (error) {
      logger.error('Failed to hide result', error);
      throw error;
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('orion_task_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('hidden_at', null);

    if (error) {
      logger.error('Failed to fetch unread count', error);
      return 0;
    }
    return count ?? 0;
  },
};
