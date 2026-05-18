import React from 'react';
import { Calendar } from '../../types/calendar';
import CalendarFormDialog, { CalendarFormData } from '../CalendarFormDialog';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import { DuplicateCalendarDialog } from '../dialogs/DuplicateCalendarDialog';
import { CalendarLinkDialog } from '../dialogs/CalendarLinkDialog';
import { CalendarPanelActions } from '../../hooks/useCalendarPanelActions';

interface CalendarManagementDialogsProps {
  /** Object returned from useCalendarPanelActions. */
  actions: CalendarPanelActions;
  /** All user calendars — required for the link dialog's target picker. */
  userCalendars: Calendar[];
  /** Optional copy override for the delete confirmation message. */
  deleteMessage?: string;
}

/**
 * Renders all four calendar-management dialogs (edit, duplicate, link, delete)
 * driven by useCalendarPanelActions state. Designed to be dropped once into
 * the page and stay invisible until a target is set on the actions hook.
 */
const CalendarManagementDialogs: React.FC<CalendarManagementDialogsProps> = ({
  actions,
  userCalendars,
  deleteMessage = 'Move this calendar to trash? You can restore it within 30 days.',
}) => {
  const {
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
  } = actions;

  // CalendarFormDialog expects a non-async submit; wrap to discard the
  // promise so its internal `await onSubmit(...)` typing stays happy.
  const onEditSubmit = async (data: CalendarFormData) => {
    await handleEditSubmit(data);
  };

  return (
    <>
      <CalendarFormDialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSubmit={onEditSubmit}
        initialData={editTarget || undefined}
        isSubmitting={isEditSubmitting}
        mode="edit"
        title="Edit Calendar"
        submitButtonText="Save"
      />

      <DuplicateCalendarDialog
        open={Boolean(duplicateTarget)}
        calendar={duplicateTarget}
        isDuplicating={isDuplicating}
        onClose={() => setDuplicateTarget(null)}
        onDuplicate={handleDuplicateSubmit}
      />

      <CalendarLinkDialog
        open={Boolean(linkTarget)}
        calendar={linkTarget}
        calendars={userCalendars}
        isLoading={isLinking}
        onClose={() => setLinkTarget(null)}
        onLink={handleLinkSubmit}
        onUnlink={handleUnlinkSubmit}
      />

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Calendar"
        message={deleteMessage}
        confirmText="Delete"
        cancelText="Cancel"
        isSubmitting={isDeleting}
        confirmColor="error"
      />
    </>
  );
};

export default CalendarManagementDialogs;
