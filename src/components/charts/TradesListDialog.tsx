import React from 'react';
import {
  Typography,
  Box
} from '@mui/material';
import { Trade } from '../../types/trade';
import TradeList from '../trades/TradeList';
import { BaseDialog } from '../common';
import DayHeader from '../trades/DayHeader'; 
import { calculateCumulativePnL, startOfNextDay } from '../trades/TradeFormDialog';

interface TradesDialogProps {
  open: boolean;
  trades: Trade[];
  date: string;
  expandedTradeId: string | null;
  onClose: () => void;
  onTradeExpand: (tradeId: string) => void;
  onZoomImage: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  accountBalance: number;
  allTrades: Trade[];
  onEditClick?: (trade: Trade) => void;
  onDeleteClick?: (tradeId: string) => void;
}

const TradesListDialog: React.FC<TradesDialogProps> = ({
  open,
  trades,
  date,
  expandedTradeId,
  onClose,
  onTradeExpand,
  onZoomImage,
  accountBalance,
  allTrades,
  onEditClick,
  onDeleteClick
}) => {
   

  const dateObj = React.useMemo(() => {
    try {
      // Try to parse the date string
      if (typeof date === 'string') {
        if (date.includes('/')) {
          // Handle MM/DD or MM/DD/YYYY format
          return new Date(date);
        } else {
          // For other formats, just create a new date
          return new Date();
        }
      } else {
        // If it's not a string, return a new date
        return new Date();
      }
    } catch (e) {
      console.error('Error parsing date:', e);
      return new Date();
    }
  }, [date]);

  // Calculate total PnL from trades
  const totalPnL = React.useMemo(() => {
    return trades.reduce((sum, trade) => sum + trade.amount, 0);
  }, [trades]);
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
      <Box sx={{ p: 2 }}>
        {/* DayHeader with navigation buttons hidden */}
        <DayHeader
          title={''}
          accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay(date),allTrades)}
          formInputVisible={true} // Set to true to hide navigation buttons
          totalPnL={totalPnL}
          onPrevDay={() => {}} // Empty function since we're hiding the buttons
          onNextDay={() => {}} // Empty function since we're hiding the buttons
        />

        <TradeList
          sx={{ mt: 0 }}
          trades={trades}
          expandedTradeId={expandedTradeId}
          onTradeClick={onTradeExpand}
          onEditClick={onEditClick || (() => {})} // Use provided handler or no-op
          onDeleteClick={onDeleteClick || (() => {})} // Use provided handler or no-op
          onZoomedImage={onZoomImage}
          hideActions={!onEditClick && !onDeleteClick} // Hide actions only if both handlers are not provided
        />
      </Box>
    </BaseDialog>
  );
};

export default TradesListDialog;
