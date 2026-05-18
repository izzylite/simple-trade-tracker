import { Trade } from './trade';
import { Calendar } from './calendar';
import { EconomicCalendarFilterSettings } from '../hooks/useEconomicCalendarFilters';

/**
 * Shared interface for trade-related operations and callbacks.
 * Used to reduce prop drilling across components that handle trade interactions.
 *
 * Components using this interface:
 * - TradeList, TradeDetailExpanded
 * - TradesListDialog, EconomicEventDetailDialog
 * - EconomicCalendarDrawer, MonthlyStatisticsSection
 * - TradeGalleryDialog, AIChatDrawer
 * - DayDialog, TradeCalendarPage
 */
export interface TradeOperationsProps {
  // ===== Core Trade Operations =====

  /** Update a specific property of a trade */
  onUpdateTradeProperty?: (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade
  ) => Promise<Trade | undefined>;

  /** Open trade edit form */
  onEditTrade?: (trade: Trade) => void;

  /** Delete a single trade */
  onDeleteTrade?: (tradeId: string) => void;

  /** Delete multiple trades at once */
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;

  // ===== UI Operations =====

  /** Open image zoom dialog */
  onZoomImage?: (
    imageUrl: string,
    allImages?: string[],
    initialIndex?: number
  ) => void;

  /** Open gallery mode for trades */
  onOpenGalleryMode?: (
    trades: Trade[],
    initialTradeId?: string,
    title?: string,
    /** If set, dialog will fetch trades for this year when trades array is empty */
    fetchYear?: number
  ) => void;

  /** Handle shared trade link click (inline preview) */
  onSharedTradeClick?: (shareId: string, tradeId: string) => void;

  // ===== Calendar Operations =====

  /** Update calendar properties */
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;

  // ===== State Helpers =====

  /** Check if a trade is currently being updated */
  isTradeUpdating?: (tradeId: string) => boolean;

  /** IDs of trades currently being deleted (for UI feedback) */
  deletingTradeIds?: string[];

  // ===== Context Data =====

  /** Current calendar ID */
  calendarId?: string;

  /** Current calendar object */
  calendar?: Calendar;

  /** Whether the view is read-only (shared calendars) */
  isReadOnly?: boolean;

  /** Economic calendar filter settings getter */
  economicFilter?: (calendarId: string) => EconomicCalendarFilterSettings;
}

