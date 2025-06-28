# Economic Calendar Firebase Functions Deployment Guide

## Overview
This guide explains how to deploy and test the Economic Calendar Firebase Functions that fetch real ForexFactory data.

## Prerequisites

1. **Firebase CLI installed**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase project configured**
   - Ensure your Firebase project is set up
   - Check that `firebase.json` is properly configured

3. **Environment variables set**
   - Ensure all Firebase config variables are set in `.env`

## Deployment Steps

### 1. Build Functions
```bash
cd functions
npm run build
```

### 2. Deploy Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:fetchEconomicCalendarV2
```

### 3. Test with Emulator (Development)
```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, set emulator flag and start app
export REACT_APP_USE_EMULATOR=true
npm start
```

## Available Functions

### `fetchEconomicCalendarV2`
- **Purpose**: Fetches economic calendar data from ForexFactory
- **Input**: `{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }`
- **Output**: `{ eco_elements: EconomicEvent[] }`
- **Caching**: 30-minute cache in Firestore

### `getCachedEconomicCalendarV2`
- **Purpose**: Returns cached economic calendar data
- **Input**: `{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }`
- **Output**: Cached data with freshness indicator

### `autoRefreshEconomicCalendarV2`
- **Purpose**: Scheduled function that refreshes data every 30 minutes
- **Schedule**: Runs automatically every 30 minutes
- **Scope**: Refreshes data for today + next 7 days

## Testing the Integration

### 1. Frontend Testing
1. Open the Economic Calendar in your app
2. Click the refresh button in the drawer
3. Check browser console for logs:
   - `🔄 Fetching economic calendar data for:`
   - `📡 Calling Firebase Function: fetchEconomicCalendarV2`
   - `✅ Successfully received data` or `❌ Error fetching`

### 2. Function Testing
```bash
# Test function directly
firebase functions:shell

# In the shell:
fetchEconomicCalendarV2({start: "2024-01-01", end: "2024-01-07"})
```

### 3. Emulator Testing
1. Start emulators: `firebase emulators:start`
2. Open Emulator UI: `http://localhost:4000`
3. Test functions in the Functions tab

## Current Status

### ✅ Completed
- [x] Firebase Functions created and configured
- [x] TypeScript interfaces defined
- [x] Service layer with caching
- [x] Frontend integration with fallback to mock data
- [x] Error handling and logging
- [x] Emulator configuration

### 🔄 In Progress
- [ ] Functions deployed to production
- [ ] Real ForexFactory data integration tested
- [ ] Production environment variables configured

### 📋 Next Steps
1. **Deploy Functions**: Run `firebase deploy --only functions`
2. **Configure Environment**: Set up production Firebase config
3. **Test Real Data**: Verify ForexFactory scraping works
4. **Monitor Performance**: Check function execution times and costs
5. **Enable Scheduling**: Verify auto-refresh function runs correctly

## Troubleshooting

### Common Issues

1. **Function timeout**
   - ForexFactory may be slow to respond
   - Increase timeout in function configuration

2. **CORS errors**
   - ForexFactory may block requests
   - Consider using a proxy or different scraping approach

3. **Rate limiting**
   - ForexFactory may limit requests
   - Implement proper caching and request throttling

4. **Cheerio parsing errors**
   - ForexFactory HTML structure may change
   - Update selectors in `economicCalendar.ts`

### Debug Commands
```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only fetchEconomicCalendarV2

# Test function locally
firebase functions:shell
```

## Production Considerations

1. **Costs**: Monitor Firebase Functions usage and costs
2. **Performance**: Optimize scraping and caching strategies
3. **Reliability**: Implement proper error handling and retries
4. **Compliance**: Ensure ForexFactory scraping complies with their terms
5. **Monitoring**: Set up alerts for function failures

## Security Notes

- Functions run server-side, protecting scraping logic
- No API keys exposed to frontend
- Firestore rules should restrict cache access appropriately
- Consider implementing request authentication for production

## Support

For issues with deployment or integration:
1. Check Firebase console for function logs
2. Verify environment variables are set correctly
3. Test with emulators first before deploying to production
4. Monitor function performance and costs in Firebase console
