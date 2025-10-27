# AI Trading Agent Test Suite

This directory contains test scripts for the AI Trading Agent to verify chart generation, HTML formatting, and image display functionality.

## Test Scripts

### 1. Browser-Based Test (Recommended)

**File:** `test-ai-agent-browser.html`

A visual, interactive test suite that runs in your browser.

**How to Use:**

1. **Open the file in your browser:**
   ```bash
   # Option 1: Double-click the file
   # Option 2: Open with a local server
   npx serve scripts
   # Then navigate to http://localhost:3000/test-ai-agent-browser.html
   ```

2. **Enter your credentials:**
   - User ID: Your Supabase user ID
   - Calendar ID: Your calendar ID

3. **Click "Run Tests"**

4. **View results:**
   - Each test shows status (Pending → Running → Passed/Failed)
   - HTML content is displayed inline
   - Charts should display as images (not text markers)
   - Summary shows pass/fail counts and total duration

**What It Tests:**
- ✅ Chart generation with image display
- ✅ HTML formatting (bold, lists, etc.)
- ✅ Response time
- ✅ Error handling

---

### 2. Node.js Test Script

**File:** `test-ai-agent.js`

A command-line test suite with detailed output.

**Prerequisites:**
- Node.js installed
- Supabase credentials

**How to Use:**

1. **Set environment variables:**
   ```bash
   # Windows PowerShell
   $env:SUPABASE_ANON_KEY="your_anon_key_here"
   $env:TEST_USER_ID="your_user_id_here"
   $env:TEST_CALENDAR_ID="your_calendar_id_here"

   # Linux/Mac
   export SUPABASE_ANON_KEY="your_anon_key_here"
   export TEST_USER_ID="your_user_id_here"
   export TEST_CALENDAR_ID="your_calendar_id_here"
   ```

2. **Run the tests:**
   ```bash
   node scripts/test-ai-agent.js
   ```

3. **View results:**
   - Colored console output
   - Detailed pattern matching
   - Response content preview
   - Summary statistics

**What It Tests:**
- ✅ Chart generation - Trading performance by session
- ✅ Chart generation - Equity curve
- ✅ HTML formatting - Bold text
- ✅ Basic queries - Trade statistics
- ✅ Pattern matching for expected content
- ✅ Citation extraction
- ✅ Metadata validation

---

## Getting Your Credentials

### User ID

**Option 1: From Supabase Dashboard**
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user and copy the UUID

**Option 2: From Browser Console**
1. Open your app in the browser
2. Open DevTools (F12)
3. Go to Console tab
4. Run:
   ```javascript
   // If using Supabase Auth
   const { data: { user } } = await supabase.auth.getUser();
   console.log('User ID:', user.id);
   ```

### Calendar ID

**Option 1: From Supabase Dashboard**
1. Go to Supabase Dashboard → Table Editor → calendars
2. Find your calendar and copy the `id` field

**Option 2: From Browser Console**
1. Open your app in the browser
2. Open DevTools (F12)
3. Go to Console tab
4. Run:
   ```javascript
   // If you have a calendar selected in the app
   console.log('Calendar ID:', calendar.id);
   ```

**Option 3: From Database Query**
```sql
-- Run in Supabase SQL Editor
SELECT id, name FROM calendars WHERE user_id = 'your_user_id';
```

### Supabase Anon Key

**From Supabase Dashboard:**
1. Go to Project Settings → API
2. Copy the `anon` `public` key

---

## Expected Results

### ✅ Successful Test

**Chart Generation Test:**
```
✓ Response received (3.45s)

Message:
Here is a chart of your trading performance by session...

HTML:
<p>Here is a chart...</p>
<img src="https://quickchart.io/chart?c=..." alt="Chart" />

Pattern Checks:
✓ Pattern found: /\[CHART_IMAGE:https:\/\/quickchart\.io\/chart/
✓ Pattern found: /<img src="https:\/\/quickchart\.io\/chart/

✓ TEST PASSED
```

**HTML Formatting Test:**
```
✓ Response received (2.12s)

Message:
Your win rate is 85.5%...

HTML:
<p>Your win rate is <strong>85.5%</strong>...</p>

Pattern Checks:
✓ Pattern found: /<strong>/
✓ Pattern found: /<\/strong>/

✓ TEST PASSED
```

### ❌ Failed Test (Chart Marker Not Converted)

```
✓ Response received (3.21s)

Message:
[CHART_IMAGE:https://quickchart.io/chart?c=...]

HTML:
<p>[CHART_IMAGE:https://quickchart.io/chart?c=...]</p>

Pattern Checks:
✗ Pattern NOT found: /<img src="https:\/\/quickchart\.io\/chart/
⚠ Chart marker found in HTML (should be converted to <img>)

✗ TEST FAILED
```

This means the edge function hasn't been deployed with the latest changes.

---

## Troubleshooting

### Issue: "Response not successful"

**Cause:** Authentication error or invalid credentials

**Solution:**
- Verify your Supabase anon key is correct
- Check that the user ID and calendar ID exist in the database
- Ensure the user has access to the calendar

### Issue: Chart marker not converted to `<img>` tag

**Cause:** Edge function not deployed with latest changes

**Solution:**
```bash
# Deploy the edge function
npx supabase functions deploy ai-trading-agent
```

### Issue: "No chart generated"

**Cause:** AI didn't call the `generate_chart` tool

**Solution:**
- Try a more specific query: "Create a bar chart showing my P&L by session"
- Check that you have trade data in the calendar
- Verify the AI has access to trade data via MCP tools

### Issue: Network errors

**Cause:** Supabase URL or network issues

**Solution:**
- Check your internet connection
- Verify the Supabase URL is correct
- Check Supabase project status

---

## Test Coverage

| Feature | Browser Test | Node.js Test |
|---------|-------------|--------------|
| Chart Generation | ✅ | ✅ |
| Image Display | ✅ | ✅ |
| HTML Formatting | ✅ | ✅ |
| Citations | ❌ | ✅ |
| Metadata | ❌ | ✅ |
| Pattern Matching | ✅ | ✅ |
| Visual Output | ✅ | ❌ |
| Detailed Logs | ❌ | ✅ |

---

## Adding New Tests

### Browser Test

Edit `test-ai-agent-browser.html`:

```javascript
const testCases = [
  // ... existing tests ...
  {
    name: 'Your New Test',
    query: 'Your test query here',
    checkForImage: true, // or false
  },
];
```

### Node.js Test

Edit `test-ai-agent.js`:

```javascript
const testCases = [
  // ... existing tests ...
  {
    name: 'Your New Test',
    message: 'Your test query here',
    expectedPatterns: [
      /pattern1/,
      /pattern2/,
    ],
    checkHtml: true,
  },
];
```

---

## CI/CD Integration

To run tests in CI/CD:

```yaml
# .github/workflows/test-ai-agent.yml
name: Test AI Agent

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Run AI Agent Tests
        env:
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          TEST_USER_ID: ${{ secrets.TEST_USER_ID }}
          TEST_CALENDAR_ID: ${{ secrets.TEST_CALENDAR_ID }}
        run: node scripts/test-ai-agent.js
```

---

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Verify edge function deployment
3. Check Supabase logs in the dashboard
4. Review the AI agent documentation

---

## License

Same as the main project.

