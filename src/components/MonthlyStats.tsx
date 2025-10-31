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
  Dialog,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  TrendingUp,
  FileDownload,
  FileUpload,
  EmojiEvents,
  CalendarMonth,
  Analytics,
  TrendingDown,
  ShowChart,
  Balance,
  MoreVert,
  Delete
} from '@mui/icons-material';
import { Trade } from '../types/dualWrite';
import { exportTrades } from '../utils/tradeExportImport';
import { formatCurrency } from '../utils/formatters';
import { calculatePercentageOfValueAtDate } from '../utils/dynamicRiskUtils';
import { calculateTargetProgress } from '../utils/statsUtils';
import { error } from '../utils/logger';
import { ImportMappingDialog } from './import/ImportMappingDialog';



interface MonthlyStatsProps {
  trades: Trade[];
  accountBalance: number;
  onImportTrades?: (trades: Trade[]) => Promise<void>;
  onDeleteTrade?: (id: string) => void;
  currentDate?: Date;
  monthlyTarget?: number;
  onClearMonthTrades?: (month: number, year: number) => void;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}


const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  trades,
  accountBalance,
  onImportTrades,
  onDeleteTrade,
  currentDate = new Date(),
  monthlyTarget,
  onClearMonthTrades,
  isReadOnly = false
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const monthTrades = trades.filter(trade =>
    new Date(trade.trade_date).getMonth() === currentDate.getMonth() &&
    new Date(trade.trade_date).getFullYear() === currentDate.getFullYear()
  );

  // Calculate monthly values from the filtered trades
  const netAmountForThisMonth = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.trade_type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.trade_type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : '0';

  // Additional useful statistics
  const totalWinAmount = monthTrades.filter(trade => trade.trade_type === 'win').reduce((sum, trade) => sum + trade.amount, 0);
  const totalLossAmount = Math.abs(monthTrades.filter(trade => trade.trade_type === 'loss').reduce((sum, trade) => sum + trade.amount, 0));
  const profitFactor = totalLossAmount > 0 ? (totalWinAmount / totalLossAmount).toFixed(2) : totalWinAmount > 0 ? '∞' : '0';
  const averageTradeSize = monthTrades.length > 0 ? (Math.abs(netAmountForThisMonth) / monthTrades.length).toFixed(0) : '0';
  const averageWin = winCount > 0 ? (totalWinAmount / winCount).toFixed(0) : '0';
  const averageLoss = lossCount > 0 ? (totalLossAmount / lossCount).toFixed(0) : '0';

  // Best and worst day calculations
  const dailyPnL = new Map<string, number>();
  monthTrades.forEach(trade => {
    const dateKey = new Date(trade.trade_date).toDateString();
    dailyPnL.set(dateKey, (dailyPnL.get(dateKey) || 0) + trade.amount);
  });

  let bestDay = 0;
  let bestDayDate = '';
  let worstDay = 0;
  let worstDayDate = '';

  if (dailyPnL.size > 0) {
    const entries = Array.from(dailyPnL.entries());
    const bestEntry = entries.reduce((max, current) => current[1] > max[1] ? current : max);
    const worstEntry = entries.reduce((min, current) => current[1] < min[1] ? current : min);

    bestDay = bestEntry[1];
    bestDayDate = format(new Date(bestEntry[0]), 'EEE d');
    worstDay = worstEntry[1];
    worstDayDate = format(new Date(worstEntry[0]), 'EEE d');
  }

  // Calculate growth percentage using account value at start of month (excluding current month trades)
  const startOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const growthPercentage = trades
    ? calculatePercentageOfValueAtDate(netAmountForThisMonth, accountBalance, trades, startOfCurrentMonth).toFixed(1)
    : accountBalance > 0 ? ((netAmountForThisMonth / accountBalance) * 100).toFixed(2) : '0';

  // Calculate account value at start of month for display
  const tradesBeforeMonth = trades.filter(trade => new Date(trade.trade_date) < startOfCurrentMonth);
  const accountValueAtStartOfMonth = accountBalance + tradesBeforeMonth.reduce((sum, trade) => sum + trade.amount, 0);


  // Calculate monthly target progress using centralized function
  const targetProgressValue = monthlyTarget && monthlyTarget > 0
    ? calculateTargetProgress(monthTrades, accountBalance, monthlyTarget, startOfCurrentMonth, trades)
    : 0;
  const targetProgress = targetProgressValue.toFixed(0);
  const isTargetMet = monthlyTarget ? parseFloat(growthPercentage) >= monthlyTarget : false;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (monthTrades.length === 0) {
      return;
    }
    exportTrades(trades, accountBalance, format);
    handleMenuClose();
  };

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>('success');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportTrades) return;

    handleMenuClose();
    setSelectedFile(file);
    setShowImportDialog(true);

    // Reset the input
    event.target.value = '';
  };

  const handleImportComplete = async (importedTrades: Partial<Trade>[]) => {
    if (!onImportTrades) return;

    try {
      // Add required fields that might be missing
      const completeTrades = importedTrades.map(trade => ({
        ...trade,
        id: trade.id || crypto.randomUUID(),
        calendar_id: trade.calendar_id || '',
        user_id: trade.user_id || '',
        created_at: trade.created_at || new Date(),
        updated_at: trade.updated_at || new Date()
      })) as Trade[];

      // Wait for import to complete before closing dialog
      await onImportTrades(completeTrades);

      // Show success message
      setSnackbarMessage(`Successfully imported ${completeTrades.length} trades`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Close dialog only after import completes
      setShowImportDialog(false);
      setSelectedFile(null);
    } catch (error) {
      // Show error message if import fails
      setSnackbarMessage('Failed to import trades. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleClearClick = () => {
    handleMenuClose();
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
          overflow: 'hidden',
          height: '100%',
          minHeight: '320px'
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
            mb: 2,
            flex: 1,
            alignItems: 'flex-start'
          }}>
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              id="import-file"
              onChange={handleFileSelect}
            />
            <Tooltip title="More options">
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                sx={{
                  color: 'text.secondary',
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
                <MoreVert />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              {!isReadOnly && (
                <MenuItem onClick={() => document.getElementById('import-file')?.click()}>
                  <ListItemIcon>
                    <FileUpload fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Import Trades</ListItemText>
                </MenuItem>
              )}
              <MenuItem
                onClick={() => handleExport('xlsx')}
                disabled={monthTrades.length === 0}
              >
                <ListItemIcon>
                  <FileDownload fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export XLSX</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => handleExport('csv')}
                disabled={monthTrades.length === 0}
              >
                <ListItemIcon>
                  <FileDownload fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export CSV</ListItemText>
              </MenuItem>
              {!isReadOnly && (
                <MenuItem
                  onClick={handleClearClick}
                  disabled={monthTrades.length === 0}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <Delete fontSize="small" sx={{ color: 'error.main' }} />
                  </ListItemIcon>
                  <ListItemText>Clear Month</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 1.5, 
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

          {/* Starting Capital Card */}
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
              Started With
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1rem' }}>
              {formatCurrency(accountValueAtStartOfMonth)}
            </Typography>
          </Box>

          {/* Best Day Card */}
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
              Best Day {bestDayDate && (
                <Typography component="span" sx={{ color: 'secondary.main', fontWeight: 700, fontSize: '0.65rem' }}>
                  {bestDayDate}
                </Typography>
              )}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main', fontSize: '1rem' }}>
              {bestDay > 0 ? formatCurrency(bestDay) : 'No trades'}
            </Typography>
          </Box>

          {/* Profit Factor Card */}
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
              Profit Factor
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: parseFloat(profitFactor) > 1 ? 'success.main' : 'text.primary', fontSize: '1rem' }}>
              {profitFactor}
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

      <ImportMappingDialog
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          setSelectedFile(null);
        }}
        onImport={handleImportComplete}
        file={selectedFile}
      />
    </>
  );
};

export default MonthlyStats;
