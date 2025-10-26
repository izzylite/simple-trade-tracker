# TypeScript Types vs Supabase Database Schema Comparison

This document compares the TypeScript type definitions with the actual Supabase database schema to ensure they match.

## ✅ Users Table

### Database Schema (Supabase)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    firebase_uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    provider TEXT DEFAULT 'google',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);
```

### TypeScript Interface
```typescript
export interface User extends BaseEntity {
  email: string;
  display_name?: string;
  photo_url?: string;
  provider: string;
  firebase_uid?: string;
  is_active: boolean;
  last_login?: Date;
}
```

**Status:** ✅ **MATCHES** - All fields use snake_case and match the database schema.

---

## ✅ Trades Table

### Database Schema (Supabase)
```sql
CREATE TABLE trades (
    id UUID PRIMARY KEY,
    calendar_id UUID NOT NULL,
    user_id UUID NOT NULL,
    firestore_id TEXT,
    name TEXT,
    amount DECIMAL(15,2) NOT NULL,
    trade_type TEXT NOT NULL,
    trade_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    entry_price DECIMAL(15,8),
    exit_price DECIMAL(15,8),
    stop_loss DECIMAL(15,8),
    take_profit DECIMAL(15,8),
    risk_to_reward DECIMAL(8,4),
    partials_taken BOOLEAN DEFAULT false,
    session TEXT,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT false,
    is_temporary BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    share_link TEXT,
    is_shared BOOLEAN DEFAULT false,
    shared_at TIMESTAMPTZ,
    share_id TEXT UNIQUE,
    images JSONB
);
```

### TypeScript Interface
```typescript
export interface Trade {
  id: string
  calendar_id: string
  user_id: string
  firestore_id?: string
  name?: string
  amount: number
  trade_type: 'win' | 'loss' | 'breakeven'
  trade_date: Date
  entry_price?: number
  exit_price?: number
  stop_loss?: number
  take_profit?: number
  risk_to_reward?: number
  partials_taken?: boolean
  session?: string
  notes?: string
  tags?: string[]
  is_deleted?: boolean
  is_temporary?: boolean
  is_pinned?: boolean
  images?: TradeImageEntity[]
  economic_events?: TradeEconomicEvent[] // Runtime property, not in DB
  share_link?: string
  is_shared?: boolean
  shared_at?: Date | null
  share_id?: string
  created_at: Date
  updated_at: Date
}
```

**Status:** ✅ **MATCHES** - All fields use snake_case and match the database schema.

**Note:** `economic_events` is a runtime property that is:
- Fetched on-demand from the `economic_events` table via the `trade_economic_events` junction table
- Stored in the `trade_embeddings` table for vector search purposes
- NOT stored in the `trades` table itself

---

## ✅ TradeEconomicEvent Interface

### TypeScript Interface
```typescript
export interface TradeEconomicEvent {
  name: string;
  flag_code?: string;
  impact: ImpactLevel;
  currency: Currency;
  time_utc: string;
}
```

### Stored in trade_embeddings.economic_events (JSONB)
```sql
economic_events JSONB DEFAULT '[]'
```

**Status:** ✅ **MATCHES** - All fields use snake_case.

---

## ✅ TradeImageEntity Interface

### TypeScript Interface
```typescript
export interface TradeImageEntity {
  id: string;
  url: string;
  calendar_id: string;
  filename?: string;
  original_filename?: string;
  storage_path?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  caption?: string;
  row?: number;
  column?: number;
  column_width?: number;
  pending?: boolean; // UI state only
}
```

### Stored in trades.images (JSONB)
```sql
images JSONB
```

**Status:** ✅ **MATCHES** - All fields use snake_case.

**Note:** Images are stored as JSONB array in the `trades.images` column, not in a separate table.

---

## Summary

All TypeScript interfaces now use **snake_case** naming convention and match the Supabase database schema exactly:

- ✅ `User` interface matches `users` table
- ✅ `Trade` interface matches `trades` table
- ✅ `TradeEconomicEvent` interface matches JSONB structure in `trade_embeddings`
- ✅ `TradeImageEntity` interface matches JSONB structure in `trades.images`

### Key Architectural Notes:

1. **Economic Events Storage:**
   - Main events stored in `economic_events` table
   - Trade-event relationships in `trade_economic_events` junction table
   - Denormalized copy in `trade_embeddings.economic_events` for vector search
   - Runtime property on `Trade` interface (fetched on-demand)

2. **Images Storage:**
   - Stored as JSONB array in `trades.images` column
   - Physical files in Supabase Storage bucket `trade-images`
   - No separate `trade_images` table (schema exists but not used)

3. **Naming Convention:**
   - Database: `snake_case` (PostgreSQL standard)
   - TypeScript: `snake_case` (matches database)
   - Firebase Compatibility Layer: `camelCase` (for legacy components)

