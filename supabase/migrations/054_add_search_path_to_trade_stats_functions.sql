-- Migration: Add search_path to Trade and Statistics Functions
-- Created: 2025-12-21
-- Description: Adds SET search_path = '' to complex trade manipulation and
--              statistics calculation functions for security hardening.
-- Issue: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- Advisor: security_advisor.json - function_search_path_mutable warnings

-- This migration recreates the most recent versions of trade and statistics functions
-- with the proper search_path security setting.

-- Note: Only the function signatures are being updated to add SET search_path.
-- The function bodies remain unchanged from their last migration (050_fix_session_in_trade_functions.sql
-- and 037_update_calculate_stats_with_trades_param.sql).

-- =====================================================
-- TRADE MANIPULATION FUNCTIONS
-- =====================================================

-- These functions are defined with their full implementations in migration 050.
-- We're adding the SET search_path directive to each.

-- Add search_path to add_trade_with_tags
-- Note: This requires recreating the entire function with the SET clause
-- The function body is identical to the one in 050_fix_session_in_trade_functions.sql

ALTER FUNCTION public.add_trade_with_tags(JSONB, UUID) SET search_path = '';

-- Add search_path to update_trade_with_tags
ALTER FUNCTION public.update_trade_with_tags(UUID, JSONB, UUID) SET search_path = '';

-- Add search_path to delete_trade_transactional
ALTER FUNCTION public.delete_trade_transactional(UUID, UUID) SET search_path = '';

-- =====================================================
-- CALENDAR STATISTICS FUNCTIONS
-- =====================================================

-- These functions are defined with their full implementations in migration 037.
-- We're adding the SET search_path directive to each.

-- Add search_path to get_calendar_stats
ALTER FUNCTION public.get_calendar_stats(UUID, JSONB) SET search_path = '';

-- Add search_path to trigger_calculate_calendar_stats (if not already done)
-- This is a trigger function, so it needs special handling
DROP FUNCTION IF EXISTS public.trigger_calculate_calendar_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_calculate_calendar_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_calendar_id UUID;
BEGIN
    -- Determine which calendar to update based on the operation
    IF TG_OP = 'DELETE' THEN
        v_calendar_id := OLD.calendar_id;
    ELSE
        v_calendar_id := NEW.calendar_id;
    END IF;

    -- Skip if calendar_id is null
    IF v_calendar_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Asynchronously trigger stats calculation
    -- This prevents blocking the main transaction
    PERFORM pg_notify(
        'calendar_stats_update',
        json_build_object(
            'calendar_id', v_calendar_id,
            'operation', TG_OP
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- =====================================================
-- PERFORMANCE CALCULATION FUNCTIONS
-- =====================================================

-- These functions may not exist in all databases, so we use conditional ALTER

-- Add search_path to performance calculation functions if they exist
DO $$
BEGIN
    -- calculate_performance_metrics
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_performance_metrics') THEN
        ALTER FUNCTION public.calculate_performance_metrics(UUID, DATE, DATE) SET search_path = '';
    END IF;

    -- calculate_chart_data
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_chart_data') THEN
        ALTER FUNCTION public.calculate_chart_data(UUID, DATE, DATE) SET search_path = '';
    END IF;

    -- calculate_tag_performance
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_tag_performance') THEN
        ALTER FUNCTION public.calculate_tag_performance(UUID, DATE, DATE) SET search_path = '';
    END IF;

    -- calculate_economic_event_correlations
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_economic_event_correlations') THEN
        ALTER FUNCTION public.calculate_economic_event_correlations(UUID, DATE, DATE) SET search_path = '';
    END IF;

    -- Multi-calendar variants
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_performance_metrics_multi') THEN
        ALTER FUNCTION public.calculate_performance_metrics_multi(UUID[], DATE, DATE) SET search_path = '';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_chart_data_multi') THEN
        ALTER FUNCTION public.calculate_chart_data_multi(UUID[], DATE, DATE) SET search_path = '';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_tag_performance_multi') THEN
        ALTER FUNCTION public.calculate_tag_performance_multi(UUID[], DATE, DATE) SET search_path = '';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_economic_event_correlations_multi') THEN
        ALTER FUNCTION public.calculate_economic_event_correlations_multi(UUID[], DATE, DATE) SET search_path = '';
    END IF;
END $$;

-- =====================================================
-- REALTIME/BROADCAST TRIGGER FUNCTIONS
-- =====================================================

-- These trigger functions handle broadcasting changes via Supabase Realtime

-- Function: trigger_broadcast_trade_changes
DROP FUNCTION IF EXISTS public.trigger_broadcast_trade_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_broadcast_trade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_operation TEXT;
    v_record JSONB;
BEGIN
    -- Determine operation type
    v_operation := lower(TG_OP);

    -- Build record payload
    IF TG_OP = 'DELETE' THEN
        v_record := to_jsonb(OLD);
    ELSE
        v_record := to_jsonb(NEW);
    END IF;

    -- Broadcast via pg_notify for Supabase Realtime
    PERFORM pg_notify(
        'trade_changes',
        json_build_object(
            'type', v_operation,
            'table', 'trades',
            'record', v_record,
            'calendar_id', COALESCE(NEW.calendar_id, OLD.calendar_id)
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function: trigger_broadcast_note_changes
DROP FUNCTION IF EXISTS public.trigger_broadcast_note_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_broadcast_note_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_operation TEXT;
    v_record JSONB;
BEGIN
    v_operation := lower(TG_OP);

    IF TG_OP = 'DELETE' THEN
        v_record := to_jsonb(OLD);
    ELSE
        v_record := to_jsonb(NEW);
    END IF;

    PERFORM pg_notify(
        'note_changes',
        json_build_object(
            'type', v_operation,
            'table', 'notes',
            'record', v_record,
            'calendar_id', COALESCE(NEW.calendar_id, OLD.calendar_id)
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function: trigger_broadcast_economic_event_changes
DROP FUNCTION IF EXISTS public.trigger_broadcast_economic_event_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_broadcast_economic_event_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_operation TEXT;
    v_record JSONB;
BEGIN
    v_operation := lower(TG_OP);

    IF TG_OP = 'DELETE' THEN
        v_record := to_jsonb(OLD);
    ELSE
        v_record := to_jsonb(NEW);
    END IF;

    PERFORM pg_notify(
        'economic_event_changes',
        json_build_object(
            'type', v_operation,
            'table', 'economic_events',
            'record', v_record
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- =====================================================
-- RECREATE TRIGGERS (if they were dropped)
-- =====================================================

-- Trade change broadcast trigger
DROP TRIGGER IF EXISTS broadcast_trade_changes ON public.trades;
CREATE TRIGGER broadcast_trade_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_broadcast_trade_changes();

-- Note change broadcast trigger
DROP TRIGGER IF EXISTS broadcast_note_changes ON public.notes;
CREATE TRIGGER broadcast_note_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_broadcast_note_changes();

-- Economic event broadcast trigger
DROP TRIGGER IF EXISTS broadcast_economic_event_changes ON public.economic_events;
CREATE TRIGGER broadcast_economic_event_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.economic_events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_broadcast_economic_event_changes();

-- Calendar stats calculation trigger
DROP TRIGGER IF EXISTS calculate_calendar_stats_trigger ON public.trades;
CREATE TRIGGER calculate_calendar_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_calculate_calendar_stats();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.add_trade_with_tags(JSONB, UUID) IS
    'Adds a new trade with tags in a transaction. SET search_path = '''' for security.';

COMMENT ON FUNCTION public.update_trade_with_tags(UUID, JSONB, UUID) IS
    'Updates an existing trade with tags in a transaction. SET search_path = '''' for security.';

COMMENT ON FUNCTION public.delete_trade_transactional(UUID, UUID) IS
    'Deletes a trade in a transaction with proper cleanup. SET search_path = '''' for security.';

COMMENT ON FUNCTION public.trigger_calculate_calendar_stats() IS
    'Trigger to recalculate calendar statistics when trades change. SET search_path = '''' for security.';

COMMENT ON FUNCTION public.trigger_broadcast_trade_changes() IS
    'Broadcasts trade changes via pg_notify for Supabase Realtime. SET search_path = '''' for security.';
