# Supabase Edge Functions Deployment Guide

Complete guide for deploying all migrated Firebase Cloud Functions to Supabase Edge Functions.

## Prerequisites

### Required Tools
- **Deno 2.1+**: [Install Deno](https://deno.land/manual/getting_started/installation)
- **Supabase CLI**: [Install Supabase CLI](https://supabase.com/docs/guides/cli)
- **Git**: For version control

### Verify Installation
```bash
deno --version
supabase --version
```

## Pre-Deployment Setup

### 1. Environment Variables
Create a `.env` file in the `supabase/functions/` directory:

```env
# Supabase Project Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application Configuration
APP_BASE_URL=https://tradejourno.com

# External API Keys (if needed)
MYFXBOOK_API_KEY=your-myfxbook-api-key-if-needed
```

### 2. Supabase Project Connection
```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

## Deployment Process

### Option 1: Deploy All Functions (Recommended)
```bash
cd supabase/functions
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Deploy Individual Functions
```bash
# Deploy specific function
./deploy.sh --function handle-trade-changes

# Or use Supabase CLI directly
supabase functions deploy handle-trade-changes --no-verify-jwt
```

### Option 3: Manual Deployment
```bash
# Deploy each function individually
supabase functions deploy handle-trade-changes --no-verify-jwt
supabase functions deploy cleanup-deleted-calendar --no-verify-jwt
supabase functions deploy update-tag --no-verify-jwt
supabase functions deploy process-economic-events --no-verify-jwt
supabase functions deploy refresh-economic-calendar --no-verify-jwt
supabase functions deploy cleanup-expired-calendars --no-verify-jwt
supabase functions deploy auto-refresh-economic-calendar --no-verify-jwt
supabase functions deploy get-shared-trade --no-verify-jwt
supabase functions deploy get-shared-calendar --no-verify-jwt
```

**Note**: Share link generation and deactivation are now handled by ShareRepository in the frontend service layer

## Post-Deployment Configuration

### 1. Set Environment Variables
```bash
# Set environment variables in Supabase
supabase secrets set --env-file .env
```

### 2. Set Up Database Triggers
Run the SQL script in your Supabase SQL Editor:
```bash
# Copy the content of setup-triggers.sql and run in Supabase dashboard
cat setup-triggers.sql
```

**Important**: Update the project URL in the trigger functions:
- Replace `gwubzauelilziaqnsfac.supabase.co` with your actual project URL

### 3. Configure Cron Jobs
Run the SQL script in your Supabase SQL Editor:
```bash
# Copy the content of setup-cron.sql and run in Supabase dashboard
cat setup-cron.sql
```

### 4. Set Service Role Key
In your Supabase SQL Editor, set the service role key:
```sql
ALTER DATABASE postgres SET app.service_role_key = 'your-actual-service-role-key';
```

## Function Overview

### Database Triggers
- **handle-trade-changes**: Processes trade modifications (replaces onTradeChangedV2)
- **cleanup-deleted-calendar**: Handles calendar deletion cleanup (replaces cleanupDeletedCalendarV2)

### HTTP Endpoints (Callable Functions)
- **update-tag**: Updates tags across calendar trades (replaces updateTagV2)
- **process-economic-events**: Processes economic calendar HTML data
- **refresh-economic-calendar**: Manually refreshes economic data

### Scheduled Functions
- **cleanup-expired-calendars**: Daily cleanup of expired calendars (2 AM UTC)
- **auto-refresh-economic-calendar**: Periodic economic data refresh (every 30 minutes)

### Sharing Functions
- **generate-trade-share-link**: Creates shareable trade links
- **get-shared-trade**: Retrieves shared trade data
- **deactivate-shared-trade**: Deactivates trade shares
- **generate-calendar-share-link**: Creates shareable calendar links
- **get-shared-calendar**: Retrieves shared calendar data
- **deactivate-shared-calendar**: Deactivates calendar shares

## Verification

### 1. Check Function Status
```bash
supabase functions list
```

### 2. Test Functions
```bash
# Test a simple function
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/get-shared-trade' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"shareId": "test-share-id"}'
```

### 3. Monitor Logs
```bash
# View function logs
supabase functions logs handle-trade-changes
```

### 4. Verify Database Triggers
Run verification queries from `setup-triggers.sql` in your SQL Editor.

### 5. Verify Cron Jobs
Run verification queries from `setup-cron.sql` in your SQL Editor.

## Troubleshooting

### Common Issues

#### 1. Function Deployment Fails
```bash
# Check function syntax
deno check function-name/index.ts

# Verify Supabase connection
supabase status
```

#### 2. Environment Variables Not Set
```bash
# List current secrets
supabase secrets list

# Set missing secrets
supabase secrets set KEY=value
```

#### 3. Database Triggers Not Firing
- Verify HTTP extension is enabled: `CREATE EXTENSION IF NOT EXISTS http;`
- Check trigger functions exist in database
- Verify service role key is set correctly
- Check function URLs are correct

#### 4. Cron Jobs Not Running
- Verify pg_cron extension is enabled
- Check cron job status with monitoring queries
- Verify service role key is set
- Check function URLs are correct

### Debug Commands
```bash
# Check function logs
supabase functions logs function-name --follow

# Test function locally (if supported)
supabase functions serve function-name --no-verify-jwt

# Check database logs
# (Available in Supabase dashboard under Logs)
```

## Migration from Firebase

### Client Code Updates
Update your client code to call the new Supabase Edge Functions:

```typescript
// Before (Firebase)
const updateTag = httpsCallable(functions, 'updateTagV2');

// After (Supabase)
const response = await fetch(`${supabaseUrl}/functions/v1/update-tag`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ calendarId, oldTag, newTag })
});
```

### Gradual Migration
1. Deploy Edge Functions alongside Firebase functions
2. Test Edge Functions thoroughly
3. Update client code to use Edge Functions
4. Monitor for issues
5. Disable Firebase functions once stable

## Monitoring and Maintenance

### Regular Checks
- Monitor function execution logs
- Check cron job success rates
- Verify database trigger performance
- Monitor error rates and response times

### Performance Optimization
- Review function cold start times
- Optimize database queries
- Consider function memory allocation
- Monitor concurrent execution limits

### Security
- Regularly rotate service keys
- Monitor function access logs
- Review and update CORS settings
- Audit environment variables

## Support

### Resources
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [PostgreSQL Triggers Documentation](https://www.postgresql.org/docs/current/triggers.html)

### Getting Help
- Check function logs for detailed error messages
- Review Supabase dashboard for system status
- Consult the migration mapping document for function equivalents
- Test functions individually to isolate issues
