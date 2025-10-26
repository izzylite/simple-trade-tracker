-- Simple Trade Tracker - Indexes and Security
-- Performance indexes and Row Level Security policies
-- Created: 2025-08-13

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Calendars indexes
CREATE INDEX idx_calendars_user_id ON calendars(user_id);
CREATE INDEX idx_calendars_created_at ON calendars(created_at);
CREATE INDEX idx_calendars_updated_at ON calendars(updated_at);
CREATE INDEX idx_calendars_is_deleted ON calendars(is_deleted);
CREATE INDEX idx_calendars_share_id ON calendars(share_id) WHERE share_id IS NOT NULL;
CREATE INDEX idx_calendars_user_active ON calendars(user_id, is_deleted) WHERE is_deleted = false;

-- Trades indexes
CREATE INDEX idx_trades_calendar_id ON trades(calendar_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_trade_date ON trades(trade_date);
CREATE INDEX idx_trades_trade_type ON trades(trade_type);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_trades_updated_at ON trades(updated_at);
CREATE INDEX idx_trades_is_deleted ON trades(is_deleted);
CREATE INDEX idx_trades_firestore_id ON trades(firestore_id) WHERE firestore_id IS NOT NULL;
CREATE INDEX idx_trades_share_id ON trades(share_id) WHERE share_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_trades_calendar_date ON trades(calendar_id, trade_date);
CREATE INDEX idx_trades_calendar_type ON trades(calendar_id, trade_type);
CREATE INDEX idx_trades_user_date ON trades(user_id, trade_date);
CREATE INDEX idx_trades_calendar_active ON trades(calendar_id, is_deleted) WHERE is_deleted = false;

-- GIN indexes for array and JSONB columns
CREATE INDEX idx_trades_tags ON trades USING GIN(tags);
CREATE INDEX idx_calendars_tags ON calendars USING GIN(tags);
CREATE INDEX idx_calendars_required_tag_groups ON calendars USING GIN(required_tag_groups);
CREATE INDEX idx_calendars_days_notes ON calendars USING GIN(days_notes);
CREATE INDEX idx_calendars_score_settings ON calendars USING GIN(score_settings);
CREATE INDEX idx_calendars_economic_filters ON calendars USING GIN(economic_calendar_filters);
CREATE INDEX idx_calendars_pinned_events ON calendars USING GIN(pinned_events);

-- Trade images indexes
CREATE INDEX idx_trade_images_trade_id ON trade_images(trade_id);
CREATE INDEX idx_trade_images_calendar_id ON trade_images(calendar_id);
CREATE INDEX idx_trade_images_user_id ON trade_images(user_id);
CREATE INDEX idx_trade_images_created_at ON trade_images(created_at);

-- Economic events indexes
CREATE INDEX idx_economic_events_external_id ON economic_events(external_id);
CREATE INDEX idx_economic_events_currency ON economic_events(currency);
CREATE INDEX idx_economic_events_impact ON economic_events(impact);
CREATE INDEX idx_economic_events_date ON economic_events(event_date);
CREATE INDEX idx_economic_events_time ON economic_events(event_time);
CREATE INDEX idx_economic_events_unix_timestamp ON economic_events(unix_timestamp);
CREATE INDEX idx_economic_events_country ON economic_events(country);
CREATE INDEX idx_economic_events_data_source ON economic_events(data_source);

-- Composite indexes for economic events (matching Firestore indexes)
CREATE INDEX idx_economic_events_date_time ON economic_events(event_date, event_time);
CREATE INDEX idx_economic_events_currency_date_time ON economic_events(currency, event_date, event_time);
CREATE INDEX idx_economic_events_impact_date_time ON economic_events(impact, event_date, event_time);

-- Trade economic events junction table indexes
CREATE INDEX idx_trade_economic_events_trade_id ON trade_economic_events(trade_id);
CREATE INDEX idx_trade_economic_events_event_id ON trade_economic_events(economic_event_id);

-- Shared trades indexes
CREATE INDEX idx_shared_trades_share_id ON shared_trades(share_id);
CREATE INDEX idx_shared_trades_trade_id ON shared_trades(trade_id);
CREATE INDEX idx_shared_trades_calendar_id ON shared_trades(calendar_id);
CREATE INDEX idx_shared_trades_user_id ON shared_trades(user_id);
CREATE INDEX idx_shared_trades_is_active ON shared_trades(is_active);
CREATE INDEX idx_shared_trades_created_at ON shared_trades(created_at);

-- Shared calendars indexes
CREATE INDEX idx_shared_calendars_share_id ON shared_calendars(share_id);
CREATE INDEX idx_shared_calendars_calendar_id ON shared_calendars(calendar_id);
CREATE INDEX idx_shared_calendars_user_id ON shared_calendars(user_id);
CREATE INDEX idx_shared_calendars_is_active ON shared_calendars(is_active);
CREATE INDEX idx_shared_calendars_created_at ON shared_calendars(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_economic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_calendars ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = firebase_uid);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = firebase_uid);

-- Calendars policies
CREATE POLICY "Users can view own calendars" ON calendars
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = calendars.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can create own calendars" ON calendars
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = calendars.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can update own calendars" ON calendars
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = calendars.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete own calendars" ON calendars
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = calendars.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- Trades policies
CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = trades.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can create own trades" ON trades
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = trades.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can update own trades" ON trades
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = trades.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete own trades" ON trades
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = trades.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- Trade images policies (similar pattern)
CREATE POLICY "Users can manage own trade images" ON trade_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = trade_images.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- Economic events policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view economic events" ON economic_events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Trade economic events junction policies
CREATE POLICY "Users can manage own trade economic events" ON trade_economic_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM trades 
            JOIN users ON users.id = trades.user_id
            WHERE trades.id = trade_economic_events.trade_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- Shared trades policies (public read for active shares)
CREATE POLICY "Public can view active shared trades" ON shared_trades
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own shared trades" ON shared_trades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = shared_trades.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- Shared calendars policies (similar to shared trades)
CREATE POLICY "Public can view active shared calendars" ON shared_calendars
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own shared calendars" ON shared_calendars
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = shared_calendars.user_id 
            AND users.firebase_uid = auth.uid()::text
        )
    );

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON calendars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_images_updated_at BEFORE UPDATE ON trade_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
