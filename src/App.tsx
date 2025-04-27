import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';
import { Trade } from './types/trade';
import { Calendar } from './types/calendar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';
import { setAnalyticsCollectionEnabled } from 'firebase/analytics';
import AppLoadingProgress from './components/AppLoadingProgress';

// Lazy load components
const CalendarHome = lazy(() => import('./components/CalendarHome'));
const TradeCalendar = lazy(() => import('./components/TradeCalendar'));

// Loading component for Suspense
const LoadingFallback = () => <AppLoadingProgress />;

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
      return undefined;
    };

    loadCalendars();
  }, [user]);

  const theme = useMemo(() => createTheme(createAppTheme(mode)), [mode]);

  // Function to load all trades for a calendar
  const loadAllTrades = async (calendarId: string,fetchCalendar?:boolean) => {
    // Find the calendar to get its name
    const calendar = calendars.find(cal => cal.id === calendarId);
    const calendarName = calendar?.name || '';

    // Set loading state
    setIsLoadingTrades(true);
    setLoadingCalendarName(calendarName);
    setLoadingAction('loading');
    try {
      const allTrades = await calendarService.getAllTrades(calendarId);
      if(fetchCalendar){
        const calendar = await calendarService.getCalendar(calendarId);
        if(calendar){
          const stats = calendarService.calculateCalendarStats(allTrades, calendar);
          updateCalendarState(calendarId, {
            ...calendar,
            ...stats
          });
        }
      }



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
      updateCalendarState(id, updates);

    } catch (error) {
      console.error('Error updating calendar:', error);
    }
  };


  const updateCalendarState =  (id: string, updates: Partial<Calendar>) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === id
        ? { ...cal, ...updates, lastModified: new Date() }
        : cal
    ));
  };

  const toggleColorMode = () => {
    setMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      // Save theme preference to localStorage
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  // Function to handle dynamic risk toggle
  const handleToggleDynamicRisk = (calendarId: string, useActualAmounts: boolean) => {
    // Find the calendar
    const calendar = calendars.find(cal => cal.id === calendarId);
    if (!calendar) return;

    // If using actual amounts, reload the original trades from Firestore
    if (useActualAmounts) {
      console.log('Resetting to actual trade amounts...');
      // Reload all trades for the calendar to get the original values
      loadAllTrades(calendarId,true);
      return;
    }

    // Recalculate trade amounts based on risk to reward
    const recalculateTrades = () => {
      if (!calendar.riskPerTrade || !calendar.cachedTrades.length) {
        return {
          trades: calendar.cachedTrades,
          totalProfit: calendar.totalPnL || 0
        };
      }

      console.log('Recalculating all cached trades based on risk to reward...');

      // Sort trades by date to calculate cumulative P&L correctly
      const sortedTrades = [...calendar.cachedTrades].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let cumulativePnL = 0;
      const updatedTrades = sortedTrades.map(trade => {
        // Skip trades with partials taken
        if (trade.partialsTaken) {
          cumulativePnL += trade.amount;
          return trade;
        }

        // Skip trades without risk to reward ratio
        if (!trade.riskToReward || trade.type === 'breakeven') {
          cumulativePnL += trade.amount;
          return trade;
        }

        // Calculate effective risk percentage
        let effectiveRisk = calendar.riskPerTrade;
        if (calendar.dynamicRiskEnabled &&
            calendar.increasedRiskPercentage &&
            calendar.profitThresholdPercentage &&
            calendar.accountBalance > 0) {
          const profitPercent = (cumulativePnL / calendar.accountBalance * 100);
          if (profitPercent >= calendar.profitThresholdPercentage) {
            effectiveRisk = calendar.increasedRiskPercentage;
          }
        }

        // Calculate risk amount based on account balance + cumulative P&L
        const totalAccountValue = calendar.accountBalance + cumulativePnL;
        const riskAmount = (totalAccountValue * (effectiveRisk ?? 0)) / 100;

        // Calculate new amount based on trade type and risk to reward
        let newAmount = 0;
        if (trade.type === 'win') {
          newAmount = Math.round(riskAmount * trade.riskToReward);
        } else if (trade.type === 'loss') {
          newAmount = -Math.round(riskAmount);
        }

        // Update cumulative P&L with the new amount
        cumulativePnL += newAmount;

        // Return updated trade with new amount
        return {
          ...trade,
          amount: newAmount
        };
      });
      const stats = calendarService.calculateCalendarStats(updatedTrades, calendar);
      // Calculate new total profit


      // Update the calendar state with recalculated trades and the new total profit
      updateCalendarState(calendarId, {
        cachedTrades: updatedTrades,
        ...stats
      });

    };

    // Execute the recalculation and get the results
     recalculateTrades();
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
                onUpdateStateCalendar={updateCalendarState}
                onToggleTheme={toggleColorMode}
                mode={mode}
                loadAllTrades={loadAllTrades}
                setIsImportingTrades={setIsImportingTrades}
                setLoadingCalendarName={setLoadingCalendarName}
                setLoadingAction={setLoadingAction}
                onToggleDynamicRisk={handleToggleDynamicRisk}
                isLoadingTrades={isLoadingTrades}
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
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <AppContent />
          </Suspense>
        </Router>
      </LocalizationProvider>
    </AuthProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  onUpdateStateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  loadAllTrades: (calendarId: string) => Promise<void>;
  setIsImportingTrades: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingCalendarName: React.Dispatch<React.SetStateAction<string | undefined>>;
  setLoadingAction: React.Dispatch<React.SetStateAction<'loading' | 'importing' | 'exporting'>>;
  onToggleDynamicRisk: (calendarId: string, useActualAmounts: boolean) => void;
  isLoadingTrades: boolean;
}


const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  onUpdateStateCalendar,
  onToggleTheme,
  mode,
  loadAllTrades,
  setIsImportingTrades,
  setLoadingCalendarName,
  setLoadingAction,
  onToggleDynamicRisk,
  isLoadingTrades
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

  const handleAddTrade = async (trade: Trade) => {
    const newTrade = trade.id ? trade : { ...trade, id: uuidv4() };
    try {
      // Add the trade and get the updated stats
      // Pass the cached trades to avoid fetching all trades from Firestore
      const updatedStats = await calendarService.addTrade(calendar.id, newTrade, calendar.cachedTrades);
      // First update the cached trades. Then update the calendar with the statistics
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: [...calendar.cachedTrades, newTrade],
        ...updatedStats
      });

    } catch (error) {
      console.error('Error adding trade:', error);
    }
  };


  const onTagUpdated = async (oldTag: string, newTag: string) => {
    calendar.cachedTrades.forEach((trade: Trade) => {
      if (trade.tags && trade.tags.includes(oldTag)) {
        trade.tags = trade.tags.map(tag => tag === oldTag ? newTag : tag);
      }
    });
    onUpdateStateCalendar(calendar.id, {
      cachedTrades: [...calendar.cachedTrades]
    });
  }

  const handleUpdateTradeProperty = async (tradeId: string, updateCallback: (trade: Trade) => Trade,createIfNotExists?: (tradeId: string) => Trade) : Promise<Trade | undefined> => {

    try {
      const result = await calendarService.updateTrade(calendar.id, tradeId, calendar.cachedTrades,updateCallback,createIfNotExists);
      // Update the cached trades and stats in the calendar
      if (result) {
        const [updatedStats, updatedTrades] = result;
        // First update the cached trades with the complete updated trades list
        onUpdateStateCalendar(calendar.id, {
          cachedTrades: updatedTrades,
          ...updatedStats
        });
        return updatedTrades.find(trade => trade.id === tradeId);
      }
    } catch (error) {
      console.error('Error updating trade:', error);
    }
  };

  const onUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar ) : Promise<void> => {
    try {
      const updatedCalendar = await calendarService.onUpdateCalendar(calendarId, updateCallback);
      // Update the cached trades and stats in the calendar
      if (updatedCalendar) {
        // First update the cached trades with the complete updated trades list
        onUpdateStateCalendar(calendar.id, {
          ...updatedCalendar,
          cachedTrades: [...calendar.cachedTrades],
          loadedYears: [...calendar.loadedYears]
        });

      }
    } catch (error) {
      console.error('Error updating trade:', error);
    }
  };



  const handleChangeAccountBalance = async (newBalance: number) => {
    try {
      await calendarService.updateCalendar(calendar.id, { accountBalance: newBalance });
      onUpdateStateCalendar(calendar.id, {
        accountBalance: newBalance
      });

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
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: importedTrades,
      });

      // Then update Firestore using the importTrades function and get the updated stats
      const updatedStats = await calendarService.importTrades(calendar.id, importedTrades);
      onUpdateStateCalendar(calendar.id, {
        ...updatedStats
      });
      // Update the calendar with the updated stats

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
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: tradesToKeep,
      });


      // Then update Firestore using the clearMonthTrades function and get the updated stats
      // Pass the cached trades to avoid fetching all trades from Firestore
      const updatedStats = await calendarService.clearMonthTrades(calendar.id, month, year, tradesToKeep);

      // Update the calendar with the updated stats if available
      if (updatedStats) {
        // Update the calendar with the updated stats
        onUpdateStateCalendar(calendar.id, {
         ...updatedStats
        });
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
      onTagUpdated={onTagUpdated}
      yearlyTarget={calendar.yearlyTarget}
      riskPerTrade={calendar.riskPerTrade}
      dynamicRiskEnabled={calendar.dynamicRiskEnabled}
      increasedRiskPercentage={calendar.increasedRiskPercentage}
      profitThresholdPercentage={calendar.profitThresholdPercentage}
      requiredTagGroups={calendar.requiredTagGroups}
      calendarName={calendar.name}
      onAddTrade={handleAddTrade}
      calendarDayNotes={calendar.daysNotes}
      calendarNote={calendar.note}
      onUpdateCalendarProperty={onUpdateCalendarProperty}
      onUpdateTradeProperty={handleUpdateTradeProperty}
      onAccountBalanceChange={handleChangeAccountBalance}
      onImportTrades={handleImportTrades}
      onClearMonthTrades={handleClearMonthTrades}
      onToggleTheme={onToggleTheme}
      mode={mode}
      // Pass pre-calculated statistics
      totalPnL={calendar.totalPnL}
      // Dynamic risk toggle handler
      onToggleDynamicRisk={(useActualAmounts) => onToggleDynamicRisk(calendar.id, useActualAmounts)}
      // Pass loading state
      isLoadingTrades={isLoadingTrades}
    />
  );
};

export default App;
