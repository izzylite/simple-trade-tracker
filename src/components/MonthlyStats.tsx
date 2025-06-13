import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  alpha,
  Button,
  Tooltip,
  Snackbar,
  Alert,
  AlertColor,
  DialogContent,
  DialogActions,
  DialogTitle,
  Dialog
} from '@mui/material';
import {
  TrendingUp,
  FileDownload,
  FileUpload,
  EmojiEvents,
  CalendarMonth
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { exportTrades, importTrades } from '../utils/tradeExportImport';
import { formatCurrency } from '../utils/formatters';
import { calculatePercentageOfValueAtDate } from '../utils/dynamicRiskUtils';



interface MonthlyStatsProps {
  trades: Trade[];
  accountBalance: number;
  onImportTrades?: (trades: Trade[]) => void;
  onDeleteTrade?: (id: string) => void;
  currentDate?: Date;
  monthlyTarget?: number;
  onClearMonthTrades?: (month: number, year: number) => void;
}


const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  trades,
  accountBalance,
  onImportTrades,
  onDeleteTrade,
  currentDate = new Date(),
  monthlyTarget,
  onClearMonthTrades
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const monthTrades = trades.filter(trade =>
    new Date(trade.date).getMonth() === currentDate.getMonth() &&
    new Date(trade.date).getFullYear() === currentDate.getFullYear()
  );

  // Calculate monthly values from the filtered trades
  const netAmountForThisMonth = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : '0';

  // Calculate growth percentage using account value at start of month (excluding current month trades)
  const startOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const growthPercentage = trades
    ? calculatePercentageOfValueAtDate(netAmountForThisMonth, accountBalance, trades, startOfCurrentMonth).toFixed(1)
    : accountBalance > 0 ? ((netAmountForThisMonth / accountBalance) * 100).toFixed(2) : '0';

  // Calculate account value at start of month for display
  const tradesBeforeMonth = trades.filter(trade => new Date(trade.date) < startOfCurrentMonth);
  const accountValueAtStartOfMonth = accountBalance + tradesBeforeMonth.reduce((sum, trade) => sum + trade.amount, 0);
  

  // Calculate monthly target progress
  const targetProgress = monthlyTarget && monthlyTarget > 0 ? Math.min((parseFloat(growthPercentage) / monthlyTarget * 100),100).toFixed(0) : '0';
  const isTargetMet = monthlyTarget ? parseFloat(growthPercentage) >= monthlyTarget : false;

  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  const handleExport = () => {
    if (trades.length === 0) {
      return;
    }
    exportTrades(trades, accountBalance, exportFormat);
  };

  const toggleExportFormat = () => {
    setExportFormat(prev => prev === 'xlsx' ? 'csv' : 'xlsx');
  };

  const [isImporting, setIsImporting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>('success');

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportTrades) return;

    setIsImporting(true);

    try {
      const importedTrades = await importTrades(file);
      onImportTrades(importedTrades);

      // Show success message
      setSnackbarMessage(`Successfully imported ${importedTrades.length} trades`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Import failed:', error);

      // Show error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during import';
      setSnackbarMessage(`Error importing trades: ${errorMessage}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setIsImporting(false);
    }

    // Reset the input
    event.target.value = '';
  };

  const handleClearClick = () => {
    setShowClearConfirm(true);
  };

  const handleClearConfirm = () => {
    if (onClearMonthTrades) {
      onClearMonthTrades(currentDate.getMonth(), currentDate.getFullYear());
    }
    setShowClearConfirm(false);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 2,
          position: 'relative',
          width: '100%',
          pb: { xs: 5, sm: 2.5 },
          overflow: 'hidden'
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, pl: 0.5 }}>
            Monthly Performance
          </Typography>

          <Box sx={{
            position: { xs: 'absolute', sm: 'static' },
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 1,
            justifyContent: { xs: 'center', sm: 'flex-end' },
            mt: { xs: 2, sm: 0 },
            flex: 1,
            alignItems: 'flex-start'
          }}>
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              id="import-file"
              onChange={handleImport}
            />
            <Tooltip title="Import trades from Excel or CSV. Custom columns will be converted to tags (e.g., 'Strategy: Breakout' becomes 'Strategy:Breakout' tag)">
              <label htmlFor="import-file">
                <Button
                  component="span"
                  size="small"
                  variant="outlined"
                  startIcon={<FileUpload />}
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    minWidth: 'auto',
                    p: 0.5,
                    px: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'text.primary',
                      borderColor: 'text.primary'
                    }
                  }}
                >
                  Import
                </Button>
              </label>
            </Tooltip>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownload />}
                onClick={handleExport}
                disabled={monthTrades.length === 0}
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  minWidth: 'auto',
                  p: 0.5,
                  px: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                    borderColor: 'text.primary'
                  },
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                    bgcolor: 'action.disabledBackground',
                    borderColor: 'divider'
                  }
                }}
              >
                Export {exportFormat.toUpperCase()}
              </Button>
              <Tooltip title={`Switch to ${exportFormat === 'xlsx' ? 'CSV' : 'Excel'} format`}>
                <IconButton
                  size="small"
                  onClick={toggleExportFormat}
                  disabled={monthTrades.length === 0}
                  sx={{ ml: 0.5 }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {exportFormat === 'xlsx' ? 'CSV' : 'XLS'}
                  </Typography>
                </IconButton>
              </Tooltip>
            </Box>

            <Button
              size="small"
              variant="outlined"
              onClick={handleClearClick}
              disabled={monthTrades.length === 0}
              sx={{
                color: 'error.main',
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                minWidth: 'auto',
                p: 0.5,
                px: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                  borderColor: 'error.main'
                },
                '&.Mui-disabled': {
                  color: 'text.disabled',
                  bgcolor: 'action.disabledBackground',
                  borderColor: 'divider'
                }
              }}
            >
              Clear Month
            </Button>
          </Box>
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          mb: 2
        }}>
          {/* Monthly P&L Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <TrendingUp sx={{ fontSize: '1.2rem', color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Monthly P&L
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.primary',
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.5
              }}
            >
              {formatCurrency(netAmountForThisMonth)}
              <Tooltip
                title={`Percentage calculated based on account value at start of ${format(currentDate, 'MMMM')}: ${formatCurrency(accountValueAtStartOfMonth)} (excluding this month's trades for consistent comparison)`}
                placement="top"
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: '1rem',
                    color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.primary',
                    fontWeight: 600,
                    cursor: 'help'
                  }}
                >
                  ({growthPercentage}%)
                </Typography>
              </Tooltip>
            </Typography>
            <Typography variant="body2" sx={{
              fontWeight: 500,
              color: 'text.secondary',
              mt: 0.5,
              fontSize: '0.875rem'
            }}>
              Started with {formatCurrency(accountValueAtStartOfMonth)}
            </Typography>
            {monthlyTarget && (
              <Box sx={{ width: '100%', mt: 1.5 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                    Target Progress
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontWeight: 600,
                    color: isTargetMet ? 'success.main' : 'primary.main'
                  }}>
                    {targetProgress}%
                  </Typography>
                </Box>
                <Box sx={{
                  width: '100%',
                  height: '8px',
                  bgcolor: theme => alpha(theme.palette.divider, 0.5),
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <Box sx={{
                    width: `${Math.max(Math.min(parseFloat(targetProgress), 100), 0)}%`,
                    height: '100%',
                    bgcolor: isTargetMet ? 'success.main' : 'primary.main',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Win Rate Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <EmojiEvents sx={{ fontSize: '1.2rem', color: parseFloat(winRate) > 50 ? 'success.main' : 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Win Rate
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: parseFloat(winRate) > 50 ? 'success.main' : 'text.primary' }}>
              {winRate}%
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.5 }}>
              {winCount} Wins / {lossCount} Losses
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 1,
              gap: 1
            }}>
              <Box sx={{
                height: '10px',
                bgcolor: 'success.main',
                borderRadius: '5px',
                flex: winCount || 1
              }} />
              <Box sx={{
                height: '10px',
                bgcolor: 'error.main',
                borderRadius: '5px',
                flex: lossCount || 1
              }} />
            </Box>
          </Box>

          {/* Total Trades Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <CalendarMonth sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Trading Activity
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {monthTrades.length} Trade{monthTrades.length === 1 ? '' : 's'}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.5 }}>
              {monthTrades.length > 0 ? (monthTrades.length / 30 * 100).toFixed(0) : 0}% of Month Active
            </Typography>
          </Box>
        </Box>

      </Paper>

      
      <Dialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Trades</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all trades? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearConfirm(false)}>Cancel</Button>
          <Button onClick={handleClearConfirm} color="error">Clear</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for import notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={snackbarSeverity === 'success' ? 3000 : 6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default MonthlyStats;
