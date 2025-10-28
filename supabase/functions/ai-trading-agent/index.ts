/**
 * AI Trading Agent - Pure HTTP Implementation
 * Direct HTTP calls to both Gemini API and Supabase MCP (no SDKs)
 */

import { corsHeaders, handleCors, log } from '../_shared/supabase.ts';
import { formatErrorResponse, formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { AgentRequest, ToolCall } from './types.ts';
import {
  type GeminiFunctionDeclaration,
  getAllCustomTools,
  executeCustomTool
} from './tools.ts';
import { fetchEmbeddedData } from './embedDataFetcher.ts';

/**
 * Call Supabase MCP list_tools endpoint
 */
async function listMCPTools(projectRef: string, accessToken: string): Promise<Array<{
  name: string;
  description?: string;
  inputSchema?: { properties?: unknown; required?: string[] };
}>> {
  try {
    const mcpUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`MCP list_tools failed: ${response.status} - ${errorText}`, 'error');
      return [];
    }

    const data = await response.json();
    log(`MCP tools response: ${JSON.stringify(data).substring(0, 200)}`, 'info');
    return data.result?.tools || [];
  } catch (error) {
    log(`MCP list_tools error: ${error}`, 'error');
    return [];
  }
}

/**
 * Call Supabase MCP tool
 */
async function callMCPTool(
  projectRef: string,
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    const mcpUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `MCP tool call failed: ${response.status} - ${errorText}`;
    }

    const data = await response.json();

    if (data.error) {
      return `MCP error: ${data.error.message || JSON.stringify(data.error)}`;
    }

    const content = data.result?.content;
    if (Array.isArray(content) && content.length > 0 && content[0].text) {
      return content[0].text;
    }

    return JSON.stringify(data.result || data);
  } catch (error) {
    return `MCP tool error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Call Gemini API directly
 */
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[]
): Promise<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-03-25:generateContent?key=${apiKey}`;

  // Build contents array
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const requestBody = {
    contents,
    tools: tools.length > 0 ? [{ function_declarations: tools }] : undefined,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content;
  const parts = content?.parts || [];

  // Check for function call
  const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);
  if (functionCallPart?.functionCall) {
    const fc = functionCallPart.functionCall as { name: string; args: Record<string, unknown> };
    return { functionCall: { name: fc.name, args: fc.args || {} } };
  }

  // Get text response
  const text = parts.map((p: { text?: string }) => p.text || '').join('');
  return { text };
}



/**
 * Validate user data isolation
 */
function validateUserDataIsolation(response: unknown, expectedUserId: string): { valid: boolean; reason?: string } {
  const content = JSON.stringify(response).toLowerCase();
  const userIdPattern = /user[_-]?id['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9-]+)/gi;
  const matches = content.matchAll(userIdPattern);
  const expectedUserIdLower = expectedUserId.toLowerCase();

  for (const match of matches) {
    const foundUserId = match[1];
    if (foundUserId && foundUserId !== expectedUserIdLower) {
      return {
        valid: false,
        reason: `Response contains data for user ${foundUserId} but request was for ${expectedUserId}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Build secure system prompt
 */
function buildSecureSystemPrompt(userId: string, calendarId?: string): string {
  return `You are an AI trading journal assistant. You help traders analyze their performance and provide market insights.

SECURITY REQUIREMENTS:
- ALWAYS filter database queries by user_id = '${userId}'
${calendarId ? `- Filter trades by calendar_id = '${calendarId}'` : ''}
- NEVER access other users' data
- READ ONLY - no INSERT/UPDATE/DELETE
- EXCEPTION: The 'economic_events' table is a global reference table that ALL users can query without user_id filtering
  (it contains market economic events that are relevant to all traders)

User Context:
- User ID: ${userId}
${calendarId ? `- Calendar ID: ${calendarId}` : ''}

Your Capabilities:
1. 📊 **Trade Analysis**: Query user's trades and calculate statistics via MCP database tools
2. 🔍 **Web Research**: Search for market news and analysis using search_web
3. 📄 **Content Extraction**: Scrape full article content using scrape_url
4. 💰 **Crypto Market Data**: Get real-time cryptocurrency prices using get_crypto_price
5. 💱 **Forex Market Data**: Get real-time forex rates using get_forex_price (EUR/USD, GBP/USD, etc.)
6. 📈 **Visualization**: Generate charts from data using generate_chart
7. 📰 **Economic Events**: Query global economic calendar (no user_id required)
8. 🎴 **Rich Card Display**: Embed interactive trade/event cards in your responses

RECOMMENDED WORKFLOWS:

**For Market Research & Sentiment Analysis**:
1. Get current market data using get_crypto_price or get_forex_price
2. Search for news/analysis using search_web (try 1-2 different search terms max)
3. If you find relevant articles, scrape 1-2 of the best ones with scrape_url
4. Check economic_events table if relevant to the asset
5. **MANDATORY - ALWAYS GENERATE TEXT RESPONSE**: You MUST generate a text response after gathering data:
   - Analyze article content for bullish/bearish indicators
   - Look for sentiment keywords and market positioning
   - Consider price trends and economic data
   - Synthesize all sources into coherent analysis
   - Provide clear conclusions about market sentiment and outlook
   - If search results are empty, use the price data and your market knowledge to provide analysis
   - NEVER end without generating a text response - this is MANDATORY

**Critical Autonomy Rules**:
- You have up to 15 tool calls - use them wisely
- RECOGNIZE EMPTY SEARCHES: If search_web returns "⚠️ NO RESULTS FOUND", that's EMPTY - STOP searching immediately
- When search is EMPTY, DON'T repeat it - try ONE different term only
- After 1-2 failed searches, STOP and generate response with available data
- NEVER call the same tool with same arguments twice
- CRITICAL: After getting price data + one search result with content, GENERATE YOUR RESPONSE immediately
- DO NOT keep searching for more data - you have enough
- ALWAYS generate a response based on what you've gathered - this is MANDATORY
- If you have gathered any data (price, search results, or scraped content), you MUST generate a response
- Never end without generating text response

**For Trade Context Analysis**:
1. Query user's trades via execute_sql (ALWAYS include the id column)
2. When mentioning specific trades in your response, ALWAYS wrap the trade ID in <trade-ref id="trade-uuid"/> tags
3. Use get_crypto_price to get current market prices
4. Compare user's entry/exit points with current market
5. Use generate_chart to visualize performance
6. Provide insights and correlations

CRITICAL: When you query trades and mention them in your response, you MUST use <trade-ref id="uuid"/> tags with the actual trade IDs from the database query results!

**For Visual Analysis**:
1. Query data via execute_sql (e.g., daily P&L, win rates)
2. Use generate_chart to create visualizations
3. Return chart URL to user for viewing

**DATABASE SCHEMAS** (for execute_sql queries):

**TRADES TABLE SCHEMA**:
- Columns: id (UUID), calendar_id (UUID), user_id (TEXT), name (TEXT), amount (NUMERIC),
  trade_type (TEXT), trade_date (TIMESTAMPTZ), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ),
  entry_price (NUMERIC), exit_price (NUMERIC), stop_loss (NUMERIC), take_profit (NUMERIC),
  risk_to_reward (NUMERIC), partials_taken (BOOLEAN), session (TEXT), notes (TEXT), tags (TEXT[]),
  is_temporary (BOOLEAN), is_pinned (BOOLEAN), share_link (TEXT), is_shared (BOOLEAN),
  shared_at (TIMESTAMPTZ), share_id (TEXT), images (JSONB), economic_events (JSONB)
- trade_type: One of 'win', 'loss', 'breakeven' (required)
- session: One of 'Asia', 'London', 'NY AM', 'NY PM' (nullable)
- tags: Array of strings (TEXT[]), default empty array
- images: JSONB array of image metadata (id, url, filename, storage_path, width, height, caption, row, column, column_width)
- economic_events: JSONB array of denormalized economic events for quick access
- Example query: SELECT name, amount, trade_type, trade_date, entry_price, exit_price, stop_loss,
  take_profit, session, tags, notes FROM trades WHERE user_id = '${userId}'
  AND calendar_id = '${calendarId}' ORDER BY trade_date DESC LIMIT 10;
- ALWAYS filter by user_id in WHERE clause for security

**CALENDARS TABLE SCHEMA**:
- Core Columns: id (UUID), user_id (TEXT), name (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)
- Account Settings: account_balance (NUMERIC), max_daily_drawdown (NUMERIC), risk_per_trade (NUMERIC),
  weekly_target (NUMERIC), monthly_target (NUMERIC), yearly_target (NUMERIC)
- Risk Management: dynamic_risk_enabled (BOOLEAN), increased_risk_percentage (NUMERIC),
  profit_threshold_percentage (NUMERIC)
- Configuration: required_tag_groups (TEXT[]), tags (TEXT[]), note (TEXT), hero_image_url (TEXT),
  hero_image_attribution (JSONB), days_notes (JSONB), score_settings (JSONB),
  economic_calendar_filters (JSONB), pinned_events (JSONB)
- Statistics: total_trades (INTEGER), win_count (INTEGER), loss_count (INTEGER), total_pnl (NUMERIC),
  win_rate (NUMERIC), profit_factor (NUMERIC), avg_win (NUMERIC), avg_loss (NUMERIC),
  current_balance (NUMERIC)
- Performance Metrics: weekly_pnl (NUMERIC), monthly_pnl (NUMERIC), yearly_pnl (NUMERIC),
  weekly_pnl_percentage (NUMERIC), monthly_pnl_percentage (NUMERIC), yearly_pnl_percentage (NUMERIC),
  weekly_progress (NUMERIC), monthly_progress (NUMERIC), target_progress (NUMERIC),
  pnl_performance (NUMERIC)
- Drawdown Tracking: max_drawdown (NUMERIC), drawdown_start_date (TIMESTAMPTZ),
  drawdown_end_date (TIMESTAMPTZ), drawdown_recovery_needed (NUMERIC), drawdown_duration (INTEGER)
- Sharing: share_link (TEXT), is_shared (BOOLEAN), shared_at (TIMESTAMPTZ), share_id (TEXT)
- Duplication: duplicated_calendar (BOOLEAN), source_calendar_id (UUID)
- Deletion: deleted_at (TIMESTAMPTZ), deleted_by (UUID), auto_delete_at (TIMESTAMPTZ),
  mark_for_deletion (BOOLEAN), deletion_date (TIMESTAMPTZ)
- Example query: SELECT name, account_balance, total_trades, win_count, loss_count, win_rate,
  profit_factor, total_pnl, current_balance, weekly_pnl, monthly_pnl, yearly_pnl,
  max_drawdown, avg_win, avg_loss FROM calendars WHERE user_id = '${userId}'
  ORDER BY created_at DESC;
- ALWAYS filter by user_id in WHERE clause for security

**ECONOMIC EVENTS TABLE SCHEMA** (global reference - no user_id filtering required):
- Columns: id (UUID), external_id (TEXT), currency (TEXT), event_name (TEXT), impact (TEXT),
  event_date (DATE), event_time (TIMESTAMPTZ), time_utc (TEXT), unix_timestamp (BIGINT),
  actual_value (TEXT), forecast_value (TEXT), previous_value (TEXT), actual_result_type (TEXT),
  country (TEXT), flag_code (TEXT), flag_url (TEXT), is_all_day (BOOLEAN), description (TEXT),
  source_url (TEXT), data_source (TEXT), last_updated (TIMESTAMPTZ), created_at (TIMESTAMPTZ)
- impact: One of 'High', 'Medium', 'Low', 'Holiday', 'Non-Economic' (required)
- actual_result_type: One of 'good', 'bad', 'neutral', '' (nullable)
- Example query: SELECT event_name, country, event_date, event_time, impact, actual_value,
  forecast_value, previous_value FROM economic_events
  WHERE (country = 'United States' OR country = 'Euro Zone')
  AND event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + INTERVAL '7 days'
  ORDER BY event_date ASC, event_time ASC;
- Use CURRENT_DATE for today, CURRENT_DATE + INTERVAL 'X days' for date ranges
- Filter by country (e.g., 'United States', 'Euro Zone', 'United Kingdom', 'Japan')
- Filter by impact ('High', 'Medium', 'Low', 'Holiday', 'Non-Economic')

**EMBEDDED CARD DISPLAY**:
When referencing specific trades or events in your responses, use self-closing HTML tags for card display:

1. **Trade Cards** - Use self-closing trade reference tags:
   - Format: <trade-ref id="abc-123-def-456"/>
   - CRITICAL: Each tag MUST be on its own line with NO text before or after it
   - The tag will be replaced with an interactive trade card

2. **Event Cards** - Use self-closing event reference tags:
   - Format: <event-ref id="event-abc-123"/>
   - CRITICAL: Each tag MUST be on its own line with NO text before or after it
   - The tag will be replaced with an interactive event card

**FORMATTING RULES FOR EMBEDDED CARDS** (VERY IMPORTANT):
- ❌ NEVER put text on the same line as a card tag
- ❌ NEVER use commas, "and", "or", numbers, or any text between card tags
- ❌ WRONG: "Your best trade was <trade-ref id="xxx"/> with excellent risk"
- ❌ WRONG: "<trade-ref id="xxx"/>, <trade-ref id="yyy"/>, and <trade-ref id="zzz"/>"
- ❌ WRONG: "1. <trade-ref id="xxx"/> 2. <trade-ref id="yyy"/>"
- ✅ CORRECT: Each tag on its own line with blank line before/after

**CORRECT FORMAT EXAMPLE**:
"Here are your top 3 winning trades:

<trade-ref id="f46e5852-070e-488b-8144-25663ff52f06"/>

<trade-ref id="ccc10d28-c9b2-4edd-a729-d6273d2f0939"/>

<trade-ref id="a5f15595-3388-4e86-bece-abe3398a7643"/>

These trades show excellent risk management."

**WHEN TO USE CARD TAGS**:
- ✅ Whenever you query and display trade information from execute_sql
- ✅ When listing top trades, worst trades, or any specific trades
- ✅ When comparing or analyzing specific trades
- ✅ When mentioning economic events that affected trading
- ✅ ALWAYS use the actual UUID from the database query results
- ✅ ALWAYS put each card tag on its own line with blank lines separating them

**DISPLAYING TRADE IMAGES**:
When users ask to see trade images or screenshots, extract the image URLs from the 'images' JSONB column and display them using markdown image syntax:

1. **Query with images column**:
   - SELECT id, name, images FROM trades WHERE ... LIMIT 1;
   - The images column contains a JSONB array: [{"url": "https://...", "caption": "..."}, ...]

2. **Extract and display URLs**:
   - Parse the images array from the query result
   - Display each image using markdown: ![Image 1](https://firebasestorage.googleapis.com/...)
   - Use sequential numbering for multiple images: Image 1, Image 2, Image 3
   - Example response format:
     "Here are the images from your last trade:

     ![Image 1](https://firebasestorage.googleapis.com/.../image1.png)
     ![Image 2](https://firebasestorage.googleapis.com/.../image2.png)
     ![Image 3](https://firebasestorage.googleapis.com/.../image3.png)"

3. **Important**:
   - Always use markdown image syntax ![alt](url), NOT markdown links [text](url)
   - The system will automatically render these as visible images
   - Extract the "url" field from each object in the images array
   - Firebase/Supabase storage URLs will be rendered as clickable images

IMPORTANT GUIDELINES:
- Be proactive and helpful - always try multiple approaches if one fails
- If web search returns empty results, try simpler search terms or use your market knowledge
- Combine multiple data sources (price data + news + economic events) for comprehensive analysis
- When discussing specific trades, reference them using <trade-ref id="uuid"/> self-closing tags for inline card display
- When discussing specific events, reference them using <event-ref id="uuid"/> self-closing tags for inline card display
- Never give up - provide the best analysis you can with available information
- You are a trading expert with Gemini's language understanding - use it!`;
}

/**
 * All custom tool definitions and implementations are now in tools.ts
 */

/**
 * Main edge function handler
 */
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    const body: AgentRequest = await req.json();
    const { message, userId, calendarId, conversationHistory = [] } = body;

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: message, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`Processing request for user ${userId}`, 'info');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const supabaseAccessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');

    if (!projectRef || !supabaseAccessToken) {
      throw new Error('Supabase configuration missing');
    }

    // Get MCP tools via HTTP
    log(`Fetching MCP tools for project ${projectRef}`, 'info');
    const mcpTools = await listMCPTools(projectRef, supabaseAccessToken);
    log(`Loaded ${mcpTools.length} MCP tools`, 'info');

    // Convert MCP tools to Gemini format (sanitize JSON Schema)
    const geminiMcpTools: GeminiFunctionDeclaration[] = mcpTools.map(tool => {
      // Recursively clean JSON Schema to remove unsupported properties
      const cleanSchema = (schema: unknown): unknown => {
        if (!schema || typeof schema !== 'object') return schema;

        const cleaned: Record<string, unknown> = {};
        const obj = schema as Record<string, unknown>;

        // Only keep Gemini-supported properties
        const supportedKeys = ['type', 'description', 'enum', 'properties', 'items', 'required'];
        for (const key of supportedKeys) {
          if (key in obj) {
            if (key === 'properties' && typeof obj[key] === 'object') {
              // Recursively clean nested properties
              const props = obj[key] as Record<string, unknown>;
              cleaned[key] = Object.fromEntries(
                Object.entries(props).map(([k, v]) => [k, cleanSchema(v)])
              );
            } else if (key === 'items' && typeof obj[key] === 'object') {
              cleaned[key] = cleanSchema(obj[key]);
            } else {
              cleaned[key] = obj[key];
            }
          }
        }

        return cleaned;
      };

      return {
        name: tool.name,
        description: tool.description || `MCP tool: ${tool.name}`,
        parameters: cleanSchema({
          type: 'object',
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required
        }) as { type: string; properties: Record<string, unknown>; required?: string[] }
      };
    });

    // Combine all tools (MCP + Custom)
    const customTools = getAllCustomTools();
    const allTools = [...geminiMcpTools, ...customTools];

    // Build system prompt
    const systemPrompt = buildSecureSystemPrompt(userId, calendarId);

    log('Sending request to Gemini with tools', 'info');

    // Initial call
    let result = await callGemini(googleApiKey, systemPrompt, message, conversationHistory, allTools);

    const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
    let finalText = '';
    let turnCount = 0;
    const maxTurns = 15;

    // Build conversation history for multi-turn function calling
    const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    // Function calling loop
    while (turnCount < maxTurns) {
      turnCount++;

      if (result.text) {
        // Got final answer
        finalText = result.text;
        break;
      }

      if (!result.functionCall) {
        // No function call and no text - shouldn't happen
        break;
      }

      const call = result.functionCall;
      log(`Executing function: ${call.name}`, 'info');

      // Check if we're repeating the same function call (sign of being stuck)
      const lastCall = functionCalls[functionCalls.length - 1];
      if (lastCall && lastCall.name === call.name &&
          JSON.stringify(lastCall.args) === JSON.stringify(call.args)) {
        log('Detected repeated function call - breaking loop to avoid infinite loop', 'info');
        break;
      }

      // Check if we've made too many search_web calls (more than 3)
      const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
      if (call.name === 'search_web' && searchWebCount >= 3) {
        log('Too many search_web calls - breaking loop', 'info');
        break;
      }

      let functionResult: string;

      // Check if it's a custom tool (from tools.ts)
      const customToolNames = ['search_web', 'scrape_url', 'get_crypto_price', 'get_forex_price', 'generate_chart'];
      if (customToolNames.includes(call.name)) {
        // Execute custom tool
        functionResult = await executeCustomTool(call.name, call.args);
        functionCalls.push({ name: call.name, args: call.args, result: functionResult });
      } else {
        // Execute MCP tool via HTTP
        functionResult = await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
        functionCalls.push({ name: call.name, args: call.args, result: functionResult });
      }

      // Append model's function call to conversation history
      conversationContents.push({
        role: 'model',
        parts: [{
          functionCall: {
            name: call.name,
            args: call.args
          }
        }]
      });

      // Append function response to conversation history
      conversationContents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: call.name,
            response: { result: functionResult }
          }
        }]
      });

      // Call Gemini again with updated conversation history
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-03-25:generateContent?key=${googleApiKey}`;
      const requestBody = {
        contents: conversationContents,
        tools: allTools.length > 0 ? [{ function_declarations: allTools }] : undefined,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content;
      const parts = content?.parts || [];

      // Check for function call
      const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);
      if (functionCallPart?.functionCall) {
        const fc = functionCallPart.functionCall as { name: string; args: Record<string, unknown> };
        result = { functionCall: { name: fc.name, args: fc.args || {} } };
      } else {
        // Get text response
        const text = parts.map((p: { text?: string }) => p.text || '').join('');
        result = { text };
      }
    }

    log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');

    // If no final text, just log it - let frontend handle empty responses
    if (!finalText) {
      log('No final text generated', 'warn');
    }

    // Format response with HTML and citations
    const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
      finalText || '',
      functionCalls as ToolCall[]
    );

    // Fetch embedded data for inline references (trade_id:xxx, event_id:xxx)
    log('Fetching embedded data for inline references', 'info');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const embeddedData = await fetchEmbeddedData(
      finalText || '',
      supabaseUrl,
      serviceKey,
      userId
    );

    // Convert Maps to objects for JSON serialization
    const embeddedTrades = Object.fromEntries(embeddedData.trades);
    const embeddedEvents = Object.fromEntries(embeddedData.events);

    log(`Fetched ${embeddedData.trades.size} embedded trades and ${embeddedData.events.size} embedded events`, 'info');

    const formattedResponse = {
      success: !!finalText,
      message: finalText || '',
      messageHtml,
      citations,
      embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
      embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
      metadata: {
        functionCalls,
        model: 'gemini-2.5-pro-preview-03-25',
        timestamp: new Date().toISOString(),
      }
    };

    // Security validation
    const validationResult = validateUserDataIsolation(formattedResponse, userId);
    if (!validationResult.valid) {
      log(`Security violation: ${validationResult.reason}`, 'error');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Security validation failed',
          metadata: {
            functionCalls: [],
            model: 'gemini-2.5-pro-preview-03-25',
            timestamp: new Date().toISOString()
          },
          error: 'Data leak detected',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Response validated - security check passed', 'info');

    return new Response(JSON.stringify(formattedResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log(`Error in AI agent: ${error instanceof Error ? error.message : 'Unknown'}`, 'error', error);

    const errorResponse = formatErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      'gemini-2.5-pro-preview-03-25'
    );

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
