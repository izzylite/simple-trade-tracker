-- Migration: Add missing indexes identified by query-vs-index audit
-- Date: 2026-03-21
--
-- This migration adds indexes for query patterns that currently lack
-- proper index support, organized by priority.

-- ============================================================
-- HIGH PRIORITY: Frequently used queries with no supporting index
-- ============================================================

-- 1. ai_conversations: trade_id has no index at all
--    Affects: findByTradeId() count + data, findByCalendarId() with trade_id IS NULL filter
CREATE INDEX IF NOT EXISTS idx_ai_conversations_trade_id
  ON ai_conversations(trade_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_calendar_no_trade
  ON ai_conversations(calendar_id, updated_at DESC)
  WHERE trade_id IS NULL;

-- 2. trades: is_pinned has no index
--    Affects: fetchPinnedTrades() - calendar_id + is_pinned = true + ORDER BY trade_date DESC
CREATE INDEX IF NOT EXISTS idx_trades_calendar_pinned
  ON trades(calendar_id, trade_date DESC)
  WHERE is_pinned = true;

-- 3. trades: session column has no index
--    Affects: searchTrades() session filter, fetchTradeCountsByEvents() optional session filter
CREATE INDEX IF NOT EXISTS idx_trades_calendar_session
  ON trades(calendar_id, session);

-- 4. calendars: deleted_at not covered by any index
--    Current idx_calendars_user_active is (user_id, updated_at DESC) with no deleted_at filter
--    Affects: findByUserId() and findTrashByUserId() - called on every page load
CREATE INDEX IF NOT EXISTS idx_calendars_user_active_not_deleted
  ON calendars(user_id, updated_at DESC)
  WHERE deleted_at IS NULL
    AND (mark_for_deletion IS NULL OR mark_for_deletion = false);

CREATE INDEX IF NOT EXISTS idx_calendars_user_trash
  ON calendars(user_id, updated_at DESC)
  WHERE deleted_at IS NOT NULL
    AND (mark_for_deletion IS NULL OR mark_for_deletion = false);

-- 5. notes: calendar_id IS NULL branch in OR queries has no index support
--    Affects: findByCalendarId(), findGamePlanDays(), queryByCalendarId(),
--             findRemindersByDay(), findRemindersByDate() (5 query methods)
CREATE INDEX IF NOT EXISTS idx_notes_global_active
  ON notes(updated_at DESC)
  WHERE calendar_id IS NULL AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_notes_global_reminders_weekly
  ON notes(reminder_type)
  WHERE calendar_id IS NULL
    AND is_archived = false
    AND is_reminder_active = true
    AND reminder_type = 'weekly';

CREATE INDEX IF NOT EXISTS idx_notes_global_reminders_once
  ON notes(reminder_date)
  WHERE calendar_id IS NULL
    AND is_archived = false
    AND is_reminder_active = true
    AND reminder_type = 'once';

-- ============================================================
-- MEDIUM PRIORITY: Less frequent or smaller data sets
-- ============================================================

-- 6. notes: findByUserId() fetches ALL notes (no is_archived filter)
--    Existing idx_notes_user_id_updated_at has WHERE is_archived = false, won't be used
CREATE INDEX IF NOT EXISTS idx_notes_user_id_all
  ON notes(user_id, updated_at DESC);

-- 7. economic_events: queries ORDER BY time_utc but indexes use event_time
CREATE INDEX IF NOT EXISTS idx_economic_events_date_time_utc
  ON economic_events(event_date, time_utc);

-- 8. economic_events: event_name ILIKE '%query%' needs trigram support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_economic_events_name_trgm
  ON economic_events USING gin(event_name gin_trgm_ops);

-- 9. trades: name/notes ILIKE '%term%' in searchTrades() needs trigram support
CREATE INDEX IF NOT EXISTS idx_trades_name_trgm
  ON trades USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trades_notes_trgm
  ON trades USING gin(notes gin_trgm_ops);

-- 10. notes: title/content ILIKE '%query%' in queryByUserId() and queryByCalendarId()
CREATE INDEX IF NOT EXISTS idx_notes_title_trgm
  ON notes USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notes_content_trgm
  ON notes USING gin(content gin_trgm_ops);
