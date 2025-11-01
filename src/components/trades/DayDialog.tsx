import React, { useState } from 'react';
import {
  Box,
  Button,
  Tooltip
} from '@mui/material';
import { ViewCarousel as GalleryIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade, Calendar } from '../../types/dualWrite';
import { BaseDialog } from '../common';
import { DayHeader, TradeList, ProgressSection } from './';
import { calculateCumulativePnL, startOfNextDay } from './TradeFormDialog';
interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  account_balance: number;
  onDateChange: (date: Date) => void;
  showAddForm: (ediTrade?: Trade | null) => void;
  onDeleteTrade: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  allTrades?: Trade[];
  calendarId: string;
  deletingTradeIds?: string[];
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering and progress tracking
  calendar?: Calendar;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}



  

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  account_balance,
  onDeleteTrade,
  onDeleteMultipleTrades,
  showAddForm,
  onDateChange,
  onUpdateTradeProperty,
  setZoomedImage,
  allTrades = [],
  calendarId,
  deletingTradeIds,
  onOpenGalleryMode,
  calendar,
  isReadOnly = false
}) => {

  // State

  
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  
 

  // Handlers
  const handlePrevDay = () => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  };
  
  const handleNextDay = () => {
    const nextDay = startOfNextDay(date);
    // Don't allow navigating to future dates
    if (!isAfter(nextDay, startOfDay(new Date()))) {
      onDateChange(nextDay);
    }
  };

  const handleTradeClick = (tradeId: string) => {
    setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
  };

  const handleAddClick = async () => {
    showAddForm(null);
  };
 


  const handleEditClick = (trade: Trade) => {
    showAddForm(trade);
  };

  const handleGalleryModeClick = () => {
    if (onOpenGalleryMode && trades.length > 0) {
      const title = `${format(date, 'EEEE, MMMM d, yyyy')} - ${trades.length} Trade${trades.length > 1 ? 's' : ''}`;
      onOpenGalleryMode(trades, expandedTradeId || trades[0].id, title);
      onClose(); // Close the day dialog when opening gallery mode
    }
  };


   
   

  return (
    <>
      <BaseDialog
        open={open}
        onClose={() => {
          // Only allow closing if we're not in the process of creating an empty trade
          onClose();
        }}
        title="Daily Trades"
        maxWidth="md"
        fullWidth
        hideCloseButton={false}
        primaryButtonText={isReadOnly ? undefined : 'Add Trade'}
        primaryButtonAction={isReadOnly ? undefined : () => handleAddClick()}
        hideFooterCancelButton={false}
        actions={
          onOpenGalleryMode && trades.length > 0 ? (
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
        <Box sx={{ p: 3 }}>

          <DayHeader
            title={format(date, 'EEEE, MMMM d, yyyy')}
            account_balance={account_balance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
            formInputVisible={false}
            total_pnl={trades.reduce((sum, trade) => sum + trade.amount, 0)}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          <ProgressSection
            allTrades={allTrades}
            currentBalance={account_balance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
            currentDate={date}
            calendar={calendar}
          />

          <TradeList
            trades={trades}
            expandedTradeId={expandedTradeId}
            onTradeClick={handleTradeClick}
            onEditClick={handleEditClick}
            onDeleteClick={onDeleteTrade}
            onDeleteMultiple={onDeleteMultipleTrades}
            onZoomedImage={setZoomedImage}
            onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
            hideActions={isReadOnly} // Hide edit/delete actions in read-only mode
            enableBulkSelection={isReadOnly ? false : trades.length > 1} // Disable bulk selection in read-only mode
            deletingTradeIds={deletingTradeIds}
            calendarId={calendarId}
            calendar={calendar}
          />
        </Box>
      </BaseDialog>

     
    </>

  );
};

export default DayDialog;


