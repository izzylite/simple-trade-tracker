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
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase/config';

import AppLoadingProgress from './components/AppLoadingProgress';
import {
  calculateEffectiveRiskPercentage,
  calculateRiskAmount,
  DynamicRiskSettings
} from './utils/dynamicRiskUtils';


// Lazy load components
const HomePage = lazy(() => import('./components/HomePage'));
const CalendarHome = lazy(() => import('./components/CalendarHome'));
const TradeCalendar = lazy(() => import('./components/TradeCalendar'));
const CalendarTrash = lazy(() => import('./components/trash/CalendarTrash'));
const SharedTradePage = lazy(() => import('./components/sharing/SharedTradePage'));
const BlogHome = lazy(() => import('./components/blog/BlogHome'));

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
  const loadAllTrades = async (calendarId: string, fetchCalendar?: boolean) => {
    // Find the calendar to get its name
    const calendar = calendars.find(cal => cal.id === calendarId);
    const calendarName = calendar?.name || '';

    // Set loading state
    setLoading(true, 'loading', calendarName)
    try {
      const allTrades = await calendarService.getAllTrades(calendarId);
      if (fetchCalendar) {
        const calendar = await calendarService.getCalendar(calendarId);
        if (calendar) {
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
        setLoading(false, 'loading', undefined)
      }, 500);
    }
  };



  const handleCreateCalendar = async (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamicRiskEnabled?: boolean, increasedRiskPercentage?: number, profitThresholdPercentage?: number, heroImageUrl?: string, heroImageAttribution?: any) => {
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
      profitThresholdPercentage,
      heroImageUrl,
      heroImageAttribution

    };

    try {
      const calendarId = await calendarService.createCalendar(user.uid, newCalendar);
      setCalendars(prev => [...prev, { ...newCalendar, id: calendarId, cachedTrades: [], loadedYears: [] }]);
    } catch (error) {
      console.error('Error creating calendar:', error);
    }
  };

  const handleDuplicateCalendar = async (sourceCalendarId: string, newName: string, includeContent: boolean = false) => {
    if (!user) return;

    try {
      const newCalendar = await calendarService.duplicateCalendar(user.uid, sourceCalendarId, newName, includeContent);

      // Get the source calendar to copy its properties
      const sourceCalendar = calendars.find(cal => cal.id === sourceCalendarId);
      if (sourceCalendar) {
        const duplicatedCalendar: Calendar = {
          ...sourceCalendar,
          ...newCalendar,
          // Reset trades
          cachedTrades: [],
          loadedYears: []
        };

        setCalendars(prev => [...prev, duplicatedCalendar]);
      }
    } catch (error) {
      console.error('Error duplicating calendar:', error);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    try {
      if (!user) return;
      await calendarService.deleteCalendar(id, user.uid);
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

   const setLoading = (
      loading: boolean,
      loadingAction: 'loading' | 'importing' | 'exporting' ="loading",
      calendarName: string | undefined = undefined
    ) => {
      if (!loading) {
        setIsLoadingTrades(false);
        setLoadingCalendarName(undefined);
        setLoadingAction('loading'); // Reset to default action
      } else {
        setIsLoadingTrades(true);
        setLoadingCalendarName(calendarName);
        setLoadingAction(loadingAction);
      }
    }


  const updateCalendarState = (id: string, updates: Partial<Calendar>) => {
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
      loadAllTrades(calendarId, true);
      return;
    }

    // Recalculate ALL trade amounts based on risk to reward to show potential with consistent risk management
    const recalculateTrades = () => {
      if (!calendar.riskPerTrade || !calendar.cachedTrades.length) {
        return {
          trades: calendar.cachedTrades,
          totalProfit: calendar.totalPnL || 0
        };
      }

      console.log('Recalculating ALL trades based on risk to reward to show potential...');

      // Sort trades by date to calculate cumulative P&L correctly
      const sortedTrades = [...calendar.cachedTrades].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let cumulativePnL = 0;
      const updatedTrades = sortedTrades.map((trade, index) => {
        // Skip trades without risk to reward ratio
        if (!trade.riskToReward || trade.type === 'breakeven') {
          cumulativePnL += trade.amount;
          return trade;
        }

        // Calculate effective risk percentage using centralized utility
        const dynamicRiskSettings: DynamicRiskSettings = {
          accountBalance: calendar.accountBalance,
          riskPerTrade: calendar.riskPerTrade,
          dynamicRiskEnabled: calendar.dynamicRiskEnabled,
          increasedRiskPercentage: calendar.increasedRiskPercentage,
          profitThresholdPercentage: calendar.profitThresholdPercentage
        };

        const effectiveRisk = calculateEffectiveRiskPercentage(new Date(trade.date), sortedTrades.slice(0, index), dynamicRiskSettings);
        const riskAmount = calculateRiskAmount(effectiveRisk, calendar.accountBalance, cumulativePnL);

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
          bgcolor: 'custom.pageBackground',
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
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <HomePage
                  onToggleTheme={toggleColorMode}
                  mode={mode}
                />
              )
            }
          />
          <Route
            path="/home"
            element={
              <HomePage
                onToggleTheme={toggleColorMode}
                mode={mode}
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              user ? (
                <CalendarHome
                  calendars={calendars}
                  onCreateCalendar={handleCreateCalendar}
                  onDuplicateCalendar={handleDuplicateCalendar}
                  onDeleteCalendar={handleDeleteCalendar}
                  onUpdateCalendar={handleUpdateCalendar}
                  onToggleTheme={toggleColorMode}
                  mode={mode}
                  isLoading={isLoadingCalendars}
                  loadAllTrades={loadAllTrades}
                />
              ) : (
                <Navigate to="/" replace />
              )
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
                setLoadingTrades={(loading)=> setLoading(loading)}
              />
            }
          />
          <Route
            path="/trash"
            element={
              <CalendarTrash
                onToggleTheme={toggleColorMode}
                mode={mode}
              />
            }
          />
          <Route
            path="/shared/:shareId"
            element={<SharedTradePage />}
          />
          <Route
            path="/blog"
            element={
              user ? (
                <BlogHome
                  onToggleTheme={toggleColorMode}
                  mode={mode}
                />
              ) : (
                <Navigate to="/" replace />
              )
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
  setLoadingTrades: (loading: boolean) => void
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
  isLoadingTrades,
  setLoadingTrades,
}) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);

  // Track whether we've attempted to load trades for this calendar
  const [loadAttempted, setLoadAttempted] = useState<{ [key: string]: boolean }>({});

  // Load all trades for the calendar if they haven't been loaded yet
  useEffect(() => {
    if (calendar && calendar.loadedYears.length === 0 && !loadAttempted[calendar.id]) {
      // Mark that we've attempted to load trades for this calendar
      setLoadAttempted(prev => ({ ...prev, [calendar.id]: true }));
      loadAllTrades(calendar.id);
    }
  }, [calendar, loadAllTrades, loadAttempted]);

 // Subscribe to calendar changes to automatically update tags and other fields
  useEffect(() => {
    if (!calendar) return;

    const calendarRef = doc(db, 'calendars', calendar.id);
    const unsubscribe = onSnapshot(calendarRef, (doc) => {
      if (doc.exists()) {
        const updatedCalendarData = doc.data();

        // Only update specific fields that might change from cloud functions
        // Preserve cached trades and loaded years from local state
          onUpdateStateCalendar(calendar.id, {
            tags: updatedCalendarData.tags || [],
            lastModified: updatedCalendarData.lastModified?.toDate() || new Date(),
            requiredTagGroups: updatedCalendarData.requiredTagGroups || calendar.requiredTagGroups,
            scoreSettings: updatedCalendarData.scoreSettings || calendar.scoreSettings,
             // Update any other fields that cloud functions might modify
          // but preserve local state for trades and UI-specific data
          });

        
      }
    }, (error) => {
      console.error('Error listening to calendar changes:', error);
    });

    // Cleanup subscription on unmount or calendar change
    return () => unsubscribe();
  }, [calendar?.id]);

  if (!calendar) {
    return <Navigate to="/" replace />;
  }

  const handleAddTrade = async (trade: Trade) => {
    const newTrade = trade.id ? trade : { ...trade, id: uuidv4() };

    // Optimistically update the UI first for better user experience
    const optimisticCachedTrades = [...calendar.cachedTrades, newTrade];
    onUpdateStateCalendar(calendar.id, {
      cachedTrades: optimisticCachedTrades
    });

    try {
      // Add the trade and get the updated stats
      // Pass the cached trades to avoid fetching all trades from Firestore
      const updatedStats = await calendarService.addTrade(calendar.id, newTrade, calendar.cachedTrades);

      // Update with the final stats from the database
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: optimisticCachedTrades,
        ...updatedStats
      });

    } catch (error) {
      console.error('Error adding trade:', error);

      // Revert the optimistic update on error
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: calendar.cachedTrades // Revert to original state
      });

      // Re-throw the error so the calling component can handle it
      throw error;
    }
  };


  const onTagUpdated = async (oldTag: string, newTag: string) => {
    // Helper function to update tags in an array, handling group name changes
    const updateTagsWithGroupNameChange = (tags: string[]) => {
      // Check if this is a group name change
      const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
      const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
      const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

      if (isGroupNameChange) {
        // Group name changed - update all tags in the old group
        return tags.map((tag: string) => {
          if (tag === oldTag) {
            // Direct match - replace with new tag
            return newTag;
          } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
            // Same group - update group name but keep tag name
            const tagName = tag.split(':')[1];
            return `${newGroup}:${tagName}`;
          } else {
            // Different group or ungrouped - keep as is
            return tag;
          }
        }).filter(tag => tag !== ''); // Remove empty tags
      } else {
        // Not a group name change - just replace the specific tag
        return tags.map(tag => tag === oldTag ? newTag : tag).filter((tag: string) => tag !== '');
      }
    };

    // Helper function to update required tag groups
    const updateRequiredTagGroups = (requiredGroups: string[]) => {
      const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
      const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
      console.log(`Updated required tag groups ${requiredGroups}`);
      if (oldGroup && newGroup && oldGroup !== newGroup) {
        // Group name changed, update it in requiredTagGroups
        return requiredGroups.map(group => group === oldGroup ? newGroup : group);
      } else {
        // No group change needed
        return requiredGroups;
      }
    };

    // Helper function to update tags in a trade, handling group name changes
    const updateTradeTagsWithGroupNameChange = (trade: Trade) => {
      if (!trade.tags || !Array.isArray(trade.tags)) {
        return trade;
      }

      // Check if this is a group name change
      const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
      const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
      const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

      let updated = false;
      const updatedTags = [...trade.tags];

      if (isGroupNameChange) {
        // Group name change - update all tags in the old group
        for (let j = 0; j < updatedTags.length; j++) {
          const tag = updatedTags[j];
          if (tag === oldTag) {
            // Direct match - replace with new tag
            if (newTag.trim() === '') {
              updatedTags.splice(j, 1);
              j--; // Adjust index after removal
            } else {
              updatedTags[j] = newTag.trim();
            }
            updated = true;
          } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
            // Same group - update group name but keep tag name
            const tagName = tag.split(':')[1];
            updatedTags[j] = `${newGroup}:${tagName}`;
            updated = true;
          }
        }
      } else {
        // Not a group name change - just replace the specific tag
        if (trade.tags.includes(oldTag)) {
          const tagIndex = updatedTags.indexOf(oldTag);
          if (newTag.trim() === '') {
            updatedTags.splice(tagIndex, 1);
          } else {
            updatedTags[tagIndex] = newTag.trim();
          }
          updated = true;
        }
      }

      return updated ? { ...trade, tags: updatedTags } : trade;
    };

    // Update cached trades locally for immediate UI feedback (create new array to avoid mutation)
    const updatedCachedTrades = calendar.cachedTrades.map((trade: Trade) => {
      return updateTradeTagsWithGroupNameChange(trade);
    });

    // Update local state immediately
    onUpdateStateCalendar(calendar.id, {
      tags: updateTagsWithGroupNameChange(calendar.tags || []),
      requiredTagGroups: updateRequiredTagGroups(calendar.requiredTagGroups || []),
      cachedTrades: updatedCachedTrades
    });
  }

  const handleUpdateTradeProperty = async (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade): Promise<Trade | undefined> => {

    try {
      const result = await calendarService.updateTrade(calendar.id, tradeId, calendar.cachedTrades, updateCallback, createIfNotExists);
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
      throw error;
    }
  };

  const onUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<void> => {
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
      dynamicRiskSettings={{
        accountBalance: calendar.accountBalance,
        riskPerTrade: calendar.riskPerTrade,
        dynamicRiskEnabled: calendar.dynamicRiskEnabled,
        increasedRiskPercentage: calendar.increasedRiskPercentage,
        profitThresholdPercentage: calendar.profitThresholdPercentage
      }}
      requiredTagGroups={calendar.requiredTagGroups}
      allTags={calendar.tags} // Pass calendar.tags for efficient tag access
      calendarName={calendar.name}
      onAddTrade={handleAddTrade}
      calendarDayNotes={calendar.daysNotes}
      calendarNote={calendar.note}
      heroImageUrl={calendar.heroImageUrl}
      heroImageAttribution={calendar.heroImageAttribution}

      // setLoading={(loading) => setLoadingTrades(loading)}
      // Score settings
      scoreSettings={calendar.scoreSettings}
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
