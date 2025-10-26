# AI Trading Agent - Deployment Instructions

**Status**: Ready to deploy (after setting access token)
**Date**: 2025-10-25

## ✅ Completed Fixes

1. ✅ **Conversation History** - Now properly passed to agent
2. ✅ **Zod Dependency** - Removed, using JSON Schema
3. ✅ **Access Token** - Changed from service role key to Personal Access Token
4. ✅ **User ID Property** - Added `id` alias to user object
5. ✅ **TypeScript Errors** - All fixed
6. ✅ **Security Guardrails** - 8 layers implemented
7. ✅ **Read-Only Mode** - MCP configured with `read_only=true`

## 🚀 Deployment Steps

### Step 1: Create Supabase Personal Access Token

**IMPORTANT**: You need a Personal Access Token (starts with `sbp_`), NOT the service role key!

1. Go to [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Click **"Generate New Token"**
3. Fill in:
   - **Name**: `AI Agent MCP Access`
   - **Description**: `For AI Trading Agent MCP connection`
   - **Scopes**: Select `all` or at minimum `projects.read`
4. Click **"Generate token"**
5. **Copy the token** (starts with `sbp_...`) - you won't see it again!

### Step 2: Set Environment Variables

```bash
# Set OpenAI API Key (if not already set)
npx supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Set Supabase Personal Access Token
npx supabase secrets set SUPABASE_ACCESS_TOKEN=sbp_YOUR_TOKEN_HERE

# Optional: Serper API for web search
npx supabase secrets set SERPER_API_KEY=YOUR_KEY_HERE
```

### Step 3: Verify Secrets

```bash
npx supabase secrets list
```

You should see:
- `OPENAI_API_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SERPER_API_KEY` (optional)

### Step 4: Deploy Function

```bash
npx supabase functions deploy ai-trading-agent
```

Expected output:
```
Deploying ai-trading-agent (project ref: gwubzauelilziaqnsfac)
Bundling ai-trading-agent
Deploying ai-trading-agent (100%)
✓ Deployed Function
Version: xxx
Function URL: https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent
```

### Step 5: Test Deployment

Get your user JWT token:
1. Open app in browser
2. F12 → Application → Local Storage → `supabase.auth.token`
3. Copy the JWT token

Test with cURL:
```bash
curl -X POST "https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my win rate?",
    "userId": "YOUR_USER_ID",
    "calendarId": "YOUR_CALENDAR_ID"
  }'
```

### Step 6: Monitor Logs

```bash
npx supabase functions logs ai-trading-agent --tail
```

Look for:
```
✓ Processing AI request for user xxx
✓ Connecting to Supabase MCP server (read-only mode)
✓ Successfully connected to Supabase MCP server (read-only)
✓ Running agent with X messages (including Y history)
✓ Agent completed with Z tool calls
✓ Response validated - user data isolation confirmed
```

---

## 🔧 What Was Fixed

### 1. Conversation History Implementation

**Before**:
```typescript
const result = await run(agent, contextualMessage, {
  maxTurns: 20,
});
// ❌ conversationHistory not used!
```

**After**:
```typescript
// Prepare full conversation history
const messages = [
  ...conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })),
  {
    role: 'user' as const,
    content: contextualMessage,
  },
];

// Run agent with full history
const result = await run(agent, messages, {
  maxTurns: 20,
});
// ✅ Conversation history included!
```

**Impact**: Agent now maintains context across multiple messages.

### 2. Enhanced Logging

Added logging to show conversation history:
```typescript
log(`Running agent with ${messages.length} messages (including ${conversationHistory.length} history)`, 'info');
```

---

## 🔒 Security Features

All 8 security layers are active:

1. ✅ JWT Token Validation
2. ✅ User ID Verification
3. ✅ Dynamic Security Prompt (user_id embedded)
4. ✅ Security Context Reminder (every message)
5. ✅ MCP Read-Only Mode (`&read_only=true`)
6. ✅ Supabase RLS Policies
7. ✅ Response Validation (checks all data)
8. ✅ Fail-Closed Error Handling

---

## 📊 Features

- ✅ **Conversation History**: Maintains context across messages
- ✅ **MCP Integration**: Direct database access with schema awareness
- ✅ **Read-Only Mode**: Cannot modify data
- ✅ **User Data Isolation**: 8-layer security
- ✅ **Web Search**: Optional Serper API integration
- ✅ **GPT-4o Model**: Complex SQL reasoning
- ✅ **Response Validation**: Ensures data belongs to user

---

## 🐛 Troubleshooting

### Error: "SUPABASE_ACCESS_TOKEN not configured"

**Solution**: Set the Personal Access Token:
```bash
npx supabase secrets set SUPABASE_ACCESS_TOKEN=sbp_YOUR_TOKEN_HERE
```

### Error: "Invalid access token format"

**Solution**: Ensure you're using a Personal Access Token (starts with `sbp_`), not the service role key (starts with `eyJ`).

### Error: "Could not connect to MCP server"

**Solution**:
1. Verify access token is valid
2. Check token hasn't expired
3. Regenerate token if needed

### No Response from Agent

**Solution**:
1. Check logs: `npx supabase functions logs ai-trading-agent --tail`
2. Verify OPENAI_API_KEY is set
3. Check user authentication is valid

---

## 📚 Documentation

Complete documentation available:

1. **[README.md](supabase/functions/ai-trading-agent/README.md)** - Function documentation
2. **[AI_AGENT_SECURITY_IMPLEMENTATION.md](docs/AI_AGENT_SECURITY_IMPLEMENTATION.md)** - Security architecture
3. **[SECURITY_GUARDRAILS_IMPLEMENTATION.md](docs/SECURITY_GUARDRAILS_IMPLEMENTATION.md)** - Security summary
4. **[AI_AGENT_DEPLOYMENT_GUIDE.md](docs/AI_AGENT_DEPLOYMENT_GUIDE.md)** - Detailed deployment guide
5. **[FINAL_DEPLOYMENT_CHECKLIST.md](docs/FINAL_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist

---

## ✅ Ready to Deploy!

Once you've set the `SUPABASE_ACCESS_TOKEN`, run:

```bash
npx supabase functions deploy ai-trading-agent
```

The function is production-ready with:
- ✅ Conversation history support
- ✅ Enterprise-grade security
- ✅ Complete error handling
- ✅ Comprehensive logging
- ✅ Response validation

---

**Next Steps**: Set the Personal Access Token and deploy! 🚀
