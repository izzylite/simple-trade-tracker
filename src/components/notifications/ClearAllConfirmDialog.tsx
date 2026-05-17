import React from 'react';
import ConfirmationDialog from '../common/ConfirmationDialog';

interface ClearAllConfirmDialogProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const ClearAllConfirmDialog: React.FC<ClearAllConfirmDialogProps> = ({
  open,
  count,
  onCancel,
  onConfirm,
}) => {
  const title =
    count === 1 ? 'Clear 1 notification?' : `Clear all ${count} notifications?`;

  return (
    <ConfirmationDialog
      open={open}
      title={title}
      message="This removes them from your inbox. Already-fired reminders stay in their conversation threads."
      confirmText="Clear all"
      cancelText="Cancel"
      confirmColor="error"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default ClearAllConfirmDialog;
