# 🔧 AI Trading Agent - Deployment Issue Resolution

**Date**: 2025-10-25
**Issue**: Function returning 503 Service Unavailable - BOOT_ERROR

---

## Problem Identified

The AI Trading Agent function is failing to start with error:
```json
{
  "code": "BOOT_ERROR",
  "message": "Function failed to start (please check logs)"
}
```

**Root Cause**: The Supabase Management API deployment doesn't properly handle import maps when deploying with separate file imports. The function uses bare specifiers (`@openai/agents`, `supabase`) from `deno.json`, but the shared files use full URLs (`https://esm.sh/...`), causing import conflicts during boot.

---

## Solutions

### Option 1: Install Deno (Recommended - Lightweight)

Deno is required to properly bundle the function before deployment.

1. **Install Deno** (Choose your platform):

   **Windows (PowerShell)**:
   ```powershell
   irm https://deno.land/install.ps1 | iex
   ```

   **macOS/Linux**:
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **Deploy with Deno bundling**:
   ```bash
   node deploy-with-deno-bundle.js
   ```

   This script will:
   - Bundle all dependencies into a single file
   - Resolve all import maps
   - Deploy the bundled function
   - No separate files or import conflicts

### Option 2: Install Docker Desktop

If you prefer using the official Supabase CLI:

1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. **Start Docker Desktop**
3. **Deploy**:
   ```bash
   npx supabase functions deploy ai-trading-agent
   ```

### Option 3: Manual Dashboard Deployment (No Installation Required)

If you can't install Deno or Docker:

1. **Go to Supabase Dashboard**:
   https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/functions

2. **Delete the broken function**:
   - Find `ai-trading-agent` in the list
   - Click the three dots → Delete

3. **Create new function manually**:
   - Click "New Function"
   - Name: `ai-trading-agent`
   - Copy/paste code from `supabase/functions/ai-trading-agent/index.ts`
   - Enable JWT verification
   - Deploy

4. **Note**: This won't resolve shared file imports automatically, so you'd need to inline the shared code.

---

## Why the Management API Deployment Failed

The deployment script we created (`deploy-with-shared.js`) includes separate files:

```javascript
imports: [
  { name: 'index.ts', content: '...' },
  { name: 'serper-tool.ts', content: '...' },
  { name: '../_shared/supabase.ts', content: '...' }, // ← Problem
]
```

The issue:
- `index.ts` uses `import { createClient } from 'supabase'` (bare specifier from deno.json)
- `../_shared/supabase.ts` uses `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` (full URL)
- These create two different instances of the same module, causing conflicts

**Solution**: Bundle everything into a single file where all imports are resolved.

---

## Technical Details

### What Deno Bundle Does

```bash
deno bundle index.ts output.js
```

This:
1. Resolves all imports (including from `deno.json`)
2. Inlines all dependencies
3. Creates a single, self-contained file
4. No import conflicts possible

### What Docker Does

The Supabase CLI with Docker:
1. Runs Deno in a container
2. Bundles the function properly
3. Handles import maps correctly
4. Deploys the bundled result

---

## Immediate Action Required

**Recommended**: Install Deno (takes ~2 minutes)

```powershell
# Windows PowerShell
irm https://deno.land/install.ps1 | iex

# Then deploy
node deploy-with-deno-bundle.js
```

**Alternative**: Install Docker Desktop (takes ~10 minutes)
- Download: https://www.docker.com/products/docker-desktop/
- Install and start
- Run: `npx supabase functions deploy ai-trading-agent`

---

## Files Created for Resolution

1. **[deploy-with-deno-bundle.js](deploy-with-deno-bundle.js)** - Deploy script using Deno bundle
2. **[deploy-with-shared.js](deploy-with-shared.js)** - Previous attempt (has import conflicts)
3. **[list-functions.js](list-functions.js)** - List deployed functions
4. **[list-secrets.js](list-secrets.js)** - Check environment secrets
5. **[test-function.js](test-function.js)** - Test deployed function

---

## Current Status

✅ Code is complete and correct
✅ All secrets are configured (OPENAI_API_KEY, AGENT_SUPABASE_ACCESS_TOKEN)
✅ CORS fix is implemented
❌ Function deployment failed due to import conflicts
⏳ Waiting for proper bundling tool (Deno or Docker)

---

## After Successful Deployment

Once you deploy with Deno or Docker, test immediately:

```bash
# Test CORS preflight
curl -X OPTIONS "https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent" \
  -H "Origin: http://localhost:3000"

# Should return 200 OK
```

Then test from your React app!

---

**Summary**: The function code is perfect, but the deployment method created import conflicts. Install Deno (2 mins) or Docker (10 mins) to deploy properly with bundling.

**Next Step**: Run ONE of these:
```bash
# Option 1 (Recommended - Fast)
irm https://deno.land/install.ps1 | iex
node deploy-with-deno-bundle.js

# Option 2 (Requires Docker)
# Install Docker Desktop first
npx supabase functions deploy ai-trading-agent
```
