# OpenAI Agent Deployment Guide

Complete guide for deploying the AI Trading Agent to Supabase.

## Prerequisites

1. **OpenAI API Key**
   - Sign up at [https://platform.openai.com](https://platform.openai.com)
   - Generate API key at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Estimated cost: ~$0.02-0.04 per conversation

2. **Serper API Key** (Optional - for web search)
   - Sign up at [https://serper.dev](https://serper.dev)
   - 2,500 free searches to start
   - $0.30-$1.00 per 1,000 searches after

3. **Supabase CLI**
   ```bash
   npm install -g supabase
   ```

---

## Step 1: Configure Environment Variables

### Local Development

Update `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Serper API Configuration (Optional)
SERPER_API_KEY=your_serper_key
```

### Supabase Secrets

Set secrets for edge function:

```bash
# Set OpenAI API key (Required)
npx supabase secrets set OPENAI_API_KEY=sk-proj-...

# Set Serper API key (Optional - for web search)
npx supabase secrets set SERPER_API_KEY=your_serper_key

# Verify secrets
npx supabase secrets list
```

---

## Step 2: Deploy Edge Function

### Deploy to Supabase

```bash
# Deploy the AI agent function
npx supabase functions deploy ai-trading-agent

# Verify deployment
npx supabase functions list
```

### View Deployment Status

```bash
# Check function logs
npx supabase functions logs ai-trading-agent

# Tail logs in real-time
npx supabase functions logs ai-trading-agent --tail
```

---

## Step 3: Test the Deployment

### Test via Curl

```bash
# Get your Supabase project details
SUPABASE_URL=https://your-project.supabase.co
ANON_KEY=your_anon_key
USER_ID=your_user_id

# Test the agent
curl -X POST "$SUPABASE_URL/functions/v1/ai-trading-agent" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"What is my win rate?\",
    \"userId\": \"$USER_ID\"
  }"
```

### Expected Response

```json
{
  "success": true,
  "message": "Based on your trading data, your win rate is 65%...",
  "trades": [],
  "calendars": [],
  "economicEvents": [],
  "metadata": {
    "functionCalls": [
      {
        "name": "get_trade_statistics",
        "args": { "calendarId": "..." },
        "result": { "success": true, "data": {...} }
      }
    ],
    "tokenUsage": 1234,
    "model": "gpt-4o-mini",
    "timestamp": "2025-01-01T00:00:00Z"
  }
}
```

---

## Step 4: Test from Frontend

1. **Start the development server**:
   ```bash
   npm start
   ```

2. **Open AI Chat**:
   - Navigate to your calendar
   - Click the AI chat icon
   - Ask a question like "Show me my top 5 winning trades"

3. **Verify**:
   - Check that responses appear correctly
   - Verify trade cards are displayed
   - Check browser console for errors

---

## Step 5: Monitor and Optimize

### View Logs

```bash
# Real-time logs
npx supabase functions logs ai-trading-agent --tail

# Filter errors only
npx supabase functions logs ai-trading-agent --tail | grep ERROR
```

### Monitor Costs

1. **OpenAI Usage**:
   - Dashboard: [https://platform.openai.com/usage](https://platform.openai.com/usage)
   - Typical: ~$0.02-0.04 per conversation

2. **Serper Usage**:
   - Dashboard: [https://serper.dev/dashboard](https://serper.dev/dashboard)
   - Typical: ~$0.001 per search

3. **Supabase Edge Functions**:
   - Dashboard: Project → Edge Functions → Usage
   - Free tier: 500K invocations/month
   - $2 per 1M invocations after

### Performance Metrics

Expected performance:
- **Cold start**: 500ms-1s
- **Warm invocations**: 200-500ms
- **Complex queries**: 1-3s (multiple tool calls)

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not configured"

**Solution**:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-proj-...
npx supabase functions deploy ai-trading-agent  # Redeploy
```

### Issue: "Unauthorized" errors

**Solution**:
- Verify Authorization header includes valid Supabase token
- Check user authentication in browser console
- Ensure user ID matches authenticated user

### Issue: Slow responses

**Solutions**:
1. Check number of tool calls in logs
2. Verify database has proper indexes
3. Consider caching frequently accessed data
4. Reduce maxTurns if needed (default: 15)

### Issue: Tool execution errors

**Check logs**:
```bash
npx supabase functions logs ai-trading-agent --tail
```

**Common causes**:
- Missing database permissions
- Invalid calendar/trade IDs
- Database connection issues

### Issue: High costs

**Solutions**:
1. Switch to GPT-4o-mini (already default)
2. Reduce max tokens (default: 4000)
3. Limit conversation history length
4. Add request rate limiting

---

## Database Permissions

The edge function requires read access to:

- `trades` table
- `calendars` table
- `economic_events` table

RLS (Row Level Security) is enforced - users can only query their own data.

---

## Local Development

### Run Locally

```bash
# Start Supabase locally
npx supabase start

# Serve function locally
npx supabase functions serve ai-trading-agent --env-file .env

# Test locally
curl -X POST http://localhost:54321/functions/v1/ai-trading-agent \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "userId": "user-id"}'
```

### Type Checking

```bash
# Check for TypeScript errors
deno check supabase/functions/ai-trading-agent/index.ts
```

---

## Updating the Agent

### Deploy Updates

```bash
# After making changes to agent files
npx supabase functions deploy ai-trading-agent

# Verify deployment
npx supabase functions logs ai-trading-agent --tail
```

### Rollback if Needed

```bash
# List function versions
npx supabase functions list

# If issues occur, redeploy previous working version
git checkout <previous-commit>
npx supabase functions deploy ai-trading-agent
```

---

## Security Best Practices

1. **Never commit API keys** - Use secrets management
2. **Validate user input** - Already implemented
3. **Enforce RLS** - Already configured
4. **Monitor costs** - Set up billing alerts
5. **Rate limiting** - Consider implementing if needed

---

## Cost Optimization

### Tips to Reduce Costs

1. **Use GPT-4o-mini** (already default)
   - 60% cheaper than GPT-4o
   - Still excellent for structured tasks

2. **Cache responses** (future enhancement)
   - Cache common queries
   - Reduce redundant calculations

3. **Limit context length**
   - Currently: 50 messages max
   - Reduce if cost is concern

4. **Monitor usage**
   - Weekly cost reviews
   - Set up billing alerts

---

## Success Metrics

Track these metrics:

1. **Response time**: Target < 2s
2. **Success rate**: Target > 95%
3. **User satisfaction**: Monitor feedback
4. **Cost per conversation**: Target < $0.05
5. **Error rate**: Target < 5%

---

## Support

### Resources

- **Edge Function README**: `supabase/functions/ai-trading-agent/README.md`
- **OpenAI Agents Docs**: [https://github.com/openai/openai-agents-js](https://github.com/openai/openai-agents-js)
- **Supabase Docs**: [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)

### Getting Help

1. Check edge function logs first
2. Review browser console errors
3. Test with curl to isolate frontend issues
4. Check Supabase dashboard for function status

---

## Next Steps

After successful deployment:

1. ✅ Monitor first few conversations
2. ✅ Collect user feedback
3. ✅ Fine-tune system prompts if needed
4. ✅ Add more tools as requirements grow
5. ✅ Implement caching for common queries
6. ✅ Set up monitoring alerts

---

## Congratulations!

Your AI Trading Agent is now deployed and ready to help users analyze their trading performance! 🎉

The agent will:
- ✅ Query trades with advanced filters
- ✅ Calculate comprehensive statistics
- ✅ Find similar trade patterns
- ✅ Correlate economic events with trades
- ✅ Search the web for market research
- ✅ Provide actionable insights

Happy trading analysis! 📊🚀
