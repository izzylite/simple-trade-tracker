/**
 * Pure helpers for building TradeForm shapes (add + edit).
 *
 * Extracted from TradeFormDialog so callers (TradeOperationsContext) can
 * import them without pulling the dialog's transitive dependency tree
 * (calendarService -> economic calendar UI -> react-markdown ESM, etc.),
 * which otherwise breaks jest under react-scripts.
 */
import { v4 as uuidv4 } from 'uuid';
import { Trade } from '../../types/dualWrite';
import type { NewTradeForm } from './TradeForm';

/** Generate a unique ID for a trade image — local mirror of
 * `calendarService.generateImageId` so this module has zero side-effect
 * imports. Same algorithm: timestamp + random suffix. */
const generateImageId = (): string =>
  `${Date.now()}_${Math.random().toString(36).substring(7)}`;

export const createNewTradeData = (): NewTradeForm => ({
  id: uuidv4(),
  name: '',
  amount: 0,
  trade_type: 'win',
  entry_price: 0,
  trade_date: null,
  exit_price: 0,
  stop_loss: 0,
  take_profit: 0,
  tags: [],
  risk_to_reward: 0,
  partials_taken: false,
  session: '',
  notes: '',
  pending_images: [],
  uploaded_images: [],
  economic_events: [],
});

export const createEditTradeData = (trade: Trade): NewTradeForm => ({
  id: trade.id,
  name: trade.name ? trade.name.replace(/^📈 /, '') : '',
  amount: Math.abs(trade.amount),
  trade_type: trade.trade_type,
  entry_price: trade.entry_price || 0,
  trade_date:
    trade.trade_date instanceof Date
      ? trade.trade_date
      : new Date(trade.trade_date),
  exit_price: trade.exit_price || 0,
  stop_loss: trade.stop_loss || 0,
  take_profit: trade.take_profit || 0,
  tags: trade.tags || [],
  risk_to_reward: trade.risk_to_reward || 0,
  partials_taken: trade.partials_taken || false,
  session:
    (trade.session as '' | 'Asia' | 'London' | 'NY AM' | 'NY PM') || '',
  notes: trade.notes || '',
  pending_images: [],
  is_temporary: trade.is_temporary,
  economic_events: trade.economic_events || [],
  uploaded_images: Array.isArray(trade.images)
    ? trade.images
        .filter((img) => img)
        .map((img, index) => ({
          ...img,
          id: img.id || generateImageId(),
          row: img.row !== undefined ? img.row : index,
          column: img.column !== undefined ? img.column : 0,
          column_width: img.column_width !== undefined ? img.column_width : 100,
        }))
    : [],
});
