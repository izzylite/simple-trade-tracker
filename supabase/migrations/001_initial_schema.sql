-- Simple Trade Tracker - PostgreSQL Schema Migration
-- Migrating from Firebase Firestore to Supabase PostgreSQL
-- Created: 2025-08-13

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- USERS TABLE
-- =====================================================
-- Stores user information (replaces Firebase Auth user data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid TEXT UNIQUE NOT NULL, -- For migration compatibility
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    provider TEXT DEFAULT 'google',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- CALENDARS TABLE  
-- =====================================================
-- Main trading calendars (replaces Firestore 'calendars' collection)
CREATE TABLE calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Account settings
    account_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    max_daily_drawdown DECIMAL(15,2) NOT NULL DEFAULT 0,
    weekly_target DECIMAL(15,2),
    monthly_target DECIMAL(15,2),
    yearly_target DECIMAL(15,2),
    risk_per_trade DECIMAL(5,2),
    
    -- Dynamic risk settings
    dynamic_risk_enabled BOOLEAN DEFAULT false,
    increased_risk_percentage DECIMAL(5,2),
    profit_threshold_percentage DECIMAL(5,2),
    
    -- Duplication tracking
    duplicated_calendar BOOLEAN DEFAULT false,
    source_calendar_id UUID REFERENCES calendars(id),
    
    -- Soft delete / trash
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    auto_delete_at TIMESTAMPTZ,
    
    -- Tag validation
    required_tag_groups TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}', -- All tags used in this calendar
    
    -- Notes and media
    note TEXT,
    hero_image_url TEXT,
    hero_image_attribution JSONB,
    days_notes JSONB DEFAULT '{}', -- Key-value pairs for daily notes
    
    -- Score settings
    score_settings JSONB,
    
    -- Economic calendar settings
    economic_calendar_filters JSONB,
    pinned_events JSONB DEFAULT '[]',
    
    -- Calculated statistics (updated by triggers)
    win_rate DECIMAL(5,2) DEFAULT 0,
    profit_factor DECIMAL(8,4) DEFAULT 0,
    max_drawdown DECIMAL(5,2) DEFAULT 0,
    target_progress DECIMAL(5,2) DEFAULT 0,
    pnl_performance DECIMAL(5,2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    total_pnl DECIMAL(15,2) DEFAULT 0,
    drawdown_start_date TIMESTAMPTZ,
    drawdown_end_date TIMESTAMPTZ,
    drawdown_recovery_needed DECIMAL(15,2) DEFAULT 0,
    drawdown_duration INTEGER DEFAULT 0,
    avg_win DECIMAL(15,2) DEFAULT 0,
    avg_loss DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    
    -- Period statistics
    weekly_pnl DECIMAL(15,2) DEFAULT 0,
    monthly_pnl DECIMAL(15,2) DEFAULT 0,
    yearly_pnl DECIMAL(15,2) DEFAULT 0,
    weekly_pnl_percentage DECIMAL(5,2) DEFAULT 0,
    monthly_pnl_percentage DECIMAL(5,2) DEFAULT 0,
    yearly_pnl_percentage DECIMAL(5,2) DEFAULT 0,
    weekly_progress DECIMAL(5,2) DEFAULT 0,
    monthly_progress DECIMAL(5,2) DEFAULT 0,
    
    -- Sharing
    share_link TEXT,
    is_shared BOOLEAN DEFAULT false,
    shared_at TIMESTAMPTZ,
    share_id TEXT UNIQUE
);

-- =====================================================
-- TRADES TABLE
-- =====================================================
-- Individual trades (replaces Firestore subcollection structure)
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Trade identification (for migration compatibility)
    firestore_id TEXT, -- Original Firestore document ID
    
    -- Core trade data
    name TEXT,
    amount DECIMAL(15,2) NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('win', 'loss', 'breakeven')),
    trade_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Trade details
    entry_price DECIMAL(15,8),
    exit_price DECIMAL(15,8),
    risk_to_reward DECIMAL(8,4),
    partials_taken BOOLEAN DEFAULT false,
    session TEXT CHECK (session IN ('Asia', 'London', 'NY AM', 'NY PM')),
    notes TEXT,
    
    -- Tags and categorization
    tags TEXT[] DEFAULT '{}',
    
    -- Status flags
    is_deleted BOOLEAN DEFAULT false,
    is_temporary BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    
    -- Sharing
    share_link TEXT,
    is_shared BOOLEAN DEFAULT false,
    shared_at TIMESTAMPTZ,
    share_id TEXT UNIQUE
);

-- =====================================================
-- TRADE_IMAGES TABLE
-- =====================================================
-- Trade images (replaces Firebase Storage references)
CREATE TABLE trade_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Image metadata
    filename TEXT NOT NULL,
    original_filename TEXT,
    storage_path TEXT NOT NULL, -- Supabase Storage path
    url TEXT NOT NULL, -- Public URL
    
    -- Image properties
    width INTEGER,
    height INTEGER,
    file_size INTEGER, -- bytes
    mime_type TEXT,
    caption TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ECONOMIC_EVENTS TABLE
-- =====================================================
-- Economic calendar events (replaces Firestore 'economicEvents' collection)
CREATE TABLE economic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event identification
    external_id TEXT UNIQUE NOT NULL, -- Original event ID from data source
    currency TEXT NOT NULL,
    event_name TEXT NOT NULL,
    impact TEXT NOT NULL CHECK (impact IN ('Low', 'Medium', 'High', 'Holiday', 'Non-Economic')),
    
    -- Timing
    event_date DATE NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    time_utc TEXT NOT NULL, -- ISO string
    unix_timestamp BIGINT, -- Unix timestamp in milliseconds
    
    -- Event data
    actual_value TEXT,
    forecast_value TEXT,
    previous_value TEXT,
    actual_result_type TEXT CHECK (actual_result_type IN ('good', 'bad', 'neutral', '')),
    
    -- Location and display
    country TEXT,
    flag_code TEXT,
    flag_url TEXT,
    
    -- Metadata
    is_all_day BOOLEAN DEFAULT false,
    description TEXT,
    source_url TEXT,
    data_source TEXT DEFAULT 'myfxbook',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRADE_ECONOMIC_EVENTS TABLE
-- =====================================================
-- Junction table linking trades to economic events
CREATE TABLE trade_economic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    economic_event_id UUID NOT NULL REFERENCES economic_events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(trade_id, economic_event_id)
);

-- =====================================================
-- SHARED_TRADES TABLE
-- =====================================================
-- Shared trade links (replaces Firestore 'sharedTrades' collection)
CREATE TABLE shared_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id TEXT UNIQUE NOT NULL,
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sharing metadata
    share_link TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Access tracking
    last_viewed_at TIMESTAMPTZ,
    viewer_ips JSONB DEFAULT '[]'
);

-- =====================================================
-- SHARED_CALENDARS TABLE  
-- =====================================================
-- Shared calendar links (replaces Firestore 'sharedCalendars' collection)
CREATE TABLE shared_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id TEXT UNIQUE NOT NULL,
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sharing metadata
    share_link TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Access tracking
    last_viewed_at TIMESTAMPTZ,
    viewer_ips JSONB DEFAULT '[]'
);
