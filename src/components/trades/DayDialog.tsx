import React, { useState } from 'react';
import {
  Box,
  Snackbar,
  Alert
} from '@mui/material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade } from '../../types/trade';
import { BaseDialog, ConfirmationDialog } from '../common';
import { DayHeader, TradeList } from './';
import { calculateCumulativePnL, startOfNextDay } from './TradeFormDialog';
interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  accountBalance: number;
  onDateChange: (date: Date) => void;
  showAddForm: (ediTrade?: Trade | null) => void;
  onDeleteTrade: (tradeId: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  allTrades?: Trade[];
  calendarId: string;
}



  

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  accountBalance,
  onDeleteTrade,
  showAddForm,
  onDateChange,
  onUpdateTradeProperty,
  setZoomedImage,
  allTrades = [],
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
        primaryButtonText={'Add Trade'}
        primaryButtonAction={() => handleAddClick()
        } 
        hideFooterCancelButton={false}
      >
        <Box sx={{ p: 3 }}>

          <DayHeader
            title={format(date, 'EEEE, MMMM d, yyyy')}
            accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
            formInputVisible={false}
            totalPnL={trades.reduce((sum, trade) => sum + trade.amount, 0)}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          <TradeList
            trades={trades}
            expandedTradeId={expandedTradeId}
            onTradeClick={handleTradeClick}
            onEditClick={handleEditClick}
            onDeleteClick={onDeleteTrade}
            onZoomedImage={setZoomedImage}
            onUpdateTradeProperty={onUpdateTradeProperty}
          />
        </Box>
      </BaseDialog>

     
    </>

  );
};

export default DayDialog;


