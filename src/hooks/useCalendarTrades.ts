/**
 * useCalendarTrades Hook
 *
 * Hook for fetching and managing trades for a specific calendar with real-time subscriptions.
 * Handles trade additions, updates, and deletions with optimistic updates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Trade } from "../types/dualWrite";
import * as calendarService from "../services/calendarService";
import { useRealtimeSubscription } from "./useRealtimeSubscription";
import { logger } from "../utils/logger";
import {
  calculateEffectiveRiskPercentage,
  calculateRiskAmount,
  DynamicRiskSettings,
} from "../utils/dynamicRiskUtils";
import { supabase } from "../config/supabase";
export interface UseCalendarTradesOptions {
  /**
   * Calendar ID to fetch trades for
   */
  calendarId: string | undefined;
  selectedCalendar?: Calendar | null;
  setLoading: (
    loading: boolean,
    loadingAction: "loading" | "importing" | "exporting",
  ) => void;

  /**
   * Whether to enable real-time subscriptions
   * @default true
   */
  enableRealtime?: boolean;
}

/**
 * Custom hook to fetch and manage trades for a calendar with real-time updates
 */
export function useCalendarTrades(options: UseCalendarTradesOptions) {
  const { calendarId, selectedCalendar, enableRealtime = true, setLoading } =
    options;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const loadAttemptedRef = useRef<boolean>(false);

  /**
   * Fetch all trades for the calendar
   */
  const fetchTrades = useCallback(async () => {
    setCalendar(selectedCalendar || null);
    if (!calendarId) {
      setTrades([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [allTrades, calendar] = await Promise.all([
        calendarService.getAllTrades(calendarId),
        calendarService.getCalendar(calendarId),
      ]);
      setCalendar(calendar);
      setTrades(allTrades);
      logger.log(
        `✅ Loaded ${allTrades.length} trades for calendar ${calendarId}`,
      );
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error("Failed to fetch trades");
      logger.error("Error fetching trades:", error);
      setError(error);
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    setLoading(isLoading, "loading");
  }, [isLoading]);

  /**
   * Load trades on mount or when calendarId changes
   */
  useEffect(() => {
    if (calendarId && !loadAttemptedRef.current) {
      loadAttemptedRef.current = true;
      fetchTrades();
    }

    // Reset load attempted when calendar changes
    return () => {
      if (calendarId) {
        loadAttemptedRef.current = false;
      }
    };
  }, [calendarId, fetchTrades]);

  /**
   * Add a trade with optimistic update
   */
  const addTrade = useCallback(
    async (trade: Trade) => {
      if (!calendarId) {
        throw new Error("Calendar ID is required");
      }

      // Optimistic update using functional state update
      setTrades((prev) => [...prev, trade]);

      try {
        await calendarService.addTrade(calendarId, trade);
        logger.log(`✅ Trade added: ${trade.id}`);
        // Real-time subscription will handle the update
      } catch (err) {
        // Revert optimistic update on error
        setTrades((prev) => prev.filter((t) => t.id !== trade.id));
        logger.error("Error adding trade:", err);
        throw err;
      }
    },
    [calendarId], // Removed 'trades' dependency
  );

  const handleUpdateTradeProperty = async (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade,
    createIfNotExists?: (tradeId: string) => Trade,
  ): Promise<Trade | undefined> => {
    // Find the calendar from state
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    try {
      // Check if trade exists in cached trades first

      let existingTrade = await calendarService.getTrade(calendar.id, tradeId);
      // If trade doesn't exist and we have a create function, create it
      if (!existingTrade && createIfNotExists) {
        // Create in database with all updates already applied
        const finalTrade = await calendarService.addTrade(
          calendar.id,
          updateCallback(createIfNotExists(tradeId)),
        );

        setTrades((prevTrades) => [...prevTrades, finalTrade]);
        return finalTrade;
      }
      if (!existingTrade) {
        throw new Error(`Trade with ID ${tradeId} not found`);
      }
      // Normal update flow for existing trades
      const result = await calendarService.updateTrade(
        existingTrade,
        updateCallback,
      );
      if (!result) {
        return undefined;
      }
      setTrades((prevTrades) =>
        prevTrades.map((trade) => trade.id === tradeId ? result : trade)
      );

      return result;
    } catch (error) {
      logger.error("Error updating trade:", error);
      throw error;
    }
  };

  /**
   * Delete trades with optimistic update
   */
  const deleteTrades = useCallback(
    async (tradeIds: string[]) => {
      if (!calendarId) {
        throw new Error("Calendar ID is required");
      }

      // Store previous trades for rollback
      let previousTrades: Trade[] = [];

      // Optimistic update using functional state update
      setTrades((prev) => {
        previousTrades = prev;
        return prev.filter((t) => !tradeIds.includes(t.id));
      });

      try {
        // Delete trades one by one
        await Promise.all(
          tradeIds.map((tradeId) => calendarService.deleteTrade(tradeId)),
        );
        logger.log(`✅ Deleted ${tradeIds.length} trade(s)`);
        // Real-time subscription will handle the update
      } catch (err) {
        // Revert optimistic update on error
        setTrades(previousTrades);
        logger.error("Error deleting trades:", err);
        throw err;
      }
    },
    [calendarId], // Removed 'trades' dependency
  );

  // Function to handle dynamic risk toggle
  const handleToggleDynamicRisk = useCallback(async (
    useActualAmounts: boolean,
  ) => {
    // Use calendar from hook state
    if (!calendar) return;

    // If using actual amounts, reload the original trades from the database
    if (useActualAmounts) {
      logger.log("Resetting to actual trade amounts...");
      // Reload all trades for the calendar to get the original values
      fetchTrades();
      return;
    }

    // Recalculate ALL trade amounts based on risk to reward to show potential with consistent risk management
    const recalculateTrades = async () => {
      if (!calendar.risk_per_trade || !trades.length) {
        return;
      }

      logger.log(
        "Recalculating ALL trades based on risk to reward to show potential...",
      );

      // Sort trades by date to calculate cumulative P&L correctly
      const sortedTrades = [...trades].sort((a, b) =>
        new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      );

      let cumulativePnL = 0;

      // Define dynamic risk settings once outside the loop
      const dynamicRiskSettings: DynamicRiskSettings = {
        account_balance: calendar.account_balance,
        risk_per_trade: calendar.risk_per_trade,
        dynamic_risk_enabled: calendar.dynamic_risk_enabled,
        increased_risk_percentage: calendar.increased_risk_percentage,
        profit_threshold_percentage: calendar.profit_threshold_percentage,
      };

      // Build array of recalculated trades as we go
      const updatedTrades: Trade[] = [];

      for (let index = 0; index < sortedTrades.length; index++) {
        const trade = sortedTrades[index];

        // Skip trades without risk to reward ratio
        if (!trade.risk_to_reward || trade.trade_type === "breakeven") {
          cumulativePnL += trade.amount;
          updatedTrades.push(trade);
          continue;
        }

        // Use the already-recalculated trades for effective risk calculation
        const effectiveRisk = calculateEffectiveRiskPercentage(
          new Date(trade.trade_date),
          updatedTrades, // ✅ Use recalculated trades, not original
          dynamicRiskSettings,
        );

        const riskAmount = calculateRiskAmount(
          effectiveRisk,
          calendar.account_balance,
          cumulativePnL,
        );
        logger.log(
          `Effective risk for ${trade.name}: ${effectiveRisk}   risk amount: ${riskAmount}`,
        );
        // Calculate new amount based on trade type and risk to reward
        let newAmount = 0;
        if (trade.trade_type === "win") {
          newAmount = Math.round(riskAmount * trade.risk_to_reward);
        } else if (trade.trade_type === "loss") {
          newAmount = -Math.round(riskAmount);
        }

        // Update cumulative P&L with the new amount
        cumulativePnL += newAmount;

        // Add the recalculated trade to the array
        updatedTrades.push({
          ...trade,
          amount: newAmount,
        });
      }

      // Calculate stats with hypothetical trades (does NOT update database)
      const stats = await calendarService.calculateCalendarStats(
        calendar.id,
        updatedTrades,
      );

      // Update the calendar state with recalculated trades and the hypothetical stats
      setTrades(updatedTrades);
      setCalendar({
        ...calendar,
        ...stats,
      });
    };

    // Execute the recalculation and get the results
    setIsLoading(true);
    await recalculateTrades();
    setIsLoading(false);
  }, [calendar, trades, fetchTrades]);

  const handleImportTrades = useCallback(async (
    importedTrades: Partial<Trade>[],
  ) => {
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    try {
      // Show loading indicator
      setIsLoading(true);
      const result = await calendarService.importTrades(
        calendar.id,
        trades,
        importedTrades,
      );
      setTrades(result);
    } catch (error) {
      logger.error("Error importing trades:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [calendar, calendarId]);

  /**
   * Subscribe to calendar changes with real-time updates using Broadcast
   */
  useRealtimeSubscription({
    channelName: `calendar-${calendarId}`,
    enabled: enableRealtime && !!calendarId,
    onChannelCreated: (channel) => {
      logger.log(
        `🔧 Setting up calendar broadcast subscription for calendar-${calendarId}`,
      );

      // Listen for ALL broadcast events to debug
      channel.on(
        "broadcast",
        {
          event: "*", // Listen to all events
        },
        (payload: any) => {
          logger.log(
            `� Broadcast event received on calendar-${calendarId}:`,
            payload,
          );
          // The payload structure from realtime.broadcast_changes is:
          // { event: "UPDATE", type: "broadcast", payload: { record: {...}, old_record: {...}, ... } }
          if (payload.event === "UPDATE" && payload.payload?.record) {
            const updatedCalendarData = payload.payload.record as Calendar;
            // Update local calendar state with new data
            setCalendar(updatedCalendarData);
          }
        },
      );
    },
    onSubscribed: () => {
      logger.log(
        `✅ Calendar broadcast subscription ACTIVE for calendar-${calendarId}`,
      );
    },
    onError: (error) => {
      logger.error(
        `❌ Calendar broadcast subscription ERROR for calendar-${calendarId}:`,
        error,
      );
    },
  });

  /**
   * Subscribe to trade changes with real-time updates using Broadcast
   */
  useRealtimeSubscription({
    channelName: `trades-${calendarId}`,
    enabled: enableRealtime && !!calendarId,
    onChannelCreated: (channel) => {
      // Listen for INSERT events
      channel.on(
        "broadcast",
        {
          event: "INSERT",
        },
        (payload: any) => {
          if (payload.payload?.record) {
            const newTrade = payload.payload.record as Trade;
            setTrades((prevTrades) => {
              const exists = prevTrades.some((t) => t.id === newTrade.id);
              if (exists) return prevTrades;
              return [...prevTrades, newTrade];
            });
            logger.log(`➕ Trade added via broadcast: ${newTrade.id}`);
          }
        },
      );

      // Listen for UPDATE events
      channel.on(
        "broadcast",
        {
          event: "UPDATE",
        },
        (payload: any) => {
          if (payload.payload?.record) {
            const updatedTrade = payload.payload.record as Trade;
            setTrades((prevTrades) =>
              prevTrades.map((trade) =>
                trade.id === updatedTrade.id ? updatedTrade : trade
              )
            );
            logger.log(`✏️ Trade updated via broadcast: ${updatedTrade.id}`);
          }
        },
      );

      // Listen for DELETE events
      channel.on(
        "broadcast",
        {
          event: "DELETE",
        },
        (payload: any) => {
          if (payload.payload?.old_record) {
            const deletedTrade = payload.payload.old_record as Trade;
            setTrades((prevTrades) =>
              prevTrades.filter((trade) => trade.id !== deletedTrade.id)
            );
            logger.log(`🗑️ Trade deleted via broadcast: ${deletedTrade.id}`);
          }
        },
      );
    },
    onSubscribed: () => {
      logger.log(
        `✅ Trade broadcast subscription ACTIVE for calendar-${calendarId}`,
      );
    },
    onError: (error) => {
      logger.error(
        `❌ Trade broadcast subscription ERROR for calendar-${calendarId}:`,
        error,
      );
    },
  });

  // Handler for account balance changes
  const handleAccountBalanceChange = useCallback(async (newBalance: number) => {
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    try {
      await calendarService.updateCalendar(calendar.id, {
        account_balance: newBalance,
      });
      // Update local calendar state
      setCalendar((prev) =>
        prev ? { ...prev, account_balance: newBalance } : prev
      );
    } catch (error) {
      logger.error("Error updating account balance:", error);
      throw error;
    }
  }, [calendar, calendarId]);

  // Handler for clearing month trades
  const handleClearMonthTrades = useCallback(
    async (month: number, year: number) => {
      if (!calendar) {
        throw new Error(`Calendar with ID ${calendarId} not found`);
      }
      try {
        const tradesToKeep = trades.filter((trade: Trade) => {
          const tradeDate = new Date(trade.trade_date);
          return tradeDate.getMonth() !== month ||
            tradeDate.getFullYear() !== year;
        });

        const tradesToDelete = trades.filter((trade) => {
          const tradeDate = new Date(trade.trade_date);
          return tradeDate.getFullYear() === year &&
            tradeDate.getMonth() === month;
        });

        // First update the local state with just the trades
        setTrades(tradesToKeep);
        await calendarService.getTradeRepository().bulkDelete(tradesToDelete);

        // Stats are automatically recalculated by Supabase triggers after clearMonthTrades
        // No need to manually calculate or update stats
      } catch (error) {
        logger.error("Error clearing month trades:", error);
      }
    },
    [calendar, calendarId, fetchTrades],
  );

  /**
   * Handler for updating calendar properties
   */
  const handleUpdateCalendarProperty = useCallback(async (
    updateCallback: (calendar: Calendar) => Calendar,
  ): Promise<Calendar | undefined> => {
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    try {
      const updatedCalendar = await calendarService.updateCalendar(
        calendar.id,
        updateCallback(calendar),
      );

      if (updatedCalendar) {
        // Update local calendar state
        setCalendar(updatedCalendar);
        return updatedCalendar;
      }
    } catch (error) {
      logger.error("Error updating calendar:", error);
      throw error;
    }
    return undefined;
  }, [calendar, calendarId]);

  /**
   * Handle tag updates using Supabase Edge Function
   * This is the single source of truth for tag updates
   */
  const onTagUpdated = useCallback(async (
    oldTag: string,
    newTag: string,
  ): Promise<{ success: boolean; tradesUpdated: number }> => {
    if (!calendarId) {
      logger.error("Cannot update tag: calendarId is undefined");
      return { success: false, tradesUpdated: 0 };
    }

    try {
      // Optimistically update the UI

      logger.log(
        `🏷️ Updating tag via edge function: "${oldTag}" → "${newTag}"`,
      );

      // Call Supabase Edge Function to update tag
      const { data, error: invokeError } = await supabase.functions.invoke(
        "update-tag",
        {
          body: {
            calendar_id: calendarId,
            old_tag: oldTag,
            new_tag: newTag,
          },
        },
      );

      if (invokeError) {
        logger.error("Edge function error:", invokeError);
        throw invokeError;
      }

      if (data && data.success) {
        logger.log(
          `✅ Tag updated successfully: ${data.tradesUpdated} trades affected`,
        );
        // Real-time subscription will handle the UI update via broadcast
        return { success: true, tradesUpdated: data.tradesUpdated || 0 };
      } else {
        logger.error("Tag update failed:", data?.message || "Unknown error");
        logger.error("Full response data:", data);
        return { success: false, tradesUpdated: 0 };
      }
    } catch (error) {
      logger.error("Error updating tag:", error);
      return { success: false, tradesUpdated: 0 };
    }
  }, [calendarId]);

  function tagUpdateUIState(oldTag: string, newTag: string) {
    // Use calendar from hook state
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }
    logger.log(`Updating trades for tag change: ${oldTag} -> ${newTag}`);
    // Helper function to update tags in an array, handling group name changes
    const updateTagsWithGroupNameChange = (tags: string[]) => {
      // Check if this is a group name change
      const oldGroup = oldTag.includes(":") ? oldTag.split(":")[0] : null;
      const newGroup = newTag && newTag.includes(":")
        ? newTag.split(":")[0]
        : null;
      const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

      if (isGroupNameChange) {
        // Group name changed - update all tags in the old group
        return tags.map((tag: string) => {
          if (tag === oldTag) {
            // Direct match - replace with new tag
            return newTag;
          } else if (tag.includes(":") && tag.split(":")[0] === oldGroup) {
            // Same group - update group name but keep tag name
            const tagName = tag.split(":")[1];
            return `${newGroup}:${tagName}`;
          } else {
            // Different group or ungrouped - keep as is
            return tag;
          }
        }).filter((tag) => tag !== ""); // Remove empty tags
      } else {
        // Not a group name change - just replace the specific tag
        return tags.map((tag) => tag === oldTag ? newTag : tag).filter((
          tag: string,
        ) => tag !== "");
      }
    };

    // Helper function to update required tag groups
    const updateRequiredTagGroups = (requiredGroups: string[]) => {
      const oldGroup = oldTag.includes(":") ? oldTag.split(":")[0] : null;
      const newGroup = newTag && newTag.includes(":")
        ? newTag.split(":")[0]
        : null;
      logger.log(`Updated required tag groups ${requiredGroups}`);
      if (oldGroup && newGroup && oldGroup !== newGroup) {
        // Group name changed, update it in requiredTagGroups
        return requiredGroups.map((group) =>
          group === oldGroup ? newGroup : group
        );
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
      const oldGroup = oldTag.includes(":") ? oldTag.split(":")[0] : null;
      const newGroup = newTag && newTag.includes(":")
        ? newTag.split(":")[0]
        : null;
      const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

      let updated = false;
      const updatedTags = [...trade.tags];

      if (isGroupNameChange) {
        // Group name change - update all tags in the old group
        for (let j = 0; j < updatedTags.length; j++) {
          const tag = updatedTags[j];
          if (tag === oldTag) {
            // Direct match - replace with new tag
            if (newTag.trim() === "") {
              updatedTags.splice(j, 1);
              j--; // Adjust index after removal
            } else {
              updatedTags[j] = newTag.trim();
            }
            updated = true;
          } else if (tag.includes(":") && tag.split(":")[0] === oldGroup) {
            // Same group - update group name but keep tag name
            const tagName = tag.split(":")[1];
            updatedTags[j] = `${newGroup}:${tagName}`;
            updated = true;
          }
        }
      } else {
        // Not a group name change - just replace the specific tag
        if (trade.tags.includes(oldTag)) {
          const tagIndex = updatedTags.indexOf(oldTag);
          if (newTag.trim() === "") {
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
    const updatedCachedTrades = trades.map(
      (trade: Trade) => {
        return updateTradeTagsWithGroupNameChange(trade);
      },
    );
    setTrades(updatedCachedTrades);
    // Update local state immediately
    setCalendar({
      ...calendar,
      tags: updateTagsWithGroupNameChange(calendar.tags || []),
      required_tag_groups: updateRequiredTagGroups(
        calendar.required_tag_groups || [],
      ),
    });
  }
  return {
    trades,
    calendar,
    isLoading,
    error,
    addTrade,
    deleteTrades,
    refresh: fetchTrades,
    handleUpdateTradeProperty,
    onTagUpdated,
    handleToggleDynamicRisk,
    handleImportTrades,
    handleAccountBalanceChange,
    handleClearMonthTrades,
    handleUpdateCalendarProperty,
  };
}
