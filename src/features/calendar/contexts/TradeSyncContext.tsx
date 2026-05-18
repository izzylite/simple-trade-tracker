/**
 * TradeSyncContext
 *
 * Context for synchronizing trade updates across components.
 * Provides:
 * 1. Trade sync events (update/insert/delete) for data synchronization
 * 2. Global updatingTradeIds state for showing progress indicators
 *
 * When a trade is updated in useCalendarTrades, it broadcasts the update
 * to all subscribers (e.g., PerformanceCharts, TradeList).
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Trade } from '../types/dualWrite';

export type TradeSyncEventType = 'update' | 'insert' | 'delete';

export interface TradeSyncEvent {
  type: TradeSyncEventType;
  trade: Trade;
  timestamp: number;
}

interface TradeSyncContextValue {
  /**
   * The most recent trade sync event
   */
  lastSyncEvent: TradeSyncEvent | null;

  /**
   * Set of trade IDs currently being updated (global state)
   */
  updatingTradeIds: Set<string>;

  /**
   * Check if a specific trade is currently being updated
   */
  isTradeUpdating: (tradeId: string) => boolean;

  /**
   * Mark a trade as updating or not updating
   */
  setTradeUpdating: (tradeId: string, isUpdating: boolean) => void;

  /**
   * Broadcast a trade update to all subscribers
   */
  broadcastTradeUpdate: (trade: Trade) => void;

  /**
   * Broadcast a trade insertion to all subscribers
   */
  broadcastTradeInsert: (trade: Trade) => void;

  /**
   * Broadcast a trade deletion to all subscribers
   */
  broadcastTradeDelete: (trade: Trade) => void;
}

const TradeSyncContext = createContext<TradeSyncContextValue | undefined>(undefined);

interface TradeSyncProviderProps {
  children: ReactNode;
}

export const TradeSyncProvider: React.FC<TradeSyncProviderProps> = ({ children }) => {
  const [lastSyncEvent, setLastSyncEvent] = useState<TradeSyncEvent | null>(null);
  const [updatingTradeIds, setUpdatingTradeIds] = useState<Set<string>>(new Set());

  const isTradeUpdating = useCallback((tradeId: string) => {
    return updatingTradeIds.has(tradeId);
  }, [updatingTradeIds]);

  const setTradeUpdating = useCallback((tradeId: string, isUpdating: boolean) => {
    setUpdatingTradeIds(prev => {
      const next = new Set(prev);
      if (isUpdating) {
        next.add(tradeId);
      } else {
        next.delete(tradeId);
      }
      return next;
    });
  }, []);

  const broadcastTradeUpdate = useCallback((trade: Trade) => {
    setLastSyncEvent({
      type: 'update',
      trade,
      timestamp: Date.now()
    });
  }, []);

  const broadcastTradeInsert = useCallback((trade: Trade) => {
    setLastSyncEvent({
      type: 'insert',
      trade,
      timestamp: Date.now()
    });
  }, []);

  const broadcastTradeDelete = useCallback((trade: Trade) => {
    setLastSyncEvent({
      type: 'delete',
      trade,
      timestamp: Date.now()
    });
  }, []);

  const value: TradeSyncContextValue = {
    lastSyncEvent,
    updatingTradeIds,
    isTradeUpdating,
    setTradeUpdating,
    broadcastTradeUpdate,
    broadcastTradeInsert,
    broadcastTradeDelete
  };

  return (
    <TradeSyncContext.Provider value={value}>
      {children}
    </TradeSyncContext.Provider>
  );
};

/**
 * Hook to access the trade sync context
 */
export const useTradeSyncContext = (): TradeSyncContextValue => {
  const context = useContext(TradeSyncContext);
  if (context === undefined) {
    throw new Error('useTradeSyncContext must be used within a TradeSyncProvider');
  }
  return context;
};

/**
 * Optional hook that returns undefined if not within provider
 * Useful for components that can work with or without the provider
 */
export const useTradeSyncContextOptional = (): TradeSyncContextValue | undefined => {
  return useContext(TradeSyncContext);
};
