import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  alpha,
  Container,
  Stack,
  Divider,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { 
  Add as AddIcon, 
  CalendarToday as CalendarIcon,
  Delete as DeleteIcon,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  Edit as EditIcon,
  TrendingDown,
  Update,
  InfoOutlined,
  BarChart as ChartIcon
} from '@mui/icons-material';
import { format, startOfWeek, startOfMonth, startOfYear, addMonths, subMonths, eachMonthOfInterval, startOfYear as getStartOfYear, endOfYear as getEndOfYear, endOfMonth, isSameWeek, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { formatCurrency } from '../utils/tradeUtils';
import { dialogProps } from '../styles/dialogStyles';
import PerformanceCharts from './PerformanceCharts';
import SelectDateDialog from './SelectDateDialog';

interface CalendarHomeProps {
  calendars: Calendar[];
  onCreateCalendar: (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
}

export const CalendarHome: React.FC<CalendarHomeProps> = ({ 
  calendars, 
  onCreateCalendar, 
  onDeleteCalendar,
  onUpdateCalendar
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newMaxDrawdown, setNewMaxDrawdown] = useState('');
  const [newWeeklyTarget, setNewWeeklyTarget] = useState('');
  const [newMonthlyTarget, setNewMonthlyTarget] = useState('');
  const [newYearlyTarget, setNewYearlyTarget] = useState('');
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedCalendarForCharts, setSelectedCalendarForCharts] = useState<Calendar | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);

  const handleCreateCalendar = () => {
    if (newCalendarName.trim() && newAccountBalance.trim() && newMaxDrawdown.trim()) {
      const balance = parseFloat(newAccountBalance);
      const maxDrawdown = parseFloat(newMaxDrawdown);
      const weeklyTarget = newWeeklyTarget.trim() ? parseFloat(newWeeklyTarget) : undefined;
      const monthlyTarget = newMonthlyTarget.trim() ? parseFloat(newMonthlyTarget) : undefined;
      const yearlyTarget = newYearlyTarget.trim() ? parseFloat(newYearlyTarget) : undefined;
      
      if (!isNaN(balance) && balance >= 0 && !isNaN(maxDrawdown) && maxDrawdown > 0 &&
          (weeklyTarget === undefined || (!isNaN(weeklyTarget) && weeklyTarget > 0)) &&
          (monthlyTarget === undefined || (!isNaN(monthlyTarget) && monthlyTarget > 0)) &&
          (yearlyTarget === undefined || (!isNaN(yearlyTarget) && yearlyTarget > 0))) {
        onCreateCalendar(newCalendarName.trim(), balance, maxDrawdown, weeklyTarget, monthlyTarget, yearlyTarget);
        setNewCalendarName('');
        setNewAccountBalance('');
        setNewMaxDrawdown('');
        setNewWeeklyTarget('');
        setNewMonthlyTarget('');
        setNewYearlyTarget('');
        setIsCreateDialogOpen(false);
      }
    }
  };

  const handleEditCalendar = () => {
    if (calendarToEdit && newCalendarName.trim() && newAccountBalance.trim() && newMaxDrawdown.trim()) {
      const balance = parseFloat(newAccountBalance);
      const maxDrawdown = parseFloat(newMaxDrawdown);
      const weeklyTarget = newWeeklyTarget.trim() ? parseFloat(newWeeklyTarget) : undefined;
      const monthlyTarget = newMonthlyTarget.trim() ? parseFloat(newMonthlyTarget) : undefined;
      const yearlyTarget = newYearlyTarget.trim() ? parseFloat(newYearlyTarget) : undefined;
      
      if (!isNaN(balance) && balance >= 0 && !isNaN(maxDrawdown) && maxDrawdown > 0 &&
          (weeklyTarget === undefined || (!isNaN(weeklyTarget) && weeklyTarget > 0)) &&
          (monthlyTarget === undefined || (!isNaN(monthlyTarget) && monthlyTarget > 0)) &&
          (yearlyTarget === undefined || (!isNaN(yearlyTarget) && yearlyTarget > 0))) {
        onUpdateCalendar(calendarToEdit.id, {
          name: newCalendarName.trim(),
          accountBalance: balance,
          maxDailyDrawdown: maxDrawdown,
          weeklyTarget,
          monthlyTarget,
          yearlyTarget
        });
        resetFormFields();
        setIsEditDialogOpen(false);
      }
    }
  };

  const resetFormFields = () => {
    setNewCalendarName('');
    setNewAccountBalance('');
    setNewMaxDrawdown('');
    setNewWeeklyTarget('');
    setNewMonthlyTarget('');
    setNewYearlyTarget('');
    setCalendarToEdit(null);
  };

  const handleCalendarClick = (calendarId: string) => {
    navigate(`/calendar/${calendarId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, calendarId: string) => {
    e.stopPropagation();
    setCalendarToDelete(calendarId);
    setIsDeleteDialogOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, calendar: Calendar) => {
    e.stopPropagation();
    setCalendarToEdit(calendar);
    setNewCalendarName(calendar.name);
    setNewAccountBalance(calendar.accountBalance.toString());
    setNewMaxDrawdown(calendar.maxDailyDrawdown.toString());
    setNewWeeklyTarget(calendar.weeklyTarget?.toString() || '');
    setNewMonthlyTarget(calendar.monthlyTarget?.toString() || '');
    setNewYearlyTarget(calendar.yearlyTarget?.toString() || '');
    setIsEditDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (calendarToDelete) {
      onDeleteCalendar(calendarToDelete);
      setCalendarToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleViewCharts = (e: React.MouseEvent, calendar: Calendar) => {
    e.stopPropagation();
    setSelectedCalendarForCharts(calendar);
  };

  const handleCloseCharts = () => {
    setSelectedCalendarForCharts(null);
  };

  const handleMonthChange = (event: any) => {
    setSelectedMonth(new Date(event.target.value));
  };

  // Get available months for the selected calendar
  const availableMonths = useMemo(() => {
    if (!selectedCalendarForCharts) return [];
    
    const trades = selectedCalendarForCharts.trades;
    if (trades.length === 0) return [new Date()];
    
    const dates = trades.map(trade => new Date(trade.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Create an array of months between min and max date
    const months: Date[] = [];
    let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    while (currentDate <= endDate) {
      months.push(new Date(currentDate));
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    
    return months;
  }, [selectedCalendarForCharts]);

  const getCalendarStats = (calendar: Calendar) => {
    const totalPnL = calendar.trades.reduce((sum, trade) => sum + trade.amount, 0);
    const winCount = calendar.trades.filter(trade => trade.type === 'win').length;
    const lossCount = calendar.trades.filter(trade => trade.type === 'loss').length;
    const winRate = calendar.trades.length > 0 ? (winCount / calendar.trades.length * 100).toFixed(1) : '0';
    const growthPercentage = calendar.accountBalance > 0 ? (totalPnL / calendar.accountBalance * 100).toFixed(2) : '0';
    
    // Calculate average win and loss
    const winningTrades = calendar.trades.filter(t => t.type === 'win');
    const losingTrades = calendar.trades.filter(t => t.type === 'loss');
    const avgWin = winCount > 0 ? winningTrades.reduce((sum, t) => sum + t.amount, 0) / winCount : 0;
    const avgLoss = lossCount > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0)) / lossCount : 0;
    
    // Calculate profit factor (gross profit / gross loss)
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.amount, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : winCount > 0 ? '∞' : '0';
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let runningBalance = calendar.accountBalance;
    let peakBalance = calendar.accountBalance;
    let drawdownStartDate: Date | null = null;
    let drawdownEndDate: Date | null = null;
    
    // Sort trades by date to calculate drawdown chronologically
    const sortedTrades = [...calendar.trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Track all drawdown periods
    const drawdownPeriods: Array<{
      startDate: Date;
      endDate: Date;
      startBalance: number;
      endBalance: number;
      peakBalance: number;
      drawdown: number;
    }> = [];
    
    let currentDrawdownStartDate: Date | null = null;
    let currentDrawdownStartBalance: number | null = null;
    let currentPeakBalance = calendar.accountBalance;
    
    sortedTrades.forEach(trade => {
      const tradeDate = new Date(trade.date);
      const previousBalance = runningBalance;
      runningBalance += trade.amount;
      
      // Check if we're entering a drawdown
      if (runningBalance < currentPeakBalance && currentDrawdownStartDate === null) {
        currentDrawdownStartDate = tradeDate;
        currentDrawdownStartBalance = previousBalance;
      }
      
      // Check if we've recovered from drawdown
      if (runningBalance >= currentPeakBalance && currentDrawdownStartDate !== null) {
        // Record this drawdown period
        drawdownPeriods.push({
          startDate: currentDrawdownStartDate,
          endDate: tradeDate,
          startBalance: currentDrawdownStartBalance!,
          endBalance: runningBalance,
          peakBalance: currentPeakBalance,
          drawdown: ((currentPeakBalance - runningBalance) / currentPeakBalance) * 100
        });
        
        // Reset drawdown tracking
        currentDrawdownStartDate = null;
        currentDrawdownStartBalance = null;
      }
      
      // Update peak if we have a new high
      if (runningBalance > currentPeakBalance) {
        currentPeakBalance = runningBalance;
      }
      
      // Calculate current drawdown from peak
      const currentDrawdown = ((currentPeakBalance - runningBalance) / currentPeakBalance) * 100;
      
      // Update max drawdown if current drawdown is larger
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
        drawdownEndDate = tradeDate;
        drawdownStartDate = currentDrawdownStartDate || tradeDate;
      }
    });
    
    // If we're still in a drawdown at the end, record it
    if (currentDrawdownStartDate !== null) {
      drawdownPeriods.push({
        startDate: currentDrawdownStartDate,
        endDate: new Date(sortedTrades[sortedTrades.length - 1].date),
        startBalance: currentDrawdownStartBalance!,
        endBalance: runningBalance,
        peakBalance: currentPeakBalance,
        drawdown: ((currentPeakBalance - runningBalance) / currentPeakBalance) * 100
      });
    }
    
    // Find the largest drawdown period
    const largestDrawdownPeriod = drawdownPeriods.reduce((largest, current) => 
      current.drawdown > largest.drawdown ? current : largest, 
      { startDate: new Date(), endDate: new Date(), startBalance: 0, endBalance: 0, peakBalance: 0, drawdown: 0 }
    );
    
    // Use the largest drawdown period if it exists
    if (drawdownPeriods.length > 0) {
      maxDrawdown = largestDrawdownPeriod.drawdown;
      drawdownStartDate = largestDrawdownPeriod.startDate;
      drawdownEndDate = largestDrawdownPeriod.endDate;
    }
    
    // Calculate drawdown recovery amount
    const drawdownRecoveryNeeded = maxDrawdown > 0 
      ? formatCurrency((currentPeakBalance * maxDrawdown / 100))
      : '0';
    
    // Calculate drawdown duration
    let drawdownDuration = 0;
    if (drawdownStartDate && drawdownEndDate) {
      const startTime = (drawdownStartDate as Date).getTime();
      const endTime = (drawdownEndDate as Date).getTime();
      drawdownDuration = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
    }
    
    // Calculate target progress for current periods
    const currentDate = new Date();
    const weekStartDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start from Monday
    const monthStartDate = startOfMonth(currentDate);
    const yearStartDate = startOfYear(currentDate);

    // Calculate PnL for current periods
    const currentWeekPnL = calendar.trades
      .filter(trade => {
        const tradeDate = new Date(trade.date);
        return isSameWeek(tradeDate, currentDate, { weekStartsOn: 1 });
      })
      .reduce((sum, trade) => sum + trade.amount, 0);
    
    const currentMonthPnL = calendar.trades
      .filter(trade => {
        const tradeDate = new Date(trade.date);
        return isSameMonth(tradeDate, currentDate);
      })
      .reduce((sum, trade) => sum + trade.amount, 0);
    
    const currentYearPnL = calendar.trades
      .filter(trade => {
        const tradeDate = new Date(trade.date);
        return tradeDate.getFullYear() === currentDate.getFullYear();
      })
      .reduce((sum, trade) => sum + trade.amount, 0);

    // Calculate progress percentages for current periods
    // Convert PnL to percentage of account balance
    const weeklyPnLPercentage = calendar.accountBalance > 0 ? 
      (currentWeekPnL / calendar.accountBalance) * 100 : 0;
    const monthlyPnLPercentage = calendar.accountBalance > 0 ? 
      (currentMonthPnL / calendar.accountBalance) * 100 : 0;
    const yearlyPnLPercentage = calendar.accountBalance > 0 ? 
      (currentYearPnL / calendar.accountBalance) * 100 : 0;

    // Calculate progress as percentage of target
    const weeklyProgress = calendar.weeklyTarget ? 
      ((weeklyPnLPercentage / calendar.weeklyTarget) * 100).toFixed(1) : '0';
    const monthlyProgress = calendar.monthlyTarget ? 
      ((monthlyPnLPercentage / calendar.monthlyTarget) * 100).toFixed(1) : '0';
    const yearlyProgress = calendar.yearlyTarget ? 
      ((yearlyPnLPercentage / calendar.yearlyTarget) * 100).toFixed(1) : '0';

    return { 
      totalPnL, 
      winRate, 
      totalTrades: calendar.trades.length, 
      growthPercentage,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown: maxDrawdown.toFixed(1),
      drawdownRecoveryNeeded,
      drawdownDuration,
      drawdownStartDate,
      drawdownEndDate,
      weeklyProgress,
      monthlyProgress,
      yearlyProgress,
      winCount,
      lossCount,
      initialBalance: calendar.accountBalance,
      currentBalance: runningBalance
    };
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4
      }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          My Trading Calendars
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateDialogOpen(true)}
          sx={{
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          New Calendar
        </Button>
      </Box>

      {calendars.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 8,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No calendars yet
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Create your first trading calendar to start tracking your trades
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create Calendar
          </Button>
        </Box>
      ) : (
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)'
          },
          gap: 2
        }}>
          {calendars.map(calendar => {
            const stats = getCalendarStats(calendar);
            return (
              <Card 
                key={calendar.id} 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                    '& .calendar-gradient': {
                      opacity: 1
                    }
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                  }
                }}
                onClick={() => handleCalendarClick(calendar.id)}
              >
                <Box
                  className="calendar-gradient"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.light, 0.02)})`,
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none'
                  }}
                />
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ mb: 2.5 }}>
                    <Typography 
                      variant="h6" 
                      gutterBottom
                      sx={{ 
                        fontWeight: 600,
                        color: 'text.primary',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      {calendar.name}
                      {stats.totalPnL > 0 && (
                        <TrendingUp sx={{ fontSize: '1.2rem', color: 'success.main' }} />
                      )}
                      {stats.totalPnL < 0 && (
                        <TrendingDown sx={{ fontSize: '1.2rem', color: 'error.main' }} />
                      )}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarIcon sx={{ fontSize: '1rem' }} />
                        {format(calendar.createdAt, 'MMM d, yyyy')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EditIcon sx={{ fontSize: '1rem' }} />
                        {format(calendar.lastModified, 'MMM d, yyyy')}
                      </Typography>
                    </Stack>
                  </Box>
                  <Divider sx={{ my: 2, opacity: 0.6 }} />
                  
                  <Stack spacing={2}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: stats.totalPnL > 0 
                            ? alpha(theme.palette.success.main, 0.1)
                            : stats.totalPnL < 0
                            ? alpha(theme.palette.error.main, 0.1)
                            : alpha(theme.palette.grey[500], 0.1)
                        }}
                      >
                        <TrendingUp sx={{ 
                          fontSize: '1.2rem',
                          color: stats.totalPnL > 0 
                            ? theme.palette.success.main
                            : stats.totalPnL < 0
                            ? theme.palette.error.main
                            : theme.palette.grey[500]
                        }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ 
                          color: stats.totalPnL > 0 
                            ? 'success.main'
                            : stats.totalPnL < 0
                            ? 'error.main'
                            : 'text.secondary',
                          fontWeight: 600
                        }}>
                          {formatCurrency(stats.totalPnL)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Growth: {stats.growthPercentage}%
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 2
                    }}>
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Initial Balance
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {formatCurrency(stats.initialBalance)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Current: {formatCurrency(stats.initialBalance + stats.totalPnL)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Win Rate
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {stats.winRate}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {stats.winCount}W - {stats.lossCount}L
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 2
                    }}>
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Profit Factor
                        </Typography>
                        <Tooltip
                          title={
                            <Box sx={{ p: 1, maxWidth: 300 }}>
                              <Typography variant="body2" gutterBottom>
                                Profit Factor is the ratio of gross profit to gross loss. A value greater than 1 indicates profitable trading.
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                • Value &gt; 3: Excellent
                              </Typography>
                              <Typography variant="body2">
                                • Value 2-3: Very Good
                              </Typography>
                              <Typography variant="body2">
                                • Value 1.5-2: Good
                              </Typography>
                              <Typography variant="body2">
                                • Value 1-1.5: Marginal
                              </Typography>
                              <Typography variant="body2">
                                • Value &lt; 1: Unprofitable
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="top"
                        >
                          <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                          <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                            {stats.profitFactor}
                          </Typography>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Avg Win: {formatCurrency(stats.avgWin)}
                        </Typography>
                      
                      </Box>
                      
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Max Drawdown
                        </Typography>
                        
                        
                        <Tooltip 
                          title={
                            <Box sx={{ p: 1, maxWidth: 300 }}>
                              <Typography variant="body2" gutterBottom>
                                Maximum drawdown represents the largest peak-to-trough decline in your account balance.
                              </Typography>
                              {stats.maxDrawdown !== '0.0' && (
                                <>
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    Recovery needed: {stats.drawdownRecoveryNeeded}
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    Duration: {stats.drawdownDuration} days
                                  </Typography>
                                  {stats.drawdownStartDate && stats.drawdownEndDate && (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                      Period: {format(stats.drawdownStartDate, 'MMM d')} - {format(stats.drawdownEndDate, 'MMM d')}
                                    </Typography>
                                  )}
                                </>
                              )}
                            </Box>
                          }
                          arrow
                          placement="top"
                        >
                         <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                         <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                          {stats.maxDrawdown}%
                        </Typography>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                          Avg Loss: {formatCurrency(stats.avgLoss)}
                        </Typography>
                       
                      </Box>
                    </Box>
                    
                    {(calendar.weeklyTarget || calendar.monthlyTarget || calendar.yearlyTarget) && (
                      <Box sx={{ 
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Target Progress
                        </Typography>
                        <Box sx={{ 
                          display: 'grid',
                          gridTemplateColumns: calendar.weeklyTarget && calendar.monthlyTarget && calendar.yearlyTarget 
                            ? 'repeat(3, 1fr)' 
                            : calendar.weeklyTarget && calendar.monthlyTarget || calendar.weeklyTarget && calendar.yearlyTarget || calendar.monthlyTarget && calendar.yearlyTarget
                              ? 'repeat(2, 1fr)'
                              : '1fr',
                          gap: 2 
                        }}>
                          {calendar.weeklyTarget && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Weekly
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {stats.weeklyProgress}%
                              </Typography>
                            </Box>
                          )}
                          {calendar.monthlyTarget && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Monthly
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {stats.monthlyProgress}%
                              </Typography>
                            </Box>
                          )}
                          {calendar.yearlyTarget && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Yearly
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {stats.yearlyProgress}%
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ 
                  justifyContent: 'flex-end', 
                  p: 2, 
                  pt: 1, 
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Button
                    size="small"
                    startIcon={<ChartIcon />}
                    onClick={(e) => handleViewCharts(e, calendar)}
                    sx={{ 
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    View Charts
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => handleEditClick(e, calendar)}
                    sx={{ 
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => handleDeleteClick(e, calendar.id)}
                    sx={{ 
                      color: 'error.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.1)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        {...dialogProps}
      >
        <DialogTitle>Create New Calendar</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Calendar Name"
              fullWidth
              value={newCalendarName}
              onChange={(e) => setNewCalendarName(e.target.value)}
              autoFocus
            />
            <TextField
              label="Initial Account Balance"
              fullWidth
              value={newAccountBalance}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewAccountBalance(value);
                }
              }}
              type="number"
              InputProps={{
                startAdornment: <Box component="span" sx={{ mr: 1 }}>$</Box>
              }}
            />
            <TextField
              label="Max Daily Drawdown (%)"
              fullWidth
              value={newMaxDrawdown}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewMaxDrawdown(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Maximum allowed loss percentage per day"
            />
            <TextField
              label="Weekly Target (%)"
              fullWidth
              value={newWeeklyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewWeeklyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per week"
            />
            <TextField
              label="Monthly Target (%)"
              fullWidth
              value={newMonthlyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewMonthlyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per month"
            />
            <TextField
              label="Yearly Target (%)"
              fullWidth
              value={newYearlyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewYearlyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per year"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateCalendar}
            variant="contained"
            disabled={!newCalendarName.trim() || !newAccountBalance.trim() || !newMaxDrawdown.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        {...dialogProps}
      >
        <DialogTitle>Edit Calendar</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Calendar Name"
              fullWidth
              value={newCalendarName}
              onChange={(e) => setNewCalendarName(e.target.value)}
              autoFocus
            />
            <TextField
              label="Account Balance"
              fullWidth
              value={newAccountBalance}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewAccountBalance(value);
                }
              }}
              type="number"
              InputProps={{
                startAdornment: <Box component="span" sx={{ mr: 1 }}>$</Box>
              }}
            />
            <TextField
              label="Max Daily Drawdown (%)"
              fullWidth
              value={newMaxDrawdown}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewMaxDrawdown(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Maximum allowed loss percentage per day"
            />
            <TextField
              label="Weekly Target (%)"
              fullWidth
              value={newWeeklyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewWeeklyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per week"
            />
            <TextField
              label="Monthly Target (%)"
              fullWidth
              value={newMonthlyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewMonthlyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per month"
            />
            <TextField
              label="Yearly Target (%)"
              fullWidth
              value={newYearlyTarget}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setNewYearlyTarget(value);
                }
              }}
              type="number"
              InputProps={{
                endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
              }}
              helperText="Target profit percentage per year"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleEditCalendar}
            variant="contained"
            disabled={!newCalendarName.trim() || !newAccountBalance.trim() || !newMaxDrawdown.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        {...dialogProps}
      >
        <DialogTitle sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'error.main'
        }}>
          <DeleteIcon fontSize="small" />
          Delete Calendar
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this calendar? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            sx={{ 
              color: 'error.main',
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Performance Charts Dialog */}
      <Dialog
        open={selectedCalendarForCharts !== null}
        onClose={handleCloseCharts}
        maxWidth="lg"
        fullWidth
        {...dialogProps}
        PaperProps={{
          sx: {
            minHeight: '80vh',
            maxHeight: '90vh',
            bgcolor: 'background.paper',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChartIcon color="primary" />
            <Typography variant="h6">
              Performance Charts - {selectedCalendarForCharts?.name}
            </Typography>
          </Box>
          <Button
            onClick={() => setIsDateDialogOpen(true)}
            startIcon={<CalendarMonth />}
            variant="outlined"
            size="small"
          >
            {format(selectedMonth, 'MMMM yyyy')}
          </Button>
        </DialogTitle>
        <DialogContent sx={{ 
          p: 3,
          backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.6) : '#f0f0f0',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: alpha(theme.palette.background.default, 0.5),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.2),
            borderRadius: '4px',
            '&:hover': {
              background: alpha(theme.palette.primary.main, 0.3),
            },
          },
        }}>
          {selectedCalendarForCharts && (
            <Box sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 3
            }}>
              <PerformanceCharts 
                trades={selectedCalendarForCharts.trades} 
                selectedDate={selectedMonth} 
                accountBalance={selectedCalendarForCharts.accountBalance}
                monthlyTarget={selectedCalendarForCharts.monthlyTarget}
                maxDailyDrawdown={selectedCalendarForCharts.maxDailyDrawdown}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          gap: 1
        }}>
          <Button 
            onClick={handleCloseCharts}
            variant="outlined"
            size="small"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Date Selection Dialog */}
      {selectedCalendarForCharts && (
        <SelectDateDialog
          open={isDateDialogOpen}
          onClose={() => setIsDateDialogOpen(false)}
          onDateSelect={(date) => {
            setSelectedMonth(date);
            setIsDateDialogOpen(false);
          }}
          initialDate={selectedMonth}
          trades={selectedCalendarForCharts.trades}
          accountBalance={selectedCalendarForCharts.accountBalance}
          monthlyTarget={selectedCalendarForCharts.monthlyTarget}
          yearlyTarget={selectedCalendarForCharts.yearlyTarget}
        />
      )}
    </Container>
  );
};

export default CalendarHome; 