/**
 * Shared Supabase-MCP client.
 *
 * Extracted from `ai-trading-agent/index.ts` so both the interactive chat agent
 * and batch rollup tasks (`run-orion-task/*`) talk to the same MCP gateway with
 * the same session + tool caches. Module-level caches survive across requests
 * within a warm function instance, so reusing this module across functions
 * means each function has its own cache — that's fine (warm-up is fast).
 *
 * Scope: session management, tool listing, tool execution. Callers assemble
 * the final Gemini tool set by combining these with custom tools elsewhere.
 */

import { log } from './supabase.ts';
import type { GeminiFunctionDeclaration } from './gemini.ts';

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

interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: { properties?: unknown; required?: string[] };
}

/**
 * Recursively strip JSON Schema properties that Gemini function declarations
 * don't support (e.g. `$schema`, `additionalProperties`, `format`). Keeps only
 * the subset Gemini accepts; anything else causes a 400 on tool registration.
 */
function cleanSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  const obj = schema as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  const supportedKeys = ['type', 'description', 'enum', 'properties', 'items', 'required'];
  for (const key of supportedKeys) {
    if (!(key in obj)) continue;
    if (key === 'properties' && typeof obj[key] === 'object') {
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
  return cleaned;
}

function convertMcpToolsToGeminiFormat(
  mcpTools: McpToolDescriptor[]
): GeminiFunctionDeclaration[] {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    parameters: cleanSchema({
      type: 'object',
      properties: tool.inputSchema?.properties || {},
      required: tool.inputSchema?.required,
    }) as { type: string; properties: Record<string, unknown>; required?: string[] },
  }));
}

function buildMcpUrl(projectRef: string): string {
  return `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;
}

/**
 * Initialize or reuse an MCP session. Sessions expire server-side (~10 min
 * window matches cache TTL). Callers pass the session id in `Mcp-Session-Id`
 * header for subsequent tool calls.
 */
export async function initializeMCPSession(
  projectRef: string,
  accessToken: string
): Promise<string | null> {
  const now = Date.now();

  if (mcpSession && (now - mcpSession.timestamp) < MCP_SESSION_TTL) {
    log(`Using cached MCP session (age: ${Math.round((now - mcpSession.timestamp) / 1000)}s)`, 'info');
    return mcpSession.sessionId;
  }

  try {
    const response = await fetch(buildMcpUrl(projectRef), {
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
          clientInfo: { name: 'orion-agent', version: '1.0.0' },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`MCP initialize failed: ${response.status} - ${errorText}`, 'error');
      return null;
    }

    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) {
      mcpSession = { sessionId, timestamp: now };
      log(`MCP session initialized: ${sessionId.substring(0, 20)}...`, 'info');
      return sessionId;
    }

    // Some deployments put session id in the body instead of headers.
    const data = await response.json();
    log(`MCP initialize response: ${JSON.stringify(data).substring(0, 200)}`, 'info');
    return null;
  } catch (error) {
    log(`MCP initialize error: ${error}`, 'error');
    return null;
  }
}

async function listMCPTools(
  projectRef: string,
  accessToken: string
): Promise<McpToolDescriptor[]> {
  try {
    const sessionId = await initializeMCPSession(projectRef, accessToken);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const response = await fetch(buildMcpUrl(projectRef), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`MCP list_tools failed: ${response.status} - ${errorText}`, 'error');
      return [];
    }

    const data = await response.json();
    return data.result?.tools || [];
  } catch (error) {
    log(`MCP list_tools error: ${error}`, 'error');
    return [];
  }
}

/**
 * Returns Gemini-formatted MCP tools, cached for 5 min. Pass `allowed` to
 * filter the list — callers almost always want a subset (e.g. just
 * execute_sql and list_tables) to keep the Gemini tool registry lean.
 */
export async function getCachedMCPTools(
  projectRef: string,
  accessToken: string,
  allowed?: string[]
): Promise<GeminiFunctionDeclaration[]> {
  const now = Date.now();

  if (toolCache && (now - toolCache.timestamp) < TOOL_CACHE_TTL) {
    log(`Using cached MCP tools (${toolCache.tools.length} tools, age: ${Math.round((now - toolCache.timestamp) / 1000)}s)`, 'info');
    return filterTools(toolCache.tools, allowed);
  }

  log('Fetching fresh MCP tools (cache miss or expired)', 'info');
  const mcpTools = await listMCPTools(projectRef, accessToken);
  const geminiTools = convertMcpToolsToGeminiFormat(mcpTools);

  toolCache = { tools: geminiTools, timestamp: now };
  log(`Cached ${geminiTools.length} MCP tools`, 'info');
  return filterTools(geminiTools, allowed);
}

function filterTools(
  tools: GeminiFunctionDeclaration[],
  allowed?: string[]
): GeminiFunctionDeclaration[] {
  if (!allowed || allowed.length === 0) return tools;
  return tools.filter((t) => allowed.includes(t.name));
}

/**
 * Execute a single MCP tool. Re-initializes the session ONCE if the server
 * reports it expired (can happen after idle periods longer than our TTL).
 *
 * Error contract for callers:
 * - On success:  returns the tool result text (real data).
 * - On failure:  returns a string that STARTS WITH "Error: " so the Gemini
 *   function-calling loop can distinguish a tool failure from a data result
 *   and inform the user gracefully rather than narrating fabricated data.
 *   Raw internal detail (Postgres errors, table names, query text) is logged
 *   server-side but NOT forwarded to the model.
 *
 * `_sessionRetried` is a private guard that prevents the expired-session
 * branch from recursing more than once — a persistent 400 that happens to
 * contain "Mcp-Session-Id" in its body would otherwise loop until overflow.
 */
export async function callMCPTool(
  projectRef: string,
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
  _sessionRetried = false
): Promise<string> {
  try {
    const sessionId = await initializeMCPSession(projectRef, accessToken);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const response = await fetch(buildMcpUrl(projectRef), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Expired session — clear cache and retry exactly once.
      // The `_sessionRetried` guard prevents infinite recursion when the
      // 400 body happens to contain "Mcp-Session-Id" for any other reason.
      if (!_sessionRetried && response.status === 400 && errorText.includes('Mcp-Session-Id')) {
        log('MCP session expired, clearing cache and retrying once...', 'info');
        mcpSession = null;
        return callMCPTool(projectRef, accessToken, toolName, args, true);
      }
      // Log the raw detail server-side; return a model-facing error that
      // starts with "Error: " so the loop can distinguish failure from data.
      log(`MCP tool call failed (${response.status}) for ${toolName}: ${errorText.substring(0, 300)}`, 'error');
      const isTransient = response.status >= 500 || response.status === 429;
      return isTransient
        ? `Error: The database tool is temporarily unavailable (${response.status}). Please let the user know and suggest they try again in a moment.`
        : `Error: The database query could not be completed. Please let the user know and suggest they rephrase the request.`;
    }

    const data = await response.json();
    if (data.error) {
      // JSON-RPC application error — log detail, return generic message.
      log(`MCP JSON-RPC error for ${toolName}: ${JSON.stringify(data.error).substring(0, 300)}`, 'error');
      return `Error: The database query returned an error. Please let the user know the query could not be completed, and suggest they try a simpler or differently worded request.`;
    }

    const content = data.result?.content;
    if (Array.isArray(content) && content.length > 0 && content[0].text) {
      return content[0].text;
    }
    return JSON.stringify(data.result || data);
  } catch (error) {
    log(`MCP tool exception for ${toolName}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return `Error: The database tool encountered a network issue. Please let the user know and suggest they try again.`;
  }
}

/**
 * Resolve the Supabase project ref from SUPABASE_URL + the MCP access token
 * from env. Throws when either is missing so callers fail fast with a clear
 * message instead of hitting opaque 401s later.
 */
export function getMcpConfig(): { projectRef: string; accessToken: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const accessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');
  if (!projectRef || !accessToken) {
    throw new Error('Supabase MCP config missing (SUPABASE_URL or AGENT_SUPABASE_ACCESS_TOKEN)');
  }
  return { projectRef, accessToken };
}
