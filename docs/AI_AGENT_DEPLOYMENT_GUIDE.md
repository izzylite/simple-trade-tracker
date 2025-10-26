# AI Agent Deployment Guide - Step by Step

**Date**: 2025-10-25
**Function**: `ai-trading-agent`
**Status**: Ready to deploy ✅

## Important: Access Token vs Service Role Key

⚠️ **CRITICAL**: The AI Agent requires a **Personal Access Token (PAT)**, NOT the service role key!

| Token Type | Variable Name | Starts With | Use Case | RLS Enforced |
|------------|--------------|-------------|----------|--------------|
| **Personal Access Token** | `SUPABASE_ACCESS_TOKEN` | `sbp_...` | ✅ MCP Authentication | ✅ Yes |
| **Service Role Key** | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | ❌ NOT for MCP | ❌ No (bypasses RLS) |

**Why this matters**: Using the service role key would bypass Row-Level Security, defeating our security layers!

---

## Step 1: Create Supabase Personal Access Token

### 1.1 Navigate to Token Creation

Go to: [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)

Or:
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your profile icon (top right)
3. Select **Account Settings**
4. Navigate to **Access Tokens** tab

### 1.2 Generate New Token

1. Click **"Generate New Token"** button
2. Fill in details:
   - **Name**: `AI Agent MCP Access`
   - **Description**: `Personal access token for AI Trading Agent MCP connection`
   - **Scopes**: Select at minimum:
     - ✅ `all` (recommended for full project access)
     - Or specific: `projects.read`, `organizations.read`

3. Click **"Generate token"**

### 1.3 Copy the Token

⚠️ **Important**: Copy the token immediately - you won't be able to see it again!

The token should look like: `sbp_abcdef123456789...`

---

## Step 2: Set Environment Variables

### 2.1 Set OpenAI API Key

If you don't have one, get it from [OpenAI Platform](https://platform.openai.com/api-keys)

```bash
npx supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE
```

### 2.2 Set Supabase Access Token

```bash
npx supabase secrets set SUPABASE_ACCESS_TOKEN=sbp_YOUR_PERSONAL_ACCESS_TOKEN_HERE
```

⚠️ **Do NOT use**:
```bash
# WRONG - This bypasses RLS!
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

### 2.3 Set Serper API Key (Optional)

Only if you want web search capability. Get key from [Serper.dev](https://serper.dev/)

```bash
npx supabase secrets set SERPER_API_KEY=YOUR_SERPER_KEY_HERE
```

### 2.4 Verify Secrets

```bash
npx supabase secrets list
```

You should see:
```
OPENAI_API_KEY
SUPABASE_ACCESS_TOKEN
SERPER_API_KEY (optional)
```

---

## Step 3: Deploy the Edge Function

```bash
npx supabase functions deploy ai-trading-agent
```

Expected output:
```
Deploying ai-trading-agent (project ref: gwubzauelilziaqnsfac)
Bundling ai-trading-agent
Deploying ai-trading-agent (100%)
Deployed Function ID: xxx
Version: xxx
Function URL: https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent
```

---

## Step 4: Test the Deployment

### 4.1 Get Your User Token

1. Open your app in browser
2. Open browser DevTools (F12)
3. Go to Application → Local Storage → supabase.auth.token
4. Copy the JWT token (starts with `eyJ...`)

### 4.2 Test with cURL

Replace placeholders with your actual values:

```bash
curl -X POST "https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my win rate?",
    "userId": "YOUR_USER_ID_HERE",
    "calendarId": "YOUR_CALENDAR_ID_HERE"
  }'
```

### 4.3 Expected Response

✅ **Success**:
```json
{
  "success": true,
  "message": "Based on your trading data, your win rate is 65.5%...",
  "metadata": {
    "functionCalls": [...],
    "model": "gpt-4o",
    "timestamp": "2025-10-25T..."
  }
}
```

❌ **Error - Missing Access Token**:
```json
{
  "success": false,
  "error": "SUPABASE_ACCESS_TOKEN not configured. Create a Personal Access Token at https://supabase.com/dashboard/account/tokens"
}
```

❌ **Error - Unauthorized**:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```
**Fix**: Check your user JWT token is valid and not expired.

❌ **Error - User ID Mismatch**:
```json
{
  "success": false,
  "error": "User ID mismatch"
}
```
**Fix**: Ensure `userId` in request matches the user from JWT token.

---

## Step 5: Monitor Function Logs

### 5.1 Watch Real-time Logs

```bash
npx supabase functions logs ai-trading-agent --tail
```

### 5.2 Look for Success Indicators

✅ Good logs:
```
Processing AI request for user abc123...
Connecting to Supabase MCP server (read-only mode) for project gwubzauelilziaqnsfac
Successfully connected to Supabase MCP server (read-only)
Running agent with model gpt-4o
Agent completed with 2 tool calls
Response validated - user data isolation confirmed
```

❌ Error logs to watch for:
```
Error in AI agent: SUPABASE_ACCESS_TOKEN not configured
Security violation detected: Found trades belonging to other users
Error connecting to MCP server
```

### 5.3 Filter Logs

```bash
# Only errors
npx supabase functions logs ai-trading-agent --tail | grep ERROR

# Security violations
npx supabase functions logs ai-trading-agent --tail | grep "Security violation"

# Authentication issues
npx supabase functions logs ai-trading-agent --tail | grep "Unauthorized"
```

---

## Step 6: Test from Frontend

### 6.1 Verify Service Integration

The frontend should already be configured to use `openaiAgentService`:

```typescript
// src/services/ai/openaiAgentService.ts
import { supabase } from '../../config/supabase';

const response = await supabase.functions.invoke<AgentResponse>(
  'ai-trading-agent',
  {
    body: {
      message,
      userId,
      calendarId,
      conversationHistory,
    },
  }
);
```

### 6.2 Test in UI

1. Open your app
2. Navigate to AI Chat feature
3. Ask a question like: "What's my win rate?"
4. Verify response appears

---

## Troubleshooting

### Issue: "SUPABASE_ACCESS_TOKEN not configured"

**Cause**: Missing or incorrect environment variable

**Fix**:
1. Verify you created a Personal Access Token (not service role key)
2. Set it with: `npx supabase secrets set SUPABASE_ACCESS_TOKEN=sbp_...`
3. Re-deploy: `npx supabase functions deploy ai-trading-agent`

---

### Issue: "Could not connect to MCP server"

**Cause**: Invalid access token or network issue

**Fix**:
1. Verify token is valid (not expired)
2. Check token starts with `sbp_`
3. Regenerate token if needed
4. Update secret and re-deploy

---

### Issue: "Security violation detected"

**Cause**: Response validation found data from another user

**Fix**:
1. Check logs for details: `npx supabase functions logs ai-trading-agent`
2. This is a **good thing** - security is working!
3. Report issue if you believe it's a false positive

---

### Issue: Response is slow (>10 seconds)

**Cause**: Complex query or MCP connection delay

**Fix**:
1. MCP connection caches after first request (gets faster)
2. Use more specific questions
3. Consider adding query complexity limits

---

### Issue: "Read-only mode" error

**Cause**: Agent tried to perform write operation

**Fix**:
1. This is expected behavior (security feature)
2. Agent should only read data, never write
3. If user needs to modify data, direct them to use UI

---

## Security Verification Checklist

After deployment, verify:

- [ ] Function uses `SUPABASE_ACCESS_TOKEN` (not service role key)
- [ ] MCP URL includes `&read_only=true` parameter
- [ ] Test query returns only current user's data
- [ ] Test with different user fails with 403
- [ ] No authentication bypasses RLS
- [ ] Logs show "Response validated - user data isolation confirmed"
- [ ] Write operations are blocked

---

## Rollback Procedure

If deployment causes issues:

### 1. Check Previous Version

```bash
npx supabase functions list
```

### 2. Rollback (if needed)

```bash
# Deploy previous working version from git
git checkout <previous-commit>
npx supabase functions deploy ai-trading-agent
git checkout main
```

### 3. Disable Function

```bash
# Remove function entirely (last resort)
npx supabase functions delete ai-trading-agent
```

---

## Performance Monitoring

### Expected Metrics

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Cold start | 1-2s | <3s |
| Warm request | 1-2s | <5s |
| MCP connection (cached) | 200-500ms | <1s |
| Database query | 50-150ms | <500ms |
| Response validation | 5-10ms | <50ms |

### Monitor Performance

```bash
# Check recent execution times
npx supabase functions logs ai-trading-agent --tail | grep "Agent completed"
```

---

## Cost Monitoring

### OpenAI Costs

**Model**: GPT-4o
- Input: $2.50 per 1M tokens
- Output: $10 per 1M tokens

**Per conversation**: ~$0.05-0.08

### Monitor Usage

```bash
# Count function invocations today
npx supabase functions logs ai-trading-agent | grep "Processing AI request" | wc -l
```

---

## Next Steps After Deployment

1. ✅ Test with multiple users
2. ✅ Monitor error rates
3. ✅ Track performance metrics
4. ✅ Gather user feedback
5. ✅ Set up alerts for security violations
6. ✅ Document common user questions

---

## Quick Reference

### Deployment Command
```bash
npx supabase functions deploy ai-trading-agent
```

### Set Secrets
```bash
npx supabase secrets set OPENAI_API_KEY=sk-proj-...
npx supabase secrets set SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase secrets set SERPER_API_KEY=... # optional
```

### Monitor Logs
```bash
npx supabase functions logs ai-trading-agent --tail
```

### Test Endpoint
```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/ai-trading-agent" \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is my win rate?","userId":"USER_ID"}'
```

---

## Support Resources

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **MCP Documentation**: [https://supabase.com/docs/guides/getting-started/mcp](https://supabase.com/docs/guides/getting-started/mcp)
- **OpenAI Agents SDK**: [https://openai.github.io/openai-agents-js/](https://openai.github.io/openai-agents-js/)
- **Edge Functions**: [https://supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)

---

**Related Documentation**:
- [README.md](../supabase/functions/ai-trading-agent/README.md) - Function documentation
- [AI_AGENT_SECURITY_IMPLEMENTATION.md](./AI_AGENT_SECURITY_IMPLEMENTATION.md) - Security details
- [SECURITY_GUARDRAILS_IMPLEMENTATION.md](./SECURITY_GUARDRAILS_IMPLEMENTATION.md) - Security summary
