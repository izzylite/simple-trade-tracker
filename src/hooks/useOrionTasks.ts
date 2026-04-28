import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { orionTaskService } from '../services/orionTaskService';
import { logger } from '../utils/logger';
import { playTaskNotificationSound } from '../utils/notificationSound';
import type {
  AITasksBundle,
  OrionTask,
  OrionTaskResult,
  TaskType,
  TaskConfig,
} from '../types/orionTask';

const PAGE_SIZE = 20;

export function useOrionTasks(userId: string | undefined, calendarId?: string): AITasksBundle {
  const [tasks, setTasks] = useState<OrionTask[]>([]);
  const [results, setResults] = useState<OrionTaskResult[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
      const data = await orionTaskService.getResults(userId, undefined, PAGE_SIZE, 0);
      setResults(data);
      setHasMore(data.length === PAGE_SIZE);
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
    
    setResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, is_read: true } : r))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await orionTaskService.markResultRead(resultId);
  }, []);

  const hideResult = useCallback(async (resultId: string) => {
    // Look up the row before we drop it so we can decrement unread correctly.
    const target = results.find((r) => r.id === resultId); 
    setResults((prev) => prev.filter((r) => r.id !== resultId));
    if (target && !target.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    await orionTaskService.hideResult(resultId);
  }, [results]);

  const markAllRead = useCallback(async () => {
    if (!userId) return; 
    setResults((prev) => prev.map((r) => ({ ...r, is_read: true })));
    setUnreadCount(0);
     await orionTaskService.markAllResultsRead(userId);
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await orionTaskService.getResults(userId, undefined, PAGE_SIZE, results.length);
      setResults((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      logger.error('Failed to load more results', err);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, loadingMore, hasMore, results.length]);

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
      .channel(`orion-${userId}`)
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
          // Audibly distinct from the economic-event chime in TradeCalendarPage
          // so traders can tell "scheduled event" from "Orion catalyst" by ear.
          playTaskNotificationSound().catch((err) => {
            logger.debug('Task notification sound failed', err);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orion_task_results',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Cross-device sync: a hide/read on one tab should propagate.
          const updated = payload.new as OrionTaskResult;
          if (updated.hidden_at) {
            setResults((prev) => {
              const target = prev.find((r) => r.id === updated.id);
              if (target && !target.is_read) {
                setUnreadCount((c) => Math.max(0, c - 1));
              }
              return prev.filter((r) => r.id !== updated.id);
            });
          } else {
            setResults((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orion_tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Keep failure counters / next_run_at fresh so the UI warning
          // badge reflects the current state without a manual refresh.
          const updated = payload.new as OrionTask;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          );
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
    hasMore,
    loadingMore,
    createTask,
    updateTask,
    deleteTask,
    markRead,
    markAllRead,
    hideResult,
    loadMore,
    refetchTasks: fetchTasks,
    refetchResults: fetchResults,
  };
}
