# Supabase Advisor Fixes - Migration Guide

This document provides a comprehensive overview of the migrations created to fix issues identified by the Supabase performance and security advisors.

## Overview

**Date:** 2025-12-21
**Migrations:** 052-056
**Source:** Supabase advisor reports in `supabase_advisor/` directory

### Issues Addressed

1. **Performance Issues (23 instances)**
   - Auth RLS Initialization Plan - RLS policies re-evaluating `auth.uid()` for each row
   - Multiple Permissive Policies - 5 instances on invite_links table

2. **Security Issues (28 instances)**
   - Function Search Path Mutable - 26 functions without `SET search_path`
   - Extensions in Public Schema - 2 extensions (http, vector)
   - Auth Configuration - 2 issues (OTP expiry, leaked password protection)

---

## Migration Files

### 052_optimize_rls_policies_auth_calls.sql
**Purpose:** Optimize RLS policies by wrapping auth function calls in subqueries
**Priority:** HIGH - Performance impact at scale
**Issues Fixed:** 23 auth_rls_initplan warnings

**What it does:**
- Wraps all `auth.uid()` calls in RLS policies with `(SELECT auth.uid())`
- Prevents per-row re-evaluation of auth functions
- Improves query performance significantly when scanning multiple rows

**Tables affected:**
- users (3 policies)
- calendars (4 policies)
- trades (4 policies)
- notes (4 policies)
- ai_conversations (4 policies)
- invite_links (1 policy)
- tag_definitions (4 policies)
- storage_cleanup_queue (1 policy)
- economic_events (1 policy)

**Example change:**
```sql
-- BEFORE
CREATE POLICY "Users can view own calendars" ON calendars
    FOR SELECT USING (user_id = auth.uid()::text);

-- AFTER
CREATE POLICY "Users can view own calendars" ON calendars
    FOR SELECT USING (user_id = (SELECT auth.uid()::text));
```

**Testing:**
```sql
-- Verify policies are working
SELECT * FROM calendars WHERE user_id = auth.uid()::text;

-- Check query plan to ensure optimization
EXPLAIN ANALYZE SELECT * FROM calendars WHERE user_id = auth.uid()::text;
```

---

### 053_add_search_path_to_functions.sql
**Purpose:** Add `SET search_path = ''` to utility and helper functions
**Priority:** HIGH - Security vulnerability
**Issues Fixed:** 26 function_search_path_mutable warnings (partial)

**What it does:**
- Adds `SET search_path = ''` to all utility functions
- Prevents search_path injection attacks
- Forces functions to use fully qualified object names

**Functions updated:**
- update_updated_at_column
- update_notes_updated_at
- update_ai_conversations_updated_at
- get_trade_image_path
- validate_user_storage_path
- extract_storage_path_from_url
- extract_image_urls_from_draftjs
- queue_images_for_deletion
- handle_note_delete_storage_cleanup
- handle_note_update_storage_cleanup
- cleanup_expired_invites
- set_note_archived_at
- mark_calendar_for_deletion
- handle_calendar_deletion
- notify_trade_changes
- notify_calendar_deletions
- handle_trade_changes
- trigger_calculate_calendar_stats
- update_economic_events_text
- search_similar_trades
- execute_sql

**Example change:**
```sql
-- BEFORE
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ ... $$;

-- AFTER
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$ ... $$;
```

**Testing:**
```sql
-- Verify function can still be called
SELECT public.cleanup_expired_invites();

-- Check function security settings
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname IN ('cleanup_expired_invites', 'update_updated_at_column');
```

---

### 054_add_search_path_to_trade_stats_functions.sql
**Purpose:** Add `SET search_path = ''` to complex trade and statistics functions
**Priority:** HIGH - Security vulnerability
**Issues Fixed:** Remaining function_search_path_mutable warnings

**What it does:**
- Uses `ALTER FUNCTION` to add search_path to existing complex functions
- Recreates trigger functions with proper security settings
- Handles both single-calendar and multi-calendar statistics functions

**Functions updated:**
- add_trade_with_tags
- update_trade_with_tags
- delete_trade_transactional
- get_calendar_stats
- trigger_calculate_calendar_stats
- calculate_performance_metrics
- calculate_chart_data
- calculate_tag_performance
- calculate_economic_event_correlations
- (and their _multi variants)
- trigger_broadcast_trade_changes
- trigger_broadcast_note_changes
- trigger_broadcast_economic_event_changes

**Example change:**
```sql
-- Add search_path to existing function
ALTER FUNCTION public.add_trade_with_tags(JSONB, UUID) SET search_path = '';

-- Or recreate trigger function
CREATE OR REPLACE FUNCTION public.trigger_calculate_calendar_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$ ... $$;
```

**Testing:**
```sql
-- Test trade operations still work
SELECT public.add_trade_with_tags(
    '{"name": "Test Trade", "trade_type": "BUY", ...}'::jsonb,
    'your-calendar-id'::uuid
);

-- Verify triggers fire correctly
INSERT INTO trades (...) VALUES (...);
-- Check that calendar stats are recalculated
```

---

### 055_combine_invite_links_permissive_policies.sql
**Purpose:** Combine duplicate permissive RLS policies on invite_links
**Priority:** MEDIUM - Performance optimization
**Issues Fixed:** 5 multiple_permissive_policies warnings

**What it does:**
- Combines two SELECT policies into one using OR conditions
- Reduces policy evaluation overhead
- Maintains identical security behavior

**Policies before:**
1. "Anyone can read active invite links" - Public access to active invites
2. "Creators can manage their invite links" - Creator access to all their invites

**Policies after:**
1. "Read invite links" - Combined SELECT policy with OR condition
2. "Insert invite links" - Creator only
3. "Update invite links" - Creator only
4. "Delete invite links" - Creator only

**Example change:**
```sql
-- BEFORE: Two permissive SELECT policies (both evaluated)
CREATE POLICY "Anyone can read active invite links" ON invite_links
    FOR SELECT USING (is_active = true AND ...);

CREATE POLICY "Creators can manage their invite links" ON invite_links
    FOR ALL USING (created_by = auth.uid());

-- AFTER: One combined SELECT policy
CREATE POLICY "Read invite links" ON invite_links
    FOR SELECT
    USING (
        (is_active = true AND ...) -- Anyone can read active
        OR
        (created_by = auth.uid())  -- Creators can read their own
    );
```

**Testing:**
```sql
-- Test as anonymous user
SET ROLE anon;
SELECT * FROM invite_links WHERE is_active = true;

-- Test as authenticated creator
SET ROLE authenticated;
SELECT * FROM invite_links WHERE created_by = auth.uid();

-- Test INSERT/UPDATE/DELETE as creator
INSERT INTO invite_links (code, created_by) VALUES ('test', auth.uid());
```

---

### 056_move_extensions_to_extensions_schema.sql
**Purpose:** Move http and vector extensions from public to extensions schema
**Priority:** MEDIUM - Security and namespace organization
**Issues Fixed:** 2 extension_in_public warnings

**What it does:**
- Creates dedicated `extensions` schema
- Moves http extension to extensions schema
- Moves vector (pgvector) extension to extensions schema
- Updates search_path to include extensions schema
- Handles dependencies and permissions

**Extensions moved:**
- `http` - HTTP client for making external requests
- `vector` - pgvector for vector similarity search (AI features)

**Important notes:**
- **May fail if vector extension has dependencies** (e.g., tables with vector columns)
- In that case, manual migration of vector columns is required
- See migration file comments for detailed manual intervention steps

**Example change:**
```sql
-- BEFORE: Extensions in public schema
CREATE EXTENSION http;  -- Creates in public by default

-- AFTER: Extensions in dedicated schema
CREATE EXTENSION http SCHEMA extensions;

-- Update search path to include extensions
ALTER DATABASE postgres SET search_path TO public, extensions;
```

**Testing:**
```sql
-- Verify extension locations
SELECT e.extname, n.nspname
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('http', 'vector');

-- Test http extension still works
SELECT extensions.http_post(...);

-- Test vector extension still works (if applicable)
SELECT embedding::extensions.vector FROM ...;
```

**Rollback considerations:**
If this migration causes issues, you can rollback by:
1. Dropping extensions from extensions schema
2. Recreating them in public schema
3. Updating search_path back to just 'public'

---

### AUTH_CONFIG_CHANGES.md
**Purpose:** Document auth configuration changes needed via dashboard
**Priority:** LOW - Can be done via dashboard
**Issues:** 2 auth configuration warnings

**Issues documented:**
1. **OTP Expiry > 1 hour**
   - Current: > 3600 seconds
   - Recommended: ≤ 3600 seconds (1 hour) or 1800 seconds (30 min)
   - How to fix: Dashboard > Authentication > Settings > Email Provider

2. **Leaked Password Protection Disabled**
   - Current: Disabled
   - Recommended: Enabled
   - How to fix: Dashboard > Authentication > Settings > Password Settings

**These cannot be fixed via SQL migration** - must be done through Supabase Dashboard.

See `AUTH_CONFIG_CHANGES.md` for detailed step-by-step instructions.

---

## Migration Execution Order

Execute the migrations in this exact order:

```bash
# 1. RLS policy optimization (safe, no breaking changes)
psql -f supabase/migrations/052_optimize_rls_policies_auth_calls.sql

# 2. Function security - utility functions (safe)
psql -f supabase/migrations/053_add_search_path_to_functions.sql

# 3. Function security - complex functions (safe)
psql -f supabase/migrations/054_add_search_path_to_trade_stats_functions.sql

# 4. Combine invite_links policies (safe)
psql -f supabase/migrations/055_combine_invite_links_permissive_policies.sql

# 5. Move extensions (CAUTION: may fail if dependencies exist)
psql -f supabase/migrations/056_move_extensions_to_extensions_schema.sql

# 6. Auth configuration (manual, via dashboard)
# Follow instructions in AUTH_CONFIG_CHANGES.md
```

### Using Supabase CLI

```bash
# Link to your project (if not already linked)
npx supabase link --project-ref your-project-ref

# Apply all pending migrations
npx supabase db push

# Or apply specific migration
npx supabase db push --include-all --file supabase/migrations/052_optimize_rls_policies_auth_calls.sql
```

---

## Pre-Migration Checklist

Before running these migrations, ensure:

- [ ] You have a **recent database backup**
- [ ] You've reviewed each migration file
- [ ] You've tested in a **development/staging environment** first
- [ ] You have the necessary **database permissions**
- [ ] You've notified your team about the maintenance window
- [ ] You've checked for any **custom code dependencies** on:
  - RLS policy names
  - Function signatures
  - Extension usage
  - Auth configuration

---

## Post-Migration Verification

After running all migrations:

### 1. Re-run Supabase Advisor

```bash
# Using Supabase CLI
npx supabase inspect db --linked --checks performance
npx supabase inspect db --linked --checks security

# Or check via Dashboard
# Go to Database > Advisor
```

**Expected results:**
- ✅ auth_rls_initplan warnings: RESOLVED (0)
- ✅ multiple_permissive_policies warnings: RESOLVED (0)
- ✅ function_search_path_mutable warnings: RESOLVED (0)
- ✅ extension_in_public warnings: RESOLVED (0)
- ⚠️ auth_otp_long_expiry: Pending (manual fix via dashboard)
- ⚠️ auth_leaked_password_protection: Pending (manual fix via dashboard)

### 2. Run Application Tests

```bash
# Run your application test suite
npm test

# Test specific features affected by migrations:
# - User authentication and authorization
# - Calendar and trade operations
# - Notes with image uploads
# - AI conversation features
# - Invite link functionality
```

### 3. Verify RLS Policies

```sql
-- Test that users can only access their own data
SET ROLE authenticated;
SET request.jwt.claims.sub = 'test-user-id';

-- Should return only user's calendars
SELECT * FROM calendars;

-- Should return only user's trades
SELECT * FROM trades;
```

### 4. Verify Functions Work

```sql
-- Test utility functions
SELECT public.cleanup_expired_invites();

-- Test trade functions
SELECT public.add_trade_with_tags(...);

-- Test stats functions
SELECT public.get_calendar_stats('calendar-id'::uuid, NULL);
```

### 5. Check Query Performance

```sql
-- Compare query plans before and after
EXPLAIN ANALYZE
SELECT * FROM calendars WHERE user_id = auth.uid()::text;

-- Should show that auth.uid() is evaluated once, not per row
```

---

## Rollback Procedures

If you need to rollback these migrations:

### Rollback 052 (RLS Policies)
```sql
-- Restore old RLS policies without subquery wrappers
-- See original migration files (002, 018, 036, 040, 20250128000000)
```

### Rollback 053 & 054 (Function search_path)
```sql
-- Remove search_path from functions
ALTER FUNCTION public.cleanup_expired_invites() RESET search_path;
-- Repeat for all affected functions
```

### Rollback 055 (Invite Links Policies)
```sql
-- Restore original two policies
-- See migration 036_create_invite_links_table.sql
```

### Rollback 056 (Extensions)
```sql
-- Move extensions back to public
DROP EXTENSION http CASCADE;
CREATE EXTENSION http SCHEMA public;

DROP EXTENSION vector CASCADE;
CREATE EXTENSION vector SCHEMA public;

-- Reset search path
ALTER DATABASE postgres SET search_path TO public;
```

---

## Known Issues & Limitations

### 1. Extension Move (056) May Fail
**Issue:** If tables have vector columns, the vector extension cannot be dropped
**Solution:** Manual migration of vector columns required (see migration comments)

### 2. Function Signatures
**Issue:** Some complex functions may have multiple overloaded versions
**Solution:** The ALTER FUNCTION commands target specific signatures

### 3. Auth Configuration
**Issue:** Cannot be set via SQL migrations
**Solution:** Must be configured manually via Supabase Dashboard

### 4. Realtime Subscriptions
**Issue:** RLS policy changes may briefly interrupt realtime subscriptions
**Solution:** Clients should implement reconnection logic

---

## Performance Improvements Expected

After applying these migrations, you should see:

1. **RLS Policy Performance:**
   - Reduced query planning time for tables with RLS policies
   - More efficient row filtering on large tables
   - Noticeable improvement when querying 1000+ rows

2. **Function Security:**
   - No performance impact
   - Improved security posture
   - Protection against search_path injection

3. **Invite Links Performance:**
   - Reduced policy evaluation overhead
   - Faster SELECT queries on invite_links table
   - Marginal improvement (table typically small)

---

## Security Improvements Expected

After applying these migrations, you get:

1. **Function Security:**
   - Protection against search_path injection attacks
   - Prevents malicious schema manipulation
   - Functions can only access intended objects

2. **Extension Security:**
   - Extensions isolated in dedicated schema
   - Cleaner namespace separation
   - Easier to manage permissions

3. **Auth Security:**
   - Shorter OTP expiry reduces attack window
   - Leaked password protection prevents compromised passwords
   - Compliance with security best practices

---

## Support & Troubleshooting

### Common Issues

**Issue:** Migration fails with "policy already exists"
**Solution:** The migration includes `DROP POLICY IF EXISTS`, but if custom policies exist, drop them first

**Issue:** Functions can't find tables after search_path change
**Solution:** Functions should use schema-qualified names (e.g., `public.calendars`)

**Issue:** Extension move fails with dependency error
**Solution:** See migration 056 comments for manual migration steps

**Issue:** Tests fail after migration
**Solution:** Check test database has migrations applied, check RLS policies are correct

### Getting Help

- Check Supabase documentation: https://supabase.com/docs
- Review migration file comments
- Check advisor remediation links
- Open issue in project repository

---

## Related Documentation

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Function Security](https://supabase.com/docs/guides/database/functions)
- [Going to Production](https://supabase.com/docs/guides/platform/going-into-prod)

---

**Migration Package Created:** 2025-12-21
**Last Updated:** 2025-12-21
**Migrations:** 052, 053, 054, 055, 056
**Documentation:** AUTH_CONFIG_CHANGES.md, ADVISOR_FIXES_README.md
