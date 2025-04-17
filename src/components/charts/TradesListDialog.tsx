import React from 'react';
import {
  Typography,
  Box
} from '@mui/material';
import { Trade } from '../../types/trade';
import TradeList from '../trades/TradeList';
import { BaseDialog } from '../common';

interface TradesDialogProps {
  open: boolean;
  trades: Trade[];
  date: string;
  expandedTradeId: string | null;
  onClose: () => void;
  onTradeExpand: (tradeId: string) => void;
  onZoomImage: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
}

const TradesListDialog: React.FC<TradesDialogProps> = ({
  open,
  trades,
  date,
  expandedTradeId,
  onClose,
  onTradeExpand,
  onZoomImage
}) => {
  const dialogTitle = (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <Typography variant="h6">
        {trades.length} {trades.length === 1 ? 'Trade' : 'Trades'} for {date}
      </Typography>
    </Box>
  );

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={dialogTitle}
    >
        <TradeList
          sx={{ mt: 0 }}
          trades={trades}
          expandedTradeId={expandedTradeId}
          onTradeClick={onTradeExpand}
          onEditClick={() => {}} // No-op function since we don't want edit functionality
          onDeleteClick={() => {}} // No-op function since we don't want delete functionality
          onZoomedImage={onZoomImage}
          hideActions={true} // New prop to hide edit/delete buttons
        />
    </BaseDialog>
  );
};

export default TradesListDialog;
