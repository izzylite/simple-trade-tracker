/**
 * AI Trading Agent - Pure HTTP Implementation
 * Direct HTTP calls to both Gemini API and Supabase MCP (no SDKs)
 */

import { corsHeaders, handleCors, log, createServiceClient } from '../_shared/supabase.ts';
import { formatErrorResponse, formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { AgentRequest, ToolCall } from './types.ts';
import {
  type GeminiFunctionDeclaration,
  getAllCustomTools,
  executeCustomTool
} from './tools.ts';
import { fetchEmbeddedData, type EmbeddedData } from './embedDataFetcher.ts';
import { buildSecureSystemPrompt } from "./systemPrompt.ts";

/**
 * ============================================================================
 * TOOL CACHING
 * ============================================================================
 * Cache MCP tools for 5 minutes to avoid repeated fetches on every request.
 * MCP tools rarely change, so this is safe and provides significant performance boost.
 */

interface ToolCache {
  tools: GeminiFunctionDeclaration[];
  timestamp: number;
}

interface MCPSession {
  sessionId: string;
  timestamp: number;
}

let toolCache: ToolCache | null = null;
let mcpSession: MCPSession | null = null;
const TOOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MCP_SESSION_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * ============================================================================
 * SERVER-SENT EVENTS (SSE) STREAMING HELPERS
 * ============================================================================
 * Enables real-time streaming of AI responses, tool calls, and results
 */

/**
 * SSE Event Types
 */
type SSEEventType =
  | 'text_chunk'      // Streaming text as it's generated
  | 'tool_call'       // Tool is being called
  | 'tool_result'     // Tool execution completed
  | 'citation'        // Citation discovered
  | 'embedded_data'   // Embedded trades/events fetched
  | 'done'            // Stream complete
  | 'error';          // Error occurred

/**
 * Create SSE event string
 */
function createSSEEvent(event: SSEEventType, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create readable stream for SSE
 */
function createSSEStream(): { stream: ReadableStream; writer: WritableStreamDefaultWriter } {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Wrap writer to encode strings
  const wrappedWriter = {
    write: async (chunk: string) => {
      await writer.write(encoder.encode(chunk));
    },
    close: async () => {
      await writer.close();
    }
  };

  return { stream: readable, writer: wrappedWriter as any };
}

/**
 * Send SSE event to stream
 */
async function sendSSE(writer: WritableStreamDefaultWriter, event: SSEEventType, data: any) {
  try {
    await writer.write(createSSEEvent(event, data));
  } catch (error) {
    log(`Error sending SSE event: ${error}`, 'error');
  }
}

/**
 * Build multimodal function response parts
 * Detects [IMAGE_ANALYSIS:url] markers and injects images as inline_data
 */
async function buildFunctionResponseParts(
  toolName: string,
  result: string
): Promise<Array<Record<string, unknown>>> {
  const parts: Array<Record<string, unknown>> = [];

  // Check for image analysis marker
  const imageMarkerMatch = result.match(/\[IMAGE_ANALYSIS:(https?:\/\/[^\]]+)\]/);

  if (imageMarkerMatch) {
    const imageUrl = imageMarkerMatch[1];
    log(`Injecting image into conversation: ${imageUrl.substring(0, 50)}...`, 'info');

    try {
      // Fetch and convert image to base64
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const mimeType = contentType.split(';')[0].trim();

        // Add image as inline_data part first (so model sees image before instructions)
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        });

        // Add text instructions (without the marker)
        const textWithoutMarker = result.replace(/\[IMAGE_ANALYSIS:[^\]]+\]\n?/, '').trim();
        parts.push({
          functionResponse: {
            name: toolName,
            response: { result: textWithoutMarker }
          }
        });

        log('Image injected successfully into conversation', 'info');
        return parts;
      } else {
        log(`Failed to fetch image: ${imageResponse.status}`, 'error');
      }
    } catch (error) {
      log(`Error fetching image for injection: ${error}`, 'error');
    }
  }

  // Default: just return text function response
  parts.push({
    functionResponse: {
      name: toolName,
      response: { result }
    }
  });

  return parts;
}

/**
 * Get MCP tools with caching
 * Returns cached tools if available and not expired, otherwise fetches fresh
 */
async function getCachedMCPTools(projectRef: string, accessToken: string): Promise<GeminiFunctionDeclaration[]> {
  const now = Date.now();

  // Check if cache is valid
  if (toolCache && (now - toolCache.timestamp) < TOOL_CACHE_TTL) {
    log(`Using cached MCP tools (${toolCache.tools.length} tools, age: ${Math.round((now - toolCache.timestamp) / 1000)}s)`, 'info');
    return toolCache.tools;
  }

  // Cache miss or expired - fetch fresh tools
  log('Fetching fresh MCP tools (cache miss or expired)', 'info');
  const mcpTools = await listMCPTools(projectRef, accessToken);

  // Convert MCP tools to Gemini format and sanitize
  const geminiTools = convertMcpToolsToGeminiFormat(mcpTools);

  // Update cache
  toolCache = {
    tools: geminiTools,
    timestamp: now
  };

  log(`Cached ${geminiTools.length} MCP tools`, 'info');
  return geminiTools;
}

/**
 * Convert MCP tools to Gemini function declaration format
 * Sanitizes JSON Schema to remove unsupported properties
 */
function convertMcpToolsToGeminiFormat(
  mcpTools: Array<{
    name: string;
    description?: string;
    inputSchema?: { properties?: unknown; required?: string[] };
  }>
): GeminiFunctionDeclaration[] {
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

  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    parameters: cleanSchema({
      type: 'object',
      properties: tool.inputSchema?.properties || {},
      required: tool.inputSchema?.required
    }) as { type: string; properties: Record<string, unknown>; required?: string[] }
  }));
}

/**
 * Initialize MCP session and return session ID
 */
async function initializeMCPSession(projectRef: string, accessToken: string): Promise<string | null> {
  const now = Date.now();

  // Return cached session if valid
  if (mcpSession && (now - mcpSession.timestamp) < MCP_SESSION_TTL) {
    log(`Using cached MCP session (age: ${Math.round((now - mcpSession.timestamp) / 1000)}s)`, 'info');
    return mcpSession.sessionId;
  }

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
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'ai-trading-agent',
            version: '1.0.0'
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`MCP initialize failed: ${response.status} - ${errorText}`, 'error');
      return null;
    }

    // Get session ID from response header
    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) {
      mcpSession = { sessionId, timestamp: now };
      log(`MCP session initialized: ${sessionId.substring(0, 20)}...`, 'info');
      return sessionId;
    }

    // Fallback: try to get from response body
    const data = await response.json();
    log(`MCP initialize response: ${JSON.stringify(data).substring(0, 200)}`, 'info');

    return null;
  } catch (error) {
    log(`MCP initialize error: ${error}`, 'error');
    return null;
  }
}

/**
 * Call Supabase MCP list_tools endpoint
 */
async function listMCPTools(projectRef: string, accessToken: string): Promise<Array<{
  name: string;
  description?: string;
  inputSchema?: { properties?: unknown; required?: string[] };
}>> {
  try {
    // Initialize session first
    const sessionId = await initializeMCPSession(projectRef, accessToken);

    const mcpUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers,
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
    // Ensure we have a valid session
    const sessionId = await initializeMCPSession(projectRef, accessToken);

    const mcpUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers,
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
      // If session expired, clear cache and retry once
      if (response.status === 400 && errorText.includes('Mcp-Session-Id')) {
        log('MCP session expired, clearing cache and retrying...', 'info');
        mcpSession = null;
        return callMCPTool(projectRef, accessToken, toolName, args);
      }
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
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
 * Call Gemini API with streaming support
 * Streams text chunks as they're generated in real-time
 */
async function callGeminiStreaming(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[],
  writer: WritableStreamDefaultWriter
): Promise<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionCalls?: Array<{ name: string; args: Record<string, unknown> }> }> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

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

  // Process streaming response
  let fullText = '';
  let functionCall: { name: string; args: Record<string, unknown> } | undefined;
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || line.startsWith('data: [DONE]')) continue;

          // Remove "data: " prefix if present
          const jsonLine = line.startsWith('data: ') ? line.slice(6) : line;
          if (!jsonLine.trim()) continue;

          try {
            const chunk = JSON.parse(jsonLine);
            const candidate = chunk.candidates?.[0];
            const content = candidate?.content;
            const parts = content?.parts || [];

            // Extract ALL function calls (not just the first one)
            const functionCallParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
            for (const functionCallPart of functionCallParts) {
              if (functionCallPart.functionCall) {
                const fc = functionCallPart.functionCall as { name: string; args: Record<string, unknown> };
                const call = { name: fc.name, args: fc.args || {} };
                functionCalls.push(call);

                // Keep backward compatibility - set first call
                if (!functionCall) {
                  functionCall = call;
                }
              }
            }

            // Stream text chunks (only if no function calls in this part)
            if (functionCallParts.length === 0) {
              for (const part of parts) {
                if (part.text) {
                  fullText += part.text;
                  // Send text chunk via SSE
                  await sendSSE(writer, 'text_chunk', { text: part.text });
                }
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            log(`Failed to parse streaming chunk: ${parseError}`, 'warn');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Return multiple function calls if available, otherwise single or text
  if (functionCalls.length > 1) {
    return { functionCalls };
  } else if (functionCall) {
    return { functionCall };
  }

  return { text: fullText };
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
 * Handle streaming request with SSE
 */
function handleStreamingRequest(
  googleApiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  allTools: GeminiFunctionDeclaration[],
  userId: string,
  _calendarId: string | undefined,
  projectRef: string,
  supabaseAccessToken: string,
  supabaseUrl: string
): Response {
  // Create SSE stream
  const { stream, writer } = createSSEStream();

  // Process request in background (don't await - return stream immediately)
  (async () => {
    try {
      const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
      let finalText = '';
      let turnCount = 0;
      const maxTurns = 15;

      // Initial streaming call
      let result = await callGeminiStreaming(
        googleApiKey,
        systemPrompt,
        message,
        conversationHistory,
        allTools,
        writer
      );

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

        // Handle multiple function calls (parallel execution)
        if (result.functionCalls && result.functionCalls.length > 0) {
          log(`Executing ${result.functionCalls.length} functions in parallel`, 'info');

          // Send all tool_call events first
          for (const call of result.functionCalls) {
            await sendSSE(writer, 'tool_call', {
              name: call.name,
              args: call.args
            });
          }

          // Execute all tools in parallel
          const customToolNames = ['search_web', 'scrape_url', 'get_crypto_price', 'get_forex_price', 'generate_chart', 'create_note', 'update_note', 'delete_note', 'search_notes', 'analyze_image'];
          const supabaseClient = createServiceClient();
          const executionPromises = result.functionCalls.map(async (call) => {
            try {
              const result = customToolNames.includes(call.name)
                ? await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId: _calendarId
                }, supabaseClient)
                : await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
              return { call, result, success: true };
            } catch (error) {
              log(`Error executing ${call.name}: ${error}`, 'error');
              return { call, result: `Error: ${error}`, success: false };
            }
          });

          const results = await Promise.all(executionPromises);

          // Send all tool_result events and build conversation parts
          const modelParts: Array<Record<string, unknown>> = [];
          const userParts: Array<Record<string, unknown>> = [];

          for (const { call, result: funcResult } of results) {
            // Send tool_result event
            await sendSSE(writer, 'tool_result', {
              name: call.name,
              result: funcResult
            });

            // Add to function calls history
            functionCalls.push({ name: call.name, args: call.args, result: funcResult });

            // Build conversation parts
            modelParts.push({
              functionCall: {
                name: call.name,
                args: call.args
              }
            });

            // Build multimodal response parts (handles image injection)
            const responseParts = await buildFunctionResponseParts(call.name, funcResult);
            userParts.push(...responseParts);
          }

          // Append to conversation history
          conversationContents.push({
            role: 'model',
            parts: modelParts
          });

          conversationContents.push({
            role: 'user',
            parts: userParts
          });
        }
        // Handle single function call (sequential execution - backward compatibility)
        else if (result.functionCall) {
          const call = result.functionCall;
          log(`Executing function: ${call.name}`, 'info');

          // Send tool_call event
          await sendSSE(writer, 'tool_call', {
            name: call.name,
            args: call.args
          });

          // Check for repeated calls
          const lastCall = functionCalls[functionCalls.length - 1];
          if (lastCall && lastCall.name === call.name &&
              JSON.stringify(lastCall.args) === JSON.stringify(call.args)) {
            log('Detected repeated function call - breaking loop', 'info');
            break;
          }

          // Check for too many search_web calls
          const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
          if (call.name === 'search_web' && searchWebCount >= 3) {
            log('Too many search_web calls - breaking loop', 'info');
            break;
          }

          let functionResult: string;

          // Execute tool (custom or MCP)
          const customToolNames = ['search_web', 'scrape_url', 'get_crypto_price', 'get_forex_price', 'generate_chart', 'create_note', 'update_note', 'delete_note', 'search_notes', 'analyze_image'];
          const supabaseClient = createServiceClient();
          if (customToolNames.includes(call.name)) {
            functionResult = await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId: _calendarId
                }, supabaseClient);
          } else {
            functionResult = await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
          }

          functionCalls.push({ name: call.name, args: call.args, result: functionResult });

          // Send tool_result event
          await sendSSE(writer, 'tool_result', {
            name: call.name,
            result: functionResult
          });

          // Append to conversation history
          conversationContents.push({
            role: 'model',
            parts: [{
              functionCall: {
                name: call.name,
                args: call.args
              }
            }]
          });

          // Build multimodal response parts (handles image injection)
          const responseParts = await buildFunctionResponseParts(call.name, functionResult);
          conversationContents.push({
            role: 'user',
            parts: responseParts
          });
        } else {
          // No function calls and no text - shouldn't happen
          break;
        }

        // Call Gemini again with updated conversation - need to use direct API call
        // since we have conversationContents in Gemini format already
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${googleApiKey}`;

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

        // Process streaming response
        let newText = '';
        let newFunctionCall: { name: string; args: Record<string, unknown> } | undefined;

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim() || line.startsWith('data: [DONE]')) continue;
                const jsonLine = line.startsWith('data: ') ? line.slice(6) : line;
                if (!jsonLine.trim()) continue;

                try {
                  const chunk = JSON.parse(jsonLine);
                  const candidate = chunk.candidates?.[0];
                  const content = candidate?.content;
                  const parts = content?.parts || [];

                  const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);
                  if (functionCallPart?.functionCall) {
                    const fc = functionCallPart.functionCall as { name: string; args: Record<string, unknown> };
                    newFunctionCall = { name: fc.name, args: fc.args || {} };
                    continue;
                  }

                  for (const part of parts) {
                    if (part.text) {
                      newText += part.text;
                      await sendSSE(writer, 'text_chunk', { text: part.text });
                    }
                  }
                } catch (parseError) {
                  log(`Failed to parse streaming chunk: ${parseError}`, 'warn');
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }

        result = newFunctionCall ? { functionCall: newFunctionCall } : { text: newText };
      }

      log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');

      // Format response with HTML and citations
      const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
        finalText || '',
        functionCalls as ToolCall[]
      );

      // Send citations
      if (citations.length > 0) {
        await sendSSE(writer, 'citation', { citations });
      }

      // Fetch embedded data
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (serviceKey) {
        const embeddedData: EmbeddedData = await fetchEmbeddedData(
          finalText || '',
          supabaseUrl,
          serviceKey,
          userId
        );

        const embeddedTrades = Object.fromEntries(embeddedData.trades);
        const embeddedEvents = Object.fromEntries(embeddedData.events);
        const embeddedNotes = Object.fromEntries(embeddedData.notes);

        // Send embedded data if available
        if (Object.keys(embeddedTrades).length > 0 || Object.keys(embeddedEvents).length > 0 || Object.keys(embeddedNotes).length > 0) {
          await sendSSE(writer, 'embedded_data', {
            embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
            embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
            embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined
          });
        }
      }

      // Send done event
      await sendSSE(writer, 'done', {
        success: !!finalText,
        messageHtml,
        metadata: {
          functionCalls,
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          turnCount
        }
      });

    } catch (error) {
      log(`Error in streaming handler: ${error}`, 'error');
      await sendSSE(writer, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      await writer.close();
    }
  })();

  // Return SSE stream immediately
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
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

  // Handle warmup pings (no processing, just keep instance alive)
  if (req.headers.get('X-Warmup') === 'true') {
    log('Received warmup ping - keeping function warm', 'info');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Function warmed up',
        timestamp: new Date().toISOString(),
        cacheStatus: toolCache ? `cached (${toolCache.tools.length} tools)` : 'empty'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body: AgentRequest = await req.json();
    const { message, userId, calendarId, focusedTradeId, conversationHistory = [], calendarContext, userApiKey } = body;

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: message, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use user's API key if provided, otherwise fall back to server key
    const googleApiKey = userApiKey || Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No API key available. Please configure your Gemini API key in settings.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log(`Processing request for user ${userId} (using ${userApiKey ? 'user' : 'server'} API key)`, 'info');

    log(`Processing request for user ${userId}`, 'info');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const supabaseAccessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');

    if (!projectRef || !supabaseAccessToken) {
      throw new Error('Supabase configuration missing');
    }

    // Get MCP tools (with caching)
    log(`Getting MCP tools for project ${projectRef}`, 'info');
    const geminiMcpTools = await getCachedMCPTools(projectRef, supabaseAccessToken);
    log(`Using ${geminiMcpTools.length} MCP tools`, 'info');

    // Combine all tools (MCP + Custom)
    const customTools = getAllCustomTools();
    const allTools = [...geminiMcpTools, ...customTools];

    // Build system prompt
    const systemPrompt = buildSecureSystemPrompt(userId, calendarId, calendarContext, focusedTradeId);

    log('Sending request to Gemini with tools', 'info');

    // Check if client wants streaming (query param is most reliable)
    const url = new URL(req.url);
    const streamParam = url.searchParams.get('stream');
    const acceptHeader = req.headers.get('Accept') || '';
    const streamHeader = req.headers.get('X-Stream') || '';
    const wantsStreaming = streamParam === 'true' || acceptHeader.includes('text/event-stream') || streamHeader === 'true';

    // Route to streaming or non-streaming path
    if (wantsStreaming) {
      log('Using streaming mode', 'info');
      return handleStreamingRequest(
        googleApiKey,
        systemPrompt,
        message,
        conversationHistory,
        allTools,
        userId,
        calendarId,
        projectRef,
        supabaseAccessToken,
        supabaseUrl
      );
    }

    // Non-streaming path (existing implementation)
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
      const customToolNames = ['search_web', 'scrape_url', 'get_crypto_price', 'get_forex_price', 'generate_chart', 'create_note', 'update_note', 'delete_note', 'search_notes', 'analyze_image'];
      const supabaseClient = createServiceClient();
      if (customToolNames.includes(call.name)) {
        // Execute custom tool
        functionResult = await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId
                }, supabaseClient);
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

      // Append function response to conversation history (handles image injection)
      const responseParts = await buildFunctionResponseParts(call.name, functionResult);
      conversationContents.push({
        role: 'user',
        parts: responseParts
      });

      // Call Gemini again with updated conversation history
      // CONSERVATIVE: const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;
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

    const embeddedData: EmbeddedData = await fetchEmbeddedData(
      finalText || '',
      supabaseUrl,
      serviceKey,
      userId
    );

    // Convert Maps to objects for JSON serialization
    const embeddedTrades = Object.fromEntries(embeddedData.trades);
    const embeddedEvents = Object.fromEntries(embeddedData.events);
    const embeddedNotes = Object.fromEntries(embeddedData.notes);

    log(`Fetched ${embeddedData.trades.size} embedded trades, ${embeddedData.events.size} embedded events, and ${embeddedData.notes.size} embedded notes`, 'info');

    const formattedResponse = {
      success: !!finalText,
      message: finalText || '',
      messageHtml,
      citations,
      embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
      embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
      embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined,
      metadata: {
        functionCalls,
        model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
      'gemini-2.5-flash'
    );

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
