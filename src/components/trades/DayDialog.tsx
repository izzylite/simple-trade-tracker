import React, { useCallback } from 'react';
import {
  Button,
  Tooltip
} from '@mui/material';
import { ViewCarousel as GalleryIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { BaseDialog } from '../common';
import { DayTradesContent, DayTradesContentProps } from '../sidePanel/content/DayTradesContent';

interface DayDialogProps extends DayTradesContentProps {
  open: boolean;
  onClose: () => void;
}

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  const { tradeOperations, trades, date, showAddForm } = contentProps;
  const { onOpenGalleryMode, isReadOnly = false } = tradeOperations;
  const tradesLength = trades?.length || 0;

  const handleAddClick = useCallback(async () => {
    showAddForm(null);
  }, [showAddForm]);

  const handleGalleryModeClick = useCallback(() => {
    if (onOpenGalleryMode && trades && trades.length > 0) {
      const title = `${format(date, 'EEEE, MMMM d, yyyy')} - ${trades.length} Trade${trades.length > 1 ? 's' : ''}`;
      onOpenGalleryMode(trades, trades[0].id, title);
      onClose();
    }
  }, [onOpenGalleryMode, trades, date, onClose]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Daily Trades"
      maxWidth="md"
      fullWidth
      hideCloseButton={false}
      primaryButtonText={isReadOnly ? undefined : 'Add Trade'}
      primaryButtonAction={isReadOnly ? undefined : () => handleAddClick()}
      hideFooterCancelButton={false}
      actions={
        onOpenGalleryMode && tradesLength > 0 ? (
          <Tooltip title="View trades in gallery mode">
            <Button
              variant="outlined"
              startIcon={<GalleryIcon />}
              onClick={handleGalleryModeClick}
              sx={{ mr: 1 }}
            >
              Gallery View
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <DayTradesContent {...contentProps} isActive={open} />
    </BaseDialog>
  );
};

export default DayDialog;
