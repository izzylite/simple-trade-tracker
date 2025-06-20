import React from 'react';
import {
  Typography,
  Box,
  Button,
  Tooltip
} from '@mui/material';
import {
  ViewCarousel as GalleryIcon
} from '@mui/icons-material';
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
 onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onZoomImage: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  accountBalance: number;
  allTrades: Trade[];
  onEditClick?: (trade: Trade) => void;
  onDeleteClick?: (tradeId: string) => void;
  onDeleteMultiple?: (tradeIds: string[]) => void;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  calendarId?: string;
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
  onUpdateTradeProperty,
  onEditClick,
  onDeleteClick,
  onDeleteMultiple,
  onOpenGalleryMode,
  calendarId
}) => {

  // Gallery mode handler
  const handleGalleryModeClick = () => {
    if (onOpenGalleryMode && trades.length > 0) {
      const title = `${date} - ${trades.length} Trade${trades.length > 1 ? 's' : ''}`;
      onOpenGalleryMode(trades, expandedTradeId || trades[0].id, title);
      onClose(); // Close the dialog when opening gallery mode
    }
  };

  // Calculate total PnL from trades
  const totalPnL = React.useMemo(() => {
    return trades.reduce((sum, trade) => sum + trade.amount, 0);
  }, [trades]);
  const dialogTitle = (
    <Typography variant="h6">
      {trades.length} {trades.length === 1 ? 'Trade' : 'Trades'} for {date}
    </Typography>
  );

  // Custom actions for the dialog
  const dialogActions = onOpenGalleryMode && trades.length > 0 ? (
    <Tooltip title="View trades in gallery mode">
      <Button
        variant="contained"
        size="large"
        startIcon={<GalleryIcon />}
        onClick={handleGalleryModeClick}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 1.5,
          px: 3
        }}
      >
        Gallery View
      </Button>
    </Tooltip>
  ) : undefined;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={dialogTitle}
      actions={dialogActions}
    >
      <Box sx={{ p: 2 }}>
        {/* DayHeader with navigation buttons hidden */}
        <DayHeader
          title={''}
          accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
          formInputVisible={true} // Set to true to hide navigation buttons
          totalPnL={totalPnL}
          onPrevDay={() => { }} // Empty function since we're hiding the buttons
          onNextDay={() => { }} // Empty function since we're hiding the buttons
        />

        <TradeList
          sx={{ mt: 0 }}
          trades={trades}
          expandedTradeId={expandedTradeId}
          onTradeClick={onTradeExpand}
          onEditClick={onEditClick || (() => { })} // Use provided handler or no-op
          onDeleteClick={onDeleteClick || (() => { })} // Use provided handler or no-op
          onDeleteMultiple={onDeleteMultiple}
          onZoomedImage={onZoomImage}
          onUpdateTradeProperty={onUpdateTradeProperty}
          hideActions={!onEditClick && !onDeleteClick} // Hide actions only if both handlers are not provided
          enableBulkSelection={trades.length > 1 && !!onDeleteMultiple} // Enable bulk selection when there are multiple trades and handler is provided
          calendarId={calendarId}
          onOpenGalleryMode={onOpenGalleryMode}
        />
      </Box>
    </BaseDialog>
  );
};

export default TradesListDialog;
