import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery, Button } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';
import { Trade, Calendar } from './types/dualWrite';
import { CalendarWithUIState } from './types/calendar';
import { AuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';
import { supabase } from './config/supabase';

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
const SharedCalendarPage = lazy(() => import('./components/sharing/SharedCalendarPage'));
const AuthCallback = lazy(() => import('./components/auth/AuthCallback'));
// const SupabaseAuthTest = lazy(() => import('./components/auth/SupabaseAuthTest')); // Commented out - for testing only


// Loading component for Suspense
const LoadingFallback = () => <AppLoadingProgress />;

function AppContent() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialize theme from localStorage or system preference
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? (savedMode as 'light' | 'dark') : (prefersDarkMode ? 'dark' : 'light');
  });

  const [calendars, setCalendars] = useState<CalendarWithUIState[]>([]);
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
          // Convert Calendar[] to CalendarWithUIState[]
          const calendarsWithUIState: CalendarWithUIState[] = userCalendars.map(cal => ({
            ...cal,
            cachedTrades: [],
            loadedYears: []
          }));
          setCalendars(calendarsWithUIState);
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
          // Stats are automatically calculated by Supabase triggers
          const stats = calendarService.getCalendarStats(calendar);
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
              const year = new Date(trade.trade_date).getFullYear();
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

  const handleCreateCalendar = async (name: string, account_balance: number, max_daily_drawdown: number, weekly_target?: number, monthly_target?: number, yearly_target?: number, risk_per_trade?: number, dynamic_risk_enabled?: boolean, increased_risk_percentage?: number, profit_threshold_percentage?: number, heroImageUrl?: string, heroImageAttribution?: any) => {
    if (!user) return;

    const newCalendar: Omit<Calendar, 'id' | 'user_id'> = {
      name,
      created_at: new Date(),
      updated_at: new Date(),
      account_balance,
      max_daily_drawdown,
      weekly_target,
      monthly_target,
      yearly_target,
      risk_per_trade,
      dynamic_risk_enabled,
      increased_risk_percentage,
      profit_threshold_percentage,
      hero_image_url: heroImageUrl,
      hero_image_attribution: heroImageAttribution
    };

    try {
      const calendarId = await calendarService.createCalendar(user.uid, newCalendar);
      const newCalendarWithUIState: CalendarWithUIState = {
        ...newCalendar,
        id: calendarId,
        user_id: user.uid,
        cachedTrades: [],
        loadedYears: []
      };
      setCalendars(prev => [...prev, newCalendarWithUIState]);
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
        const duplicatedCalendar: CalendarWithUIState = {
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
    loadingAction: 'loading' | 'importing' | 'exporting' = "loading",
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

  const updateCalendarState = (id: string, updates: Partial<CalendarWithUIState>) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === id
        ? { ...cal, ...updates, updated_at: new Date() }
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
      if (!calendar.risk_per_trade || !calendar.cachedTrades.length) {
        return {
          trades: calendar.cachedTrades,
          total_pnl: calendar.total_pnl || 0
        };
      }

      console.log('Recalculating ALL trades based on risk to reward to show potential...');

      // Sort trades by date to calculate cumulative P&L correctly
      const sortedTrades = [...calendar.cachedTrades].sort((a, b) =>
        new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      );

      let cumulativePnL = 0;
      const updatedTrades = sortedTrades.map((trade, index) => {
        // Skip trades without risk to reward ratio
        if (!trade.risk_to_reward || trade.trade_type === 'breakeven') {
          cumulativePnL += trade.amount;
          return trade;
        }

        // Calculate effective risk percentage using centralized utility
        const dynamicRiskSettings: DynamicRiskSettings = {
          account_balance: calendar.account_balance,
          risk_per_trade: calendar.risk_per_trade,
          dynamic_risk_enabled: calendar.dynamic_risk_enabled,
          increased_risk_percentage: calendar.increased_risk_percentage,
          profit_threshold_percentage: calendar.profit_threshold_percentage
        };

        const effectiveRisk = calculateEffectiveRiskPercentage(new Date(trade.trade_date), sortedTrades.slice(0, index), dynamicRiskSettings);
        const riskAmount = calculateRiskAmount(effectiveRisk, calendar.account_balance, cumulativePnL);

        // Calculate new amount based on trade type and risk to reward
        let newAmount = 0;
        if (trade.trade_type === 'win') {
          newAmount = Math.round(riskAmount * trade.risk_to_reward);
        } else if (trade.trade_type === 'loss') { 
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

      // Calculate total P&L for UI display (this is a what-if calculation, not persisted)
      const total_pnl = updatedTrades.reduce((sum, trade) => sum + trade.amount, 0);

      // Update the calendar state with recalculated trades and the new total profit
      updateCalendarState(calendarId, {
        cachedTrades: updatedTrades,
        total_pnl
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
            path="/shared-calendar/:shareId"
            element={<SharedCalendarPage />}
          />
          <Route
            path="/auth/callback"
            element={<AuthCallback />}
          />
          {/* Commented out - for testing only */}
          {/* <Route
            path="/auth-test"
            element={<SupabaseAuthTest />}
          /> */}

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
  calendars: CalendarWithUIState[];
  onUpdateStateCalendar: (id: string, updates: Partial<CalendarWithUIState>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  loadAllTrades: (calendarId: string, fetchCalendar?: boolean) => Promise<void>;
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

    // Subscribe to Supabase real-time changes for this calendar
    const channel = supabase
      .channel(`calendar-${calendar.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calendars',
          filter: `id=eq.${calendar.id}`
        },
        (payload) => {
          const updatedCalendarData = payload.new;

          // Only update specific fields that might change from edge functions
          // Preserve cached trades and loaded years from local state
          onUpdateStateCalendar(calendar.id, {
            tags: updatedCalendarData.tags || [],
            updated_at: updatedCalendarData.updated_at ? new Date(updatedCalendarData.updated_at) : new Date(),
            required_tag_groups: updatedCalendarData.required_tag_groups || calendar.required_tag_groups,
            score_settings: updatedCalendarData.score_settings || calendar.score_settings,
            // Update any other fields that edge functions might modify
            // but preserve local state for trades and UI-specific data
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount or calendar change
    return () => {
      supabase.removeChannel(channel);
    };
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
      // Stats are automatically calculated by Supabase triggers
      const updatedStats = await calendarService.addTrade(calendar.id, newTrade);

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
      required_tag_groups: updateRequiredTagGroups(calendar.required_tag_groups || []),
      cachedTrades: updatedCachedTrades
    });
  }

  const handleUpdateTradeProperty = async (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade,
    createIfNotExists?: (tradeId: string) => Trade
  ): Promise<Trade | undefined> => {
    try {
      // Check if trade exists in cached trades first
      let existingTrade = calendar.cachedTrades.find(t => t.id === tradeId);

      // If trade doesn't exist and we have a create function, create it
      if (!existingTrade && createIfNotExists) {
        const finalTrade = updateCallback(createIfNotExists(tradeId)); 
        // Add to cached trades immediately for UI responsiveness
        const updatedCachedTrades = [...calendar.cachedTrades, finalTrade];
        onUpdateStateCalendar(calendar.id, {
          cachedTrades: updatedCachedTrades
        });

        // Create in database with all updates already applied
        await calendarService.addTrade(calendar.id, finalTrade);

        return finalTrade;
      }

      // Normal update flow for existing trades
      const result = await calendarService.updateTrade(calendar.id, tradeId, calendar.cachedTrades, updateCallback);
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

  const handleDeleteTrades = async (tradeIds: string[]): Promise<void> => {
    try {
      // Optimistically update UI by removing trades from cached list
      const updatedCachedTrades = calendar.cachedTrades.filter(trade => !tradeIds.includes(trade.id));
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: updatedCachedTrades
      });

      // Delete trades in parallel for better performance
      await Promise.all(
        tradeIds.map(tradeId => calendarService.deleteTrade(calendar.id, tradeId))
      );

      // Get updated calendar with auto-calculated stats from database
      const updatedCalendar = await calendarService.getCalendar(calendar.id);
      if (updatedCalendar) {
        const stats = calendarService.getCalendarStats(updatedCalendar);
        onUpdateStateCalendar(calendar.id, {
          ...stats
        });
      }
    } catch (error) {
      console.error('Error deleting trades:', error);
      // Reload trades to restore correct state after error
      await loadAllTrades(calendar.id, true);
      throw error;
    }
  };

  const onUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<Calendar | undefined> => {
    try {
      // Wrap the updateCallback to convert Calendar to Partial<Calendar>
      const partialUpdateCallback = (calendar: Calendar): Partial<Calendar> => {
        const fullUpdate = updateCallback(calendar);
        return fullUpdate;
      };

      await calendarService.onUpdateCalendar(calendarId, partialUpdateCallback);
      // Fetch the updated calendar to get the latest state
      const updatedCalendar = await calendarService.getCalendar(calendarId);
      if (updatedCalendar) {
        // Update the state with the fetched calendar
        onUpdateStateCalendar(calendar.id, {
          ...updatedCalendar,
          cachedTrades: [...calendar.cachedTrades],
          loadedYears: [...calendar.loadedYears]
        });
        return updatedCalendar;
      }
    } catch (error) {
      console.error('Error updating calendar:', error);
    }
    return undefined;
  };

  const handleChangeAccountBalance = async (newBalance: number) => {
    try {
      await calendarService.updateCalendar(calendar.id, { account_balance: newBalance });
      onUpdateStateCalendar(calendar.id, {
        account_balance: newBalance
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

      // Then update database using the importTrades function
      await calendarService.importTrades(calendar.id, importedTrades);
      // Stats will be recalculated on next load
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
        const tradeDate = new Date(trade.trade_date);
        return tradeDate.getMonth() !== month || tradeDate.getFullYear() !== year;
      });

      // First update the local state with just the trades
      onUpdateStateCalendar(calendar.id, {
        cachedTrades: tradesToKeep,
      });

      // Then update database using the clearMonthTrades function
      await calendarService.clearMonthTrades(calendar.id, year, month);

      // Stats are automatically recalculated by Supabase triggers after clearMonthTrades
      // No need to manually calculate or update stats
    } catch (error) {
      console.error('Error clearing month trades:', error);
    }
  };

  return (
    <TradeCalendar
      trades={calendar.cachedTrades}
      accountBalance={calendar.account_balance}
      maxDailyDrawdown={calendar.max_daily_drawdown}
      weeklyTarget={calendar.weekly_target}
      monthly_target={calendar.monthly_target}
      onTagUpdated={onTagUpdated}
      yearlyTarget={calendar.yearly_target}
      dynamicRiskSettings={{
        account_balance: calendar.account_balance,
        risk_per_trade: calendar.risk_per_trade,
        dynamic_risk_enabled: calendar.dynamic_risk_enabled,
        increased_risk_percentage: calendar.increased_risk_percentage,
        profit_threshold_percentage: calendar.profit_threshold_percentage
      }}
      requiredTagGroups={calendar.required_tag_groups}
      allTags={calendar.tags} // Pass calendar.tags for efficient tag access
      calendarName={calendar.name}
      onAddTrade={handleAddTrade}
      calendarDayNotes={calendar.days_notes ? Object.entries(calendar.days_notes).reduce((map, [k, v]) => map.set(k, v), new Map<string, string>()) : new Map<string, string>()}
      calendarNote={calendar.note}
      heroImageUrl={calendar.hero_image_url}
      heroImageAttribution={calendar.hero_image_attribution}

      // setLoading={(loading) => setLoadingTrades(loading)}
      // Score settings
      scoreSettings={calendar.score_settings}
      onUpdateCalendarProperty={onUpdateCalendarProperty}
      onUpdateTradeProperty={handleUpdateTradeProperty}
      onDeleteTrades={handleDeleteTrades}
      onAccountBalanceChange={handleChangeAccountBalance}
      onImportTrades={handleImportTrades}
      onClearMonthTrades={handleClearMonthTrades}
      onToggleTheme={onToggleTheme}
      mode={mode}
      // Pass pre-calculated statistics
      totalPnL={calendar.total_pnl}
      // Dynamic risk toggle handler
      onToggleDynamicRisk={(useActualAmounts) => onToggleDynamicRisk(calendar.id, useActualAmounts)}
      // Pass loading state
      isLoadingTrades={isLoadingTrades}
      // Calendar access callback
      calendar={calendar}
    />
  );
};

export default App;
