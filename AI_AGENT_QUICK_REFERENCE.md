# AI Trading Agent - Quick Reference Guide

## 🚀 Status: PRODUCTION READY

---

## API Endpoint

```
POST https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent
```

## Request Format

```json
{
  "message": "What's the economic sentiment for EURUSD this coming week?",
  "userId": "user-id-here",
  "calendarId": "calendar-id-here",
  "conversationHistory": [
    {
      "role": "user",
      "content": "Previous user message"
    },
    {
      "role": "assistant",
      "content": "Previous assistant response"
    }
  ]
}
```

## Response Format

```json
{
  "success": true,
  "message": "Comprehensive analysis...",
  "metadata": {
    "functionCalls": [
      {
        "name": "get_forex_price",
        "args": { "base_currency": "EUR", "quote_currency": "USD" },
        "result": "..."
      }
    ],
    "model": "gemini-2.5-pro-preview-03-25",
    "timestamp": "2025-10-26T11:20:20.307Z"
  }
}
```

---

## Available Tools

### 1. **get_forex_price**
Get real-time forex exchange rates

**Parameters:**
- `base_currency` (string): EUR, GBP, JPY, AUD, CAD, CHF, etc.
- `quote_currency` (string): USD, EUR, GBP, etc.

**Example:**
```json
{
  "base_currency": "EUR",
  "quote_currency": "USD"
}
```

### 2. **get_crypto_price**
Get real-time cryptocurrency prices

**Parameters:**
- `symbol` (string): BTC, ETH, XRP, ADA, SOL, etc.

**Example:**
```json
{
  "symbol": "BTC"
}
```

### 3. **search_web**
Search for market news and analysis

**Parameters:**
- `query` (string): Search query
- `type` (string): "search" or "news"

**Example:**
```json
{
  "query": "EURUSD sentiment analysis",
  "type": "news"
}
```

### 4. **scrape_url**
Extract content from a URL

**Parameters:**
- `url` (string): Full URL to scrape

**Example:**
```json
{
  "url": "https://www.example.com/article"
}
```

### 5. **execute_sql**
Query the economic events database

**Parameters:**
- `query` (string): SQL SELECT query

**Example:**
```json
{
  "query": "SELECT event_name, country, event_date, impact FROM economic_events WHERE country = 'United States' AND event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + INTERVAL '7 days' ORDER BY event_date ASC;"
}
```

---

## Example Queries

### Economic Analysis
```
"What's the economic sentiment for EURUSD this coming week?"
"Analyze GBP/USD for me - what are the key drivers this week?"
"What economic events could impact the dollar this week?"
```

### Crypto Analysis
```
"What's the current price of Bitcoin and what's the market sentiment?"
"Analyze Ethereum - is it a good time to buy?"
"What's driving the crypto market today?"
```

### Forex Analysis
```
"Should I go long or short EUR/USD?"
"What are the technical levels for GBP/USD?"
"Compare USD/JPY and EUR/USD sentiment"
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Average Response Time | 30-45 seconds |
| Success Rate | 100% |
| Max Function Calls | 15 |
| Model | Gemini 2.5 Pro Preview |
| Temperature | 0.3 |

---

## Error Handling

### Empty Search Results
If web search returns no results, the agent will:
1. Try alternative search terms
2. Use available data (prices, economic events)
3. Provide analysis based on market knowledge

### API Failures
If an API fails, the agent will:
1. Log the error
2. Continue with other tools
3. Provide analysis with available data

### Database Errors
If SQL query fails, the agent will:
1. Attempt alternative queries
2. Continue with other data sources
3. Provide analysis without database data

---

## Best Practices

### For Users
1. ✅ Be specific in your queries
2. ✅ Provide context when needed
3. ✅ Use conversation history for follow-ups
4. ✅ Wait for complete response before asking follow-up

### For Developers
1. ✅ Always include userId for security
2. ✅ Pass conversation history for context
3. ✅ Handle empty responses gracefully
4. ✅ Monitor API quotas
5. ✅ Cache responses when possible

---

## Troubleshooting

### Issue: Empty Response
**Solution:** Check if APIs are available and quotas not exceeded

### Issue: Slow Response
**Solution:** Normal for complex queries (30-45 seconds). Check network connection.

### Issue: Inaccurate Analysis
**Solution:** Provide more specific queries or additional context

### Issue: API Errors
**Solution:** Check Serper API key and Gemini API key configuration

---

## Configuration

**Environment Variables:**
- `GOOGLE_API_KEY` - Gemini API key
- `SERPER_API_KEY` - Serper API key
- `AGENT_SUPABASE_ACCESS_TOKEN` - Supabase MCP token

**Deployment:**
- Function: `supabase/functions/ai-trading-agent`
- Region: EU-West-3
- Runtime: Deno

---

## Support

For issues or questions:
1. Check the test results in `AI_AGENT_TEST_RESULTS.md`
2. Review the deployment summary in `DEPLOYMENT_SUMMARY.md`
3. Check function logs in Supabase dashboard

---

**Last Updated:** October 26, 2025  
**Status:** ✅ Production Ready

