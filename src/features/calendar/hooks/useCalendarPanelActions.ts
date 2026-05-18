import { useCallback, useState } from 'react';
import { mutate as swrMutate } from 'swr';
import { Calendar } from '../types/calendar';
import { CalendarFormData } from '../components/CalendarFormDialog';
import * as calendarService from '../services/calendarService';
import { logger } from 'utils/logger';

interface UseCalendarPanelActionsArgs {
  /** Owning user ID — used to invalidate SWR caches for ['calendars', userId] and ['trash-calendars', userId]. */
  userId: string | undefined;
  /** Callback invoked to refresh any local copy of the calendar list (e.g. breadcrumb dropdown state). */
  loadUserCalendars: () => Promise<void> | void;
  /** Snackbar/toast for user feedback. */
  showSnackbar: (message: string, severity: 'success' | 'error') => void;
  /** Required for edit-submit. When omitted, edit dialog is non-functional. */
  onUpdateCalendar?: (id: string, updates: Partial<Calendar>) => Promise<void> | void;
  /** Required for duplicate-submit. */
  onDuplicateCalendar?: (
    sourceCalendarId: string,
    newName: string,
    includeContent?: boolean
  ) => Promise<void> | void;
  /** Required for delete-confirm. */
  onDeleteCalendar?: (id: string) => Promise<void> | void;
}

export interface CalendarPanelActions {
  // Targets / dialog state
  editTarget: Calendar | null;
  duplicateTarget: Calendar | null;
  linkTarget: Calendar | null;
  deleteTarget: string | null;
  isEditSubmitting: boolean;
  isDuplicating: boolean;
  isLinking: boolean;
  isDeleting: boolean;

  // Direct setters — pass to CalendarsListContent props for opening dialogs
  setEditTarget: (cal: Calendar | null) => void;
  setDuplicateTarget: (cal: Calendar | null) => void;
  setLinkTarget: (cal: Calendar | null) => void;
  setDeleteTarget: (id: string | null) => void;

  // Submit handlers — wired into dialog onSubmit/onConfirm
  handleEditSubmit: (data: CalendarFormData) => Promise<void>;
  handleDuplicateSubmit: (withContent: boolean) => Promise<void>;
  handleLinkSubmit: (targetCalendarId: string) => Promise<void>;
  handleUnlinkSubmit: () => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;

  // Trash actions — directly callable, no dialog
  restoreCalendar: (id: string) => Promise<void>;
  permanentDeleteCalendar: (id: string) => Promise<void>;

  // Helper exposed for callers that need to re-sync after non-dialog mutations
  refreshCalendarSources: () => Promise<void>;
}

/**
 * Encapsulates all calendar management actions originating from the
 * calendars-list panel/drawer (edit/duplicate/link/delete on calendars
 * other than the currently-active one) plus trash actions.
 *
 * Mutating App-level state alone doesn't invalidate SWR caches used by
 * CalendarsListContent, so each handler also calls swrMutate on the
 * relevant cache keys plus the caller's loadUserCalendars().
 */
export function useCalendarPanelActions(
  args: UseCalendarPanelActionsArgs
): CalendarPanelActions {
  const {
    userId,
    loadUserCalendars,
    showSnackbar,
    onUpdateCalendar,
    onDuplicateCalendar,
    onDeleteCalendar,
  } = args;

  const [editTarget, setEditTarget] = useState<Calendar | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Calendar | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Calendar | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshCalendarSources = useCallback(async () => {
    await Promise.all([
      loadUserCalendars(),
      userId ? swrMutate(['calendars', userId]) : Promise.resolve(),
      userId ? swrMutate(['trash-calendars', userId]) : Promise.resolve(),
    ]);
  }, [userId, loadUserCalendars]);

  const handleEditSubmit = useCallback(
    async (data: CalendarFormData) => {
      if (!editTarget || !onUpdateCalendar) return;

      setIsEditSubmitting(true);
      try {
        await onUpdateCalendar(editTarget.id, { ...data });
        await refreshCalendarSources();
        setEditTarget(null);
        showSnackbar('Calendar updated successfully', 'success');
      } catch (error) {
        logger.error('Error updating calendar:', error);
        showSnackbar('Failed to update calendar', 'error');
      } finally {
        setIsEditSubmitting(false);
      }
    },
    [editTarget, onUpdateCalendar, refreshCalendarSources, showSnackbar]
  );

  const handleDuplicateSubmit = useCallback(
    async (withContent: boolean) => {
      if (!duplicateTarget || !onDuplicateCalendar) return;

      setIsDuplicating(true);
      try {
        const newName = `${duplicateTarget.name} (Copy)`;
        await onDuplicateCalendar(duplicateTarget.id, newName, withContent);
        await refreshCalendarSources();
        setDuplicateTarget(null);
        showSnackbar('Calendar duplicated successfully', 'success');
      } catch (error) {
        logger.error('Error duplicating calendar:', error);
        showSnackbar('Failed to duplicate calendar', 'error');
      } finally {
        setIsDuplicating(false);
      }
    },
    [duplicateTarget, onDuplicateCalendar, refreshCalendarSources, showSnackbar]
  );

  const handleLinkSubmit = useCallback(
    async (targetCalendarId: string) => {
      if (!linkTarget) return;

      setIsLinking(true);
      try {
        await calendarService.linkCalendar(linkTarget.id, targetCalendarId);
        await refreshCalendarSources();
        setLinkTarget(null);
      } catch (error) {
        logger.error('Error linking calendar:', error);
        throw error;
      } finally {
        setIsLinking(false);
      }
    },
    [linkTarget, refreshCalendarSources]
  );

  const handleUnlinkSubmit = useCallback(async () => {
    if (!linkTarget) return;

    setIsLinking(true);
    try {
      await calendarService.unlinkCalendar(linkTarget.id);
      await refreshCalendarSources();
      setLinkTarget(null);
    } catch (error) {
      logger.error('Error unlinking calendar:', error);
      throw error;
    } finally {
      setIsLinking(false);
    }
  }, [linkTarget, refreshCalendarSources]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !onDeleteCalendar) return;

    setIsDeleting(true);
    try {
      await onDeleteCalendar(deleteTarget);
      await refreshCalendarSources();
      setDeleteTarget(null);
      showSnackbar('Calendar moved to trash', 'success');
    } catch (error) {
      logger.error('Error deleting calendar:', error);
      showSnackbar('Failed to delete calendar', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, onDeleteCalendar, refreshCalendarSources, showSnackbar]);

  const restoreCalendar = useCallback(
    async (id: string) => {
      try {
        await calendarService.restoreCalendar(id);
        await refreshCalendarSources();
      } catch (error) {
        logger.error('Error restoring calendar:', error);
      }
    },
    [refreshCalendarSources]
  );

  const permanentDeleteCalendar = useCallback(
    async (id: string) => {
      try {
        await calendarService.permanentlyDeleteCalendar(id);
        await refreshCalendarSources();
      } catch (error) {
        logger.error('Error permanently deleting calendar:', error);
      }
    },
    [refreshCalendarSources]
  );

  return {
    editTarget,
    duplicateTarget,
    linkTarget,
    deleteTarget,
    isEditSubmitting,
    isDuplicating,
    isLinking,
    isDeleting,
    setEditTarget,
    setDuplicateTarget,
    setLinkTarget,
    setDeleteTarget,
    handleEditSubmit,
    handleDuplicateSubmit,
    handleLinkSubmit,
    handleUnlinkSubmit,
    handleDeleteConfirm,
    restoreCalendar,
    permanentDeleteCalendar,
    refreshCalendarSources,
  };
}
