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
import { buildSecureSystemPrompt } from "./systemPrompt.ts";

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
