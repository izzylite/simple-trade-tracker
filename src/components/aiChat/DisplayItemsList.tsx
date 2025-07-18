/**
 * Display Items List Component for AI Chat
 * Handles both trade cards and event cards based on display items from AI response
 */

import React from 'react';
import { Box } from '@mui/material';
import TradeCardList from './TradeCardList';
import EventCardList from './EventCardList';
import { DisplayItem } from '../../utils/aiResponseParser';
import { Trade } from '../../types/trade';
import { EconomicEvent } from '../../types/economicCalendar';

interface DisplayItemsListProps {
  displayItems: DisplayItem[];
  allTrades?: Trade[];
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  compact?: boolean;
  maxInitialDisplay?: number;
}

const DisplayItemsList: React.FC<DisplayItemsListProps> = ({
  displayItems,
  allTrades = [],
  onTradeClick,
  onEventClick,
  compact = true,
  maxInitialDisplay = 2
}) => {
  if (!displayItems || displayItems.length === 0) {
    return null;
  }

  // Separate trades and events
  const tradeItems = displayItems.filter(item => item.type === 'trade');
  const eventItems = displayItems.filter(item => item.type === 'event');

  // Get actual trade objects for trade items
  const trades = tradeItems
    .map(item => allTrades.find(trade => trade.id === item.id))
    .filter((trade): trade is Trade => trade !== undefined);

  // Get event IDs for event items
  const eventIds = eventItems.map(item => item.id);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Trade Cards */}
      {trades.length > 0 && (
        <TradeCardList
          trades={trades}
          title={`Trade${trades.length !== 1 ? 's' : ''}`}
          showSummary={true}
          compact={compact}
          maxInitialDisplay={maxInitialDisplay}
          onTradeClick={onTradeClick ? (trade) => onTradeClick(trade.id, trades) : undefined}
        />
      )}

      {/* Event Cards */}
      {eventIds.length > 0 && (
        <EventCardList
          eventIds={eventIds}
          title={`Economic Event${eventIds.length !== 1 ? 's' : ''}`}
          showSummary={true}
          compact={compact}
          maxInitialDisplay={maxInitialDisplay}
          onEventClick={onEventClick}
        />
      )}
    </Box>
  );
};

export default DisplayItemsList;
