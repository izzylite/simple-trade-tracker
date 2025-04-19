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
  showAddForm,
  onDateChange,
  onUpdateTradeProperty,
  setZoomedImage,
  allTrades = [],
}) => {

  // State

  
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  


  
 

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




  // Function to show error messages in a Snackbar
  const showErrorSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // Function to handle Snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
 


  const handleEditClick = (trade: Trade) => {
    showAddForm(trade);

  };


  const handleDeleteClick = (tradeId: string) => {

    setTradeToDelete(tradeId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (tradeToDelete) {
      setIsDeleting(true);
      try {
        if (onUpdateTradeProperty) {
          await onUpdateTradeProperty(tradeToDelete, (trade) => ({ ...trade, isDeleted: true }));
        }
      } catch (error) {
        console.error('Error deleting trade:', error);
        showErrorSnackbar('Failed to delete trade. Please try again.');
      } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setTradeToDelete(null);
      }
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setTradeToDelete(null);
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
            onDeleteClick={handleDeleteClick}
            onZoomedImage={setZoomedImage}
            onUpdateTradeProperty={onUpdateTradeProperty}
          />
        </Box>
      </BaseDialog>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title="Delete Trade"
        message="Are you sure you want to delete this trade? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isSubmitting={isDeleting}
        confirmColor="error"
      />

      {/* Snackbar for error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>

  );
};

export default DayDialog;


