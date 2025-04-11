import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { v4 as uuidv4 } from 'uuid';
import { Trade } from './types/trade';
import { Calendar } from './types/calendar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';

// Lazy load components
const CalendarHome = lazy(() => import('./components/CalendarHome'));
const TradeCalendar = lazy(() => import('./components/TradeCalendar'));

// Loading component for Suspense
const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    Loading...
  </Box>
);

function AppContent() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialize theme from localStorage or system preference
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? (savedMode as 'light' | 'dark') : (prefersDarkMode ? 'dark' : 'light');
  });

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);
  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false);
  const [loadingCalendarName, setLoadingCalendarName] = useState<string | undefined>(undefined);
  const [isImportingTrades, setIsImportingTrades] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<'loading' | 'importing' | 'exporting'>('loading');
  const { user } = useAuth();

  // Load calendars when user changes
  useEffect(() => {
    const loadCalendars = async () => {
      if (user) {
        setIsLoadingCalendars(true);
        try {
          const userCalendars = await calendarService.getUserCalendars(user.uid);
          setCalendars(userCalendars);
        } catch (error) {
          console.error('Error loading calendars:', error);
        } finally {
          setIsLoadingCalendars(false);
        }
      } else {
        setCalendars([]);
      }
    };

    loadCalendars();
  }, [user]);

  const theme = useMemo(() => createTheme(createAppTheme(mode)), [mode]);

  // Function to load all trades for a calendar
  const loadAllTrades = async (calendarId: string) => {
    // Find the calendar to get its name
    const calendar = calendars.find(cal => cal.id === calendarId);
    const calendarName = calendar?.name || '';

    // Set loading state
    setIsLoadingTrades(true);
    setLoadingCalendarName(calendarName);
    setLoadingAction('loading');
    try {
      const allTrades = await calendarService.getAllTrades(calendarId);

      // Update the calendar with all loaded trades
      setCalendars(prevCalendars => {
        return prevCalendars.map(cal => {
          if (cal.id === calendarId) {
            // Get all years from the trades and remove duplicates
            const uniqueYears: number[] = [];
            allTrades.forEach(trade => {
              const year = new Date(trade.date).getFullYear();
              if (!uniqueYears.includes(year)) {
                uniqueYears.push(year);
              }
            });

            // If no trades were found, add current year to loadedYears to prevent infinite loading
            if (uniqueYears.length === 0) {
              uniqueYears.push(new Date().getFullYear());
            }

            return {
              ...cal,
              loadedYears: uniqueYears,
              cachedTrades: allTrades
            };
          }
          return cal;
        });
      });
    } catch (error) {
      console.error(`Error loading all trades for calendar ${calendarId}:`, error);
    } finally {
      // Reset loading state after a short delay to ensure the UI updates smoothly
      setTimeout(() => {
        setIsLoadingTrades(false);
        setLoadingCalendarName(undefined);
        setLoadingAction('loading'); // Reset to default action
      }, 500);
    }
  };

  const handleCreateCalendar = async (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamicRiskEnabled?: boolean, increasedRiskPercentage?: number, profitThresholdPercentage?: number) => {
    if (!user) return;

    const newCalendar: Omit<Calendar, 'id' | 'cachedTrades' | 'loadedYears'> = {
      name,
      createdAt: new Date(),
      lastModified: new Date(),
      accountBalance,
      maxDailyDrawdown,
      weeklyTarget,
      monthlyTarget,
      yearlyTarget,
      riskPerTrade,
      dynamicRiskEnabled,
      increasedRiskPercentage,
      profitThresholdPercentage
    };

    try {
      const calendarId = await calendarService.createCalendar(user.uid, newCalendar);
      setCalendars(prev => [...prev, { ...newCalendar, id: calendarId, cachedTrades: [], loadedYears: [] }]);
    } catch (error) {
      console.error('Error creating calendar:', error);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    try {
      await calendarService.deleteCalendar(id);
      setCalendars(prev => prev.filter(cal => cal.id !== id));
    } catch (error) {
      console.error('Error deleting calendar:', error);
    }
  };

  const handleUpdateCalendar = async (id: string, updates: Partial<Calendar>) => {
    try {
      await calendarService.updateCalendar(id, updates);
      setCalendars(prev => prev.map(cal =>
        cal.id === id
          ? { ...cal, ...updates, lastModified: new Date() }
          : cal
      ));
    } catch (error) {
      console.error('Error updating calendar:', error);
    }
  };

  const toggleColorMode = () => {
    setMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      // Save theme preference to localStorage
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          position: 'relative',
          pb: 4
        }}
      >
        <TradeLoadingIndicator
          isLoading={isLoadingTrades || isImportingTrades}
          calendarName={loadingCalendarName}
          action={loadingAction}
        />
        <Routes>
          <Route
            path="/"
            element={
              <CalendarHome
                calendars={calendars}
                onCreateCalendar={handleCreateCalendar}
                onDeleteCalendar={handleDeleteCalendar}
                onUpdateCalendar={handleUpdateCalendar}
                onToggleTheme={toggleColorMode}
                mode={mode}
                isLoading={isLoadingCalendars}
                loadAllTrades={loadAllTrades}
              />
            }
          />
          <Route
            path="/calendar/:calendarId"
            element={
              <CalendarRoute
                calendars={calendars}
                onUpdateCalendar={handleUpdateCalendar}
                onToggleTheme={toggleColorMode}
                mode={mode}
                loadAllTrades={loadAllTrades}
                setIsImportingTrades={setIsImportingTrades}
                setLoadingCalendarName={setLoadingCalendarName}
                setLoadingAction={setLoadingAction}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <AppContent />
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  loadAllTrades: (calendarId: string) => Promise<void>;
  setIsImportingTrades: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingCalendarName: React.Dispatch<React.SetStateAction<string | undefined>>;
  setLoadingAction: React.Dispatch<React.SetStateAction<'loading' | 'importing' | 'exporting'>>;
}

// Helper function to update calendar with statistics
const updateCalendarWithStats = (calendarId: string, updatedStats: any, onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void) => {
  onUpdateCalendar(calendarId, {
    // Update all the stats
    winRate: updatedStats.winRate,
    profitFactor: updatedStats.profitFactor,
    maxDrawdown: updatedStats.maxDrawdown,
    targetProgress: updatedStats.targetProgress,
    pnlPerformance: updatedStats.pnlPerformance,
    totalTrades: updatedStats.totalTrades,
    winCount: updatedStats.winCount,
    lossCount: updatedStats.lossCount,
    totalPnL: updatedStats.totalPnL,
    drawdownStartDate: updatedStats.drawdownStartDate,
    drawdownEndDate: updatedStats.drawdownEndDate,
    drawdownRecoveryNeeded: updatedStats.drawdownRecoveryNeeded,
    drawdownDuration: updatedStats.drawdownDuration,
    avgWin: updatedStats.avgWin,
    avgLoss: updatedStats.avgLoss,
    currentBalance: updatedStats.currentBalance,
    weeklyPnL: updatedStats.weeklyPnL,
    monthlyPnL: updatedStats.monthlyPnL,
    yearlyPnL: updatedStats.yearlyPnL,
    weeklyPnLPercentage: updatedStats.weeklyPnLPercentage,
    monthlyPnLPercentage: updatedStats.monthlyPnLPercentage,
    yearlyPnLPercentage: updatedStats.yearlyPnLPercentage,
    weeklyProgress: updatedStats.weeklyProgress,
    monthlyProgress: updatedStats.monthlyProgress
  });
};

const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  onUpdateCalendar,
  onToggleTheme,
  mode,
  loadAllTrades,
  setIsImportingTrades,
  setLoadingCalendarName,
  setLoadingAction
}) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);

  // Track whether we've attempted to load trades for this calendar
  const [loadAttempted, setLoadAttempted] = useState<{[key: string]: boolean}>({});

  // Load all trades for the calendar if they haven't been loaded yet
  useEffect(() => {
    if (calendar && calendar.loadedYears.length === 0 && !loadAttempted[calendar.id]) {
      // Mark that we've attempted to load trades for this calendar
      setLoadAttempted(prev => ({ ...prev, [calendar.id]: true }));
      loadAllTrades(calendar.id);
    }
  }, [calendar, loadAllTrades, loadAttempted]);

  if (!calendar) {
    return <Navigate to="/" replace />;
  }

  const handleAddTrade = async (trade: Omit<Trade, "id">) => {
    const newTrade = { ...trade, id: uuidv4() };
    try {
      // Add the trade and get the updated stats
      // Pass the cached trades to avoid fetching all trades from Firestore
      const updatedStats = await calendarService.addTrade(calendar.id, newTrade, calendar.cachedTrades);

      // First update the cached trades
      onUpdateCalendar(calendar.id, {
        cachedTrades: [...calendar.cachedTrades, newTrade]
      });

      // Then update the calendar with the statistics
      updateCalendarWithStats(calendar.id, updatedStats, onUpdateCalendar);
    } catch (error) {
      console.error('Error adding trade:', error);
    }
  };

  const handleEditTrade = async (trade: Trade) => {
    try {
      const oldTrade = calendar.cachedTrades.find((t: Trade) => t.id === trade.id);
      if (oldTrade) {
        // Update the trade and get the updated stats
        // Pass the cached trades to avoid fetching all trades from Firestore
        const updatedStats = await calendarService.updateTrade(calendar.id, oldTrade, trade, calendar.cachedTrades);

        // Update the cached trades and stats in the calendar
        if (updatedStats) {
          // First update the cached trades
          onUpdateCalendar(calendar.id, {
            cachedTrades: calendar.cachedTrades.map((t: Trade) => t.id === trade.id ? trade : t)
          });

          // Then update the calendar with the statistics
          updateCalendarWithStats(calendar.id, updatedStats, onUpdateCalendar);
        } else {
          // Just update the cached trades if no stats were returned
          onUpdateCalendar(calendar.id, {
            cachedTrades: calendar.cachedTrades.map((t: Trade) => t.id === trade.id ? trade : t)
          });
        }
      }
    } catch (error) {
      console.error('Error updating trade:', error);
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    try {
      const tradeToDelete = calendar.cachedTrades.find((t: Trade) => t.id === tradeId);
      if (tradeToDelete) {
        // Delete the trade and get the updated stats
        // Pass the cached trades to avoid fetching all trades from Firestore
        const updatedStats = await calendarService.deleteTrade(calendar.id, tradeToDelete, calendar.cachedTrades);

        // Update the cached trades and stats in the calendar
        if (updatedStats) {
          // First update the cached trades
          onUpdateCalendar(calendar.id, {
            cachedTrades: calendar.cachedTrades.filter((t: Trade) => t.id !== tradeId)
          });

          // Then update the calendar with the statistics
          updateCalendarWithStats(calendar.id, updatedStats, onUpdateCalendar);
        } else {
          // Just update the cached trades if no stats were returned
          onUpdateCalendar(calendar.id, {
            cachedTrades: calendar.cachedTrades.filter((t: Trade) => t.id !== tradeId)
          });
        }
      }
    } catch (error) {
      console.error('Error deleting trade:', error);
    }
  };

  const handleChangeAccountBalance = async (newBalance: number) => {
    try {
      await calendarService.updateCalendar(calendar.id, { accountBalance: newBalance });
      onUpdateCalendar(calendar.id, { accountBalance: newBalance });
    } catch (error) {
      console.error('Error updating account balance:', error);
    }
  };

  const handleImportTrades = async (importedTrades: Trade[]) => {
    try {
      // Show loading indicator
      setIsImportingTrades(true);
      setLoadingCalendarName(calendar.name);
      setLoadingAction('importing');

      // First update the local state with just the trades
      onUpdateCalendar(calendar.id, { cachedTrades: importedTrades });

      // Then update Firestore using the importTrades function and get the updated stats
      const updatedStats = await calendarService.importTrades(calendar.id, importedTrades);

      // Update the calendar with the updated stats
      updateCalendarWithStats(calendar.id, updatedStats, onUpdateCalendar);
    } catch (error) {
      console.error('Error importing trades:', error);
    } finally {
      // Hide loading indicator after a short delay
      setTimeout(() => {
        setIsImportingTrades(false);
        setLoadingCalendarName(undefined);
        setLoadingAction('loading'); // Reset to default action
      }, 500);
    }
  };

  const handleClearMonthTrades = async (month: number, year: number) => {
    try {
      const tradesToKeep = calendar.cachedTrades.filter((trade: Trade) => {
        const tradeDate = new Date(trade.date);
        return tradeDate.getMonth() !== month || tradeDate.getFullYear() !== year;
      });

      // First update the local state with just the trades
      onUpdateCalendar(calendar.id, { cachedTrades: tradesToKeep });

      // Then update Firestore using the clearMonthTrades function and get the updated stats
      // Pass the cached trades to avoid fetching all trades from Firestore
      const updatedStats = await calendarService.clearMonthTrades(calendar.id, month, year, tradesToKeep);

      // Update the calendar with the updated stats if available
      if (updatedStats) {
        // Update the calendar with the updated stats
        updateCalendarWithStats(calendar.id, updatedStats, onUpdateCalendar);
      }
    } catch (error) {
      console.error('Error clearing month trades:', error);
    }
  };

  return (
    <TradeCalendar
      trades={calendar.cachedTrades}
      accountBalance={calendar.accountBalance}
      maxDailyDrawdown={calendar.maxDailyDrawdown}
      weeklyTarget={calendar.weeklyTarget}
      monthlyTarget={calendar.monthlyTarget}
      yearlyTarget={calendar.yearlyTarget}
      riskPerTrade={calendar.riskPerTrade}
      dynamicRiskEnabled={calendar.dynamicRiskEnabled}
      increasedRiskPercentage={calendar.increasedRiskPercentage}
      profitThresholdPercentage={calendar.profitThresholdPercentage}
      calendarName={calendar.name}
      onAddTrade={handleAddTrade}
      onEditTrade={handleEditTrade}
      onDeleteTrade={handleDeleteTrade}
      onAccountBalanceChange={handleChangeAccountBalance}
      onImportTrades={handleImportTrades}
      onClearMonthTrades={handleClearMonthTrades}
      onToggleTheme={onToggleTheme}
      mode={mode}
      // Pass pre-calculated statistics
      totalPnL={calendar.totalPnL}
    />
  );
};

export default App;
