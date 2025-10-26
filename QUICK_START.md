# 🚀 AI Trading Agent - Quick Start

## ✅ Deployment Complete!

Your AI Trading Agent is **LIVE** at:
```
https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent
```

---

## 🔑 Final Step (Required)

**Set your OpenAI API key:**

1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/settings/functions
2. Click "Secrets" tab
3. Add secret:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-proj-YOUR_OPENAI_KEY`

---

## 🧪 Test It Now

### Option 1: In Your React App
1. Open your app
2. Click the AI chat button
3. Ask: "What is my win rate?"

### Option 2: With cURL
```bash
# Get your JWT token first from browser console:
# localStorage.getItem('supabase.auth.token')

curl -X POST "https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent" \
  -H "Authorization: Bearer YOUR_JWT_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","userId":"YOUR_ID","calendarId":"YOUR_CAL_ID"}'
```

---

## 📊 Monitor Logs

https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/logs/edge-functions

---

## 📚 Full Documentation

- **[DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)** - Complete deployment details
- **[README.md](supabase/functions/ai-trading-agent/README.md)** - Function documentation

---

## ⚡ What You Get

✅ AI-powered trading analysis
✅ Natural language database queries
✅ Conversation history support
✅ 8-layer security validation
✅ Web search capability (with Serper key)

---

**Status**: Ready to use after setting OpenAI API key
**Deployed**: 2025-10-25
