import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { orionTaskService } from '../services/orionTaskService';
import { logger } from '../utils/logger';
import type {
  OrionTask,
  OrionTaskResult,
  TaskType,
  TaskConfig,
} from '../types/orionTask';

export function useOrionTasks(userId: string | undefined, calendarId?: string) {
  const [tasks, setTasks] = useState<OrionTask[]>([]);
  const [results, setResults] = useState<OrionTaskResult[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await orionTaskService.getTasks(userId, calendarId);
      setTasks(data);
    } catch (err) {
      logger.error('Failed to fetch tasks', err);
    }
  }, [userId, calendarId]);

  const fetchResults = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await orionTaskService.getResults(userId);
      setResults(data);
    } catch (err) {
      logger.error('Failed to fetch results', err);
    }
  }, [userId]);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await orionTaskService.getUnreadCount(userId);
      setUnreadCount(count);
    } catch (err) {
      logger.error('Failed to fetch unread count', err);
    }
  }, [userId]);

  const createTask = useCallback(
    async (taskType: TaskType, config: TaskConfig) => {
      if (!userId || !calendarId) return;
      const task = await orionTaskService.createTask(
        userId,
        calendarId,
        taskType,
        config
      );
      setTasks((prev) => [task, ...prev]);
      return task;
    },
    [userId, calendarId]
  );

  const deleteTask = useCallback(async (taskId: string) => {
    await orionTaskService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const markRead = useCallback(async (resultId: string) => {
    await orionTaskService.markResultRead(resultId);
    setResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, is_read: true } : r))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await orionTaskService.markAllResultsRead(userId);
    setResults((prev) => prev.map((r) => ({ ...r, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  const updateTask = useCallback(
    async (taskId: string, updates: { status?: OrionTask['status']; config?: TaskConfig }) => {
      const updated = await orionTaskService.updateTask(taskId, updates);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    []
  );

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    Promise.all([fetchTasks(), fetchResults(), fetchUnreadCount()]).finally(
      () => setLoading(false)
    );

    const channel = supabase
      .channel(`orion-task-results-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orion_task_results',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newResult = payload.new as OrionTaskResult;
          setResults((prev) => [newResult, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks, fetchResults, fetchUnreadCount]);

  return {
    tasks,
    results,
    unreadCount,
    loading,
    createTask,
    updateTask,
    deleteTask,
    markRead,
    markAllRead,
    refetchTasks: fetchTasks,
    refetchResults: fetchResults,
  };
}
