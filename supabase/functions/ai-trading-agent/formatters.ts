/**
 * Response formatters for AI agent
 * Parse agent output and structure for frontend consumption
 */

import type { AgentResponse, Trade, Calendar, EconomicEvent, ToolCall, Citation } from './types.ts';

/**
 * Database row from MCP SQL query
 */
interface DatabaseRow {
  // Common fields
  id?: string;
  user_id?: string;
  created_at?: string | Date;
  updated_at?: string | Date;

  // Trade-specific fields
  trade_type?: string;
  trade_date?: string | Date;
  calendar_id?: string;
  amount?: number;

  // Calendar-specific fields
  account_balance?: number;
  max_daily_drawdown?: number;
  name?: string;

  // Economic event fields
  currency?: string;
  impact?: string;
  time_utc?: string;
  event?: string;

  // Allow any other fields from database
  [key: string]: unknown;
}

/**
 * Extract data from database rows (MCP SQL results)
 * Intelligently determines if rows are trades, calendars, or events based on fields
 */
function extractDataFromRows(
  rows: DatabaseRow[],
  trades: Trade[],
  calendars: Calendar[],
  economicEvents: EconomicEvent[]
): void {
  if (!rows || rows.length === 0) return;

  rows.forEach((row: DatabaseRow) => {
    // Determine row type by checking distinctive fields
    if (row.trade_type && row.trade_date) {
      // This is a trade
      trades.push(row as unknown as Trade);
    } else if (row.account_balance !== undefined && row.max_daily_drawdown !== undefined) {
      // This is a calendar
      calendars.push(row as unknown as Calendar);
    } else if (row.currency && row.impact && row.time_utc) {
      // This is an economic event
      economicEvents.push(row as unknown as EconomicEvent);
    }
    // If none match, skip (might be aggregated stats, etc.)
  });
}

/**
 * Parse agent response and extract structured data
 */
export function formatAgentResponse(
  response: any,
  model: string
): AgentResponse {
  try {
    const finalOutput = response.finalOutput || '';
    const toolCalls: ToolCall[] = [];

    // Extract trades, calendars, and economic events from tool results
    const trades: Trade[] = [];
    const calendars: Calendar[] = [];
    const economicEvents: EconomicEvent[] = [];

    // Process tool calls if available
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      response.toolCalls.forEach((toolCall: any) => {
        const call: ToolCall = {
          name: toolCall.name,
          args: toolCall.args || {},
          result: toolCall.result,
        };

        toolCalls.push(call);

        // Handle MCP SQL query results (from Supabase MCP)
        // MCP returns: { rows: [...], rowCount: N }
        if (toolCall.result && Array.isArray(toolCall.result)) {
          // Some MCP responses may be direct arrays
          const rows = toolCall.result;
          extractDataFromRows(rows, trades, calendars, economicEvents);
        } else if (toolCall.result?.rows && Array.isArray(toolCall.result.rows)) {
          // Standard MCP format: { rows: [...], rowCount: N }
          const rows = toolCall.result.rows;
          extractDataFromRows(rows, trades, calendars, economicEvents);
        } else if (toolCall.result?.data) {
          // Legacy format support (from specific tools, not MCP)
          const data = toolCall.result.data;

          // Extract trades
          if (data.trades && Array.isArray(data.trades)) {
            trades.push(...data.trades);
          }

          // Extract calendar
          if (data.calendar) {
            calendars.push(data.calendar);
          }

          // Extract economic events
          if (data.events && Array.isArray(data.events)) {
            economicEvents.push(...data.events);
          }
        }
      });
    }

    // Deduplicate trades by ID
    const uniqueTrades = Array.from(
      new Map(trades.map((trade) => [trade.id, trade])).values()
    );

    // Deduplicate calendars by ID
    const uniqueCalendars = Array.from(
      new Map(calendars.map((calendar) => [calendar.id, calendar])).values()
    );

    // Deduplicate events by ID
    const uniqueEvents = Array.from(
      new Map(economicEvents.map((event) => [event.id, event])).values()
    );

    return {
      success: true,
      message: finalOutput,
      trades: uniqueTrades.length > 0 ? uniqueTrades : undefined,
      calendars: uniqueCalendars.length > 0 ? uniqueCalendars : undefined,
      economicEvents: uniqueEvents.length > 0 ? uniqueEvents : undefined,
      metadata: {
        functionCalls: toolCalls,
        tokenUsage: response.usage?.totalTokens,
        model,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'I encountered an error processing the response. Please try again.',
      metadata: {
        functionCalls: [],
        model,
        timestamp: new Date().toISOString(),
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Classify a provider error and produce a user-friendly markdown message.
 * Centralises what used to live in the frontend (parseQuotaError) so the
 * client can render error.message verbatim without parsing JSON or matching
 * provider-specific strings.
 */
export function classifyProviderError(rawMessage: string): {
  errorType: 'rate_limit' | 'api_key_invalid' | 'provider_error' | 'network_error';
  userMessage: string;
  retryAfterSeconds?: number;
} {
  const lower = rawMessage.toLowerCase();

  // Pull retry hint if Gemini included one in the error JSON.
  let retryAfterSeconds: number | undefined;
  const retryMatch =
    rawMessage.match(/retry in (\d+\.?\d*)\s*s/i) ||
    rawMessage.match(/retryDelay["\s:]+(\d+)s/i);
  if (retryMatch) {
    const seconds = parseFloat(retryMatch[1]);
    if (!Number.isNaN(seconds)) retryAfterSeconds = Math.ceil(seconds);
  }

  // Inspect parsed JSON if the provider embedded one in the message.
  let errorReason = '';
  let errorCode = '';
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error) {
        errorCode = String(parsed.error.code || '');
        errorReason = parsed.error.details?.[0]?.reason || '';
      }
    }
  } catch {
    // ignore — fall back to substring matches below
  }

  const isApiKeyError =
    lower.includes('api key expired') ||
    lower.includes('api key invalid') ||
    lower.includes('api_key_invalid') ||
    errorReason === 'API_KEY_INVALID';

  const isQuotaError =
    lower.includes('quota') ||
    lower.includes(' 429') ||
    lower.includes(':429') ||
    lower.includes('error: 429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit');

  if (isApiKeyError) {
    return {
      errorType: 'api_key_invalid',
      userMessage:
        'The AI service encountered an authentication error. Please try again later or contact support.',
    };
  }

  if (isQuotaError) {
    let msg = 'The AI service has reached its usage limit.\n\n';
    msg += '**What you can do:**\n';
    msg += '- Wait for the quota to reset (usually within a few minutes)';
    if (retryAfterSeconds) {
      msg += `\n\n*You can retry in ${retryAfterSeconds} seconds.*`;
    }
    return { errorType: 'rate_limit', userMessage: msg, retryAfterSeconds };
  }

  // 5xx / timeout / fetch failures from the provider — distinguishable from
  // local network only by message content. Treat ambiguous as provider_error.
  if (
    errorCode.startsWith('5') ||
    lower.includes('fetch failed') ||
    lower.includes('timeout') ||
    lower.includes('econnreset')
  ) {
    return {
      errorType: 'provider_error',
      userMessage:
        'The AI service is temporarily unavailable. Please try again in a moment.',
    };
  }

  return {
    errorType: 'network_error',
    userMessage:
      'Sorry, I encountered an error processing your message. Please try again.',
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(error: Error, model: string): AgentResponse {
  const classified = classifyProviderError(error.message);
  return {
    success: false,
    message: classified.userMessage,
    metadata: {
      functionCalls: [],
      model,
      timestamp: new Date().toISOString(),
    },
    error: error.message,
    errorType: classified.errorType,
  };
}

 
 

/**
 * Extract URLs from tool results
 * Excludes QuickChart URLs since they're embedded as images
 */
function extractUrlsFromToolResult(result: any): string[] {
  const urls: string[] = [];

  if (!result) return urls;

  // Handle string results (from search_web, scrape_url)
  if (typeof result === 'string') {
    const urlRegex = /(https?:\/\/[^\s\n]+)/g;
    const matches = result.match(urlRegex);
    if (matches) {
      // Filter out URLs that should be embedded as images, not citations
      const filteredUrls = matches.filter(url =>
        !url.includes('quickchart.io') && // Chart images
        !url.includes('firebasestorage.googleapis.com') && // Firebase storage images
        !url.includes('.supabase.co/storage') && // Supabase storage images
        !url.includes('unsplash.com') && // Stock images
        !url.includes('pexels.com') && // Stock images
        !url.includes('pixabay.com') // Stock images
      );
      urls.push(...filteredUrls);
    }
  }

  // Handle object results
  if (typeof result === 'object') {
    // Search results format
    if (result.organic && Array.isArray(result.organic)) {
      result.organic.forEach((item: any) => {
        if (item.link) urls.push(item.link);
      });
    }

    // News results format
    if (result.news && Array.isArray(result.news)) {
      result.news.forEach((item: any) => {
        if (item.link) urls.push(item.link);
      });
    }

    // Direct link field
    if (result.link) urls.push(result.link);
    if (result.url) urls.push(result.url);
  }

  // Remove duplicates
  return [...new Set(urls)];
}

/**
 * Extract citations from tool calls
 */
export function extractCitations(toolCalls: ToolCall[]): Citation[] {
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();

  toolCalls.forEach((toolCall, index) => {
    const urls = extractUrlsFromToolResult(toolCall.result);

    urls.forEach((url) => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);

        // Extract title from URL or use tool name
        let title = '';
        try {
          const urlObj = new URL(url);
          title = urlObj.hostname.replace('www.', '');
        } catch {
          title = url.substring(0, 50);
        }

        citations.push({
          id: `citation-${citations.length + 1}`,
          title,
          url,
          source: toolCall.name,
          toolName: toolCall.name,
        });
      }
    });
  });

  return citations;
}

/**
 * Convert markdown-style text to HTML with citation links
 */
export function convertMarkdownToHtml(
  text: string,
  citations: Citation[]
): string {
  if (!text) return '';

  // Extract chart image markers BEFORE any processing
  const chartImageRegex = /\[CHART_IMAGE:(.+?)\]/g;
  const chartImages: Array<{ marker: string; url: string }> = [];
  let match;
  while ((match = chartImageRegex.exec(text)) !== null) {
    chartImages.push({
      marker: match[0],
      url: match[1]
    });
  }

  // Replace chart markers with placeholder that won't be escaped
  let html = text;
  chartImages.forEach(({ marker }, index) => {
    html = html.replace(marker, `___CHART_PLACEHOLDER_${index}___`);
  });

  // Extract Firebase/Supabase storage image URLs and convert to markdown images
  // Patterns to match:
  // - https://firebasestorage.googleapis.com/...
  // - https://*.supabase.co/storage/v1/object/public/...
  // - Plain URLs ending in image extensions
  const imageUrlPattern = /(https?:\/\/(?:firebasestorage\.googleapis\.com|[^/]+\.supabase\.co\/storage)\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s)]*)?)/gi;
  const storageImages: Array<{ marker: string; url: string }> = [];
  let imageMatch;

  while ((imageMatch = imageUrlPattern.exec(html)) !== null) {
    const url = imageMatch[0];
    // Only process if it's not already part of a markdown image
    const beforeUrl = html.substring(Math.max(0, imageMatch.index - 2), imageMatch.index);
    if (!beforeUrl.includes('![') && !beforeUrl.includes('](')) {
      storageImages.push({
        marker: url,
        url: url
      });
    }
  }

  // Replace storage image URLs with placeholders
  storageImages.forEach(({ marker }, index) => {
    html = html.replace(marker, `___STORAGE_IMAGE_PLACEHOLDER_${index}___`);
  });

  // Extract and protect markdown images BEFORE escaping
  const markdownImages: Array<{ marker: string; original: string; imgTag: string }> = [];

  // Match markdown images ![alt](url)
  const mdImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let mdImageMatch;

  while ((mdImageMatch = mdImagePattern.exec(html)) !== null) {
    const alt = mdImageMatch[1];
    const url = mdImageMatch[2];
    const original = mdImageMatch[0];
    const isStorageUrl = url.includes('firebasestorage.googleapis.com') || url.includes('.supabase.co/storage');

    const imgTag = isStorageUrl
      ? `<img src="${url}" alt="${alt || 'Trade Image'}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block; cursor: pointer;" />`
      : `<img src="${url}" alt="${alt || 'Image'}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block;" />`;

    markdownImages.push({
      marker: `___MARKDOWN_IMAGE_${markdownImages.length}___`,
      original: original,
      imgTag: imgTag
    });
  }

  // Replace markdown images with placeholders
  markdownImages.forEach(({ marker, original }) => {
    html = html.replace(original, marker);
  });

  // Extract and protect inline references BEFORE escaping
  const inlineRefs: Array<{ marker: string; original: string }> = [];

  // Pattern 1: HTML tags (trade-ref, event-ref, note-ref, tag-chip)
  const tradeTagPattern = /<trade-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/trade-ref>)?/g;
  const eventTagPattern = /<event-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/event-ref>)?/g;
  const noteTagPattern = /<note-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/note-ref>)?/g;
  const tagChipPattern = /<tag-chip>([^<]*)<\/tag-chip>/g;

  let refMatch;

  // Extract trade-ref tags
  while ((refMatch = tradeTagPattern.exec(html)) !== null) {
    inlineRefs.push({
      marker: `___INLINE_REF_${inlineRefs.length}___`,
      original: refMatch[0]
    });
  }

  // Extract event-ref tags
  while ((refMatch = eventTagPattern.exec(html)) !== null) {
    inlineRefs.push({
      marker: `___INLINE_REF_${inlineRefs.length}___`,
      original: refMatch[0]
    });
  }

  // Extract note-ref tags
  while ((refMatch = noteTagPattern.exec(html)) !== null) {
    inlineRefs.push({
      marker: `___INLINE_REF_${inlineRefs.length}___`,
      original: refMatch[0]
    });
  }

  // Extract tag-chip tags
  while ((refMatch = tagChipPattern.exec(html)) !== null) {
    inlineRefs.push({
      marker: `___INLINE_REF_${inlineRefs.length}___`,
      original: refMatch[0]
    });
  }

  // Replace inline refs with placeholders
  inlineRefs.forEach(({ marker, original }) => {
    html = html.replace(original, marker);
  });

  // Extract GFM markdown tables BEFORE escaping/line-break processing.
  // Pattern: header row | sep row (---) | one or more body rows, all delimited
  // by `|`. Without this step the pipes survive into the final HTML and the
  // table renders as a wall of literal `|` characters.
  const markdownTables: Array<{ marker: string; htmlTable: string }> = [];
  const tableBlockPattern =
    /(?:^[ \t]*\|[^\n]+\|[ \t]*\n)(?:^[ \t]*\|[ \t\-:|]+\|[ \t]*\n)(?:^[ \t]*\|[^\n]+\|[ \t]*\n?)+/gm;

  const parseTableRow = (line: string): string[] => {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  };

  const renderCellText = (raw: string): string => {
    let c = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    c = c.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    c = c.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return c;
  };

  html = html.replace(tableBlockPattern, (block) => {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length < 2) return block;
    const sepLine = lines[1].trim();
    if (!/^\|[\s\-:|]+\|$/.test(sepLine)) return block;

    const headerCells = parseTableRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseTableRow);

    const headerHtml =
      `<thead><tr>${headerCells
        .map((c) => `<th>${renderCellText(c)}</th>`)
        .join('')}</tr></thead>`;
    const bodyHtml = `<tbody>${bodyRows
      .map(
        (row) =>
          `<tr>${row.map((c) => `<td>${renderCellText(c)}</td>`).join('')}</tr>`
      )
      .join('')}</tbody>`;
    const tableHtml = `<table>${headerHtml}${bodyHtml}</table>`;

    const marker = `___MARKDOWN_TABLE_${markdownTables.length}___`;
    markdownTables.push({ marker, htmlTable: tableHtml });
    // Surround with blank lines so the marker becomes its own paragraph after
    // the \n\n → </p><p> conversion below — keeps the <table> from getting
    // wrapped inside a sentence-level <p>.
    return `\n\n${marker}\n\n`;
  });

  // Escape HTML special characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert markdown bold **text** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert markdown italic *text* to <em>
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert markdown headers # text to <h2>
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert markdown lists - item to <li>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, ''); // Remove duplicate ul tags

  // Convert line breaks to <br>
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph tags
  if (!html.startsWith('<h') && !html.startsWith('<ul')) {
    html = `<p>${html}</p>`;
  }

  // Restore markdown tables. Done BEFORE the ref/image restorations so any
  // ref/image placeholders that lived inside cells are still findable in the
  // final HTML when those passes run below.
  markdownTables.forEach(({ marker, htmlTable }) => {
    html = html.replace(marker, htmlTable);
  });
  // The marker was wrapped in `\n\n…\n\n` which became `</p><p>…</p><p>`,
  // leaving the <table> wrapped in a stray <p>. Strip those wrappers — a
  // <table> is block-level and shouldn't be inside a paragraph.
  html = html.replace(
    /<p>\s*(<table>[\s\S]*?<\/table>)\s*<\/p>/g,
    '$1'
  );

  // Replace chart placeholders with actual <img> tags
  chartImages.forEach(({ url }, index) => {
    const placeholder = `___CHART_PLACEHOLDER_${index}___`;
    const imgTag = `<img src="${url}" alt="Chart" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block;" />`;
    html = html.replace(placeholder, imgTag);
  });

  // Replace storage image placeholders with actual <img> tags
  storageImages.forEach(({ url }, index) => {
    const placeholder = `___STORAGE_IMAGE_PLACEHOLDER_${index}___`;
    const imgTag = `<img src="${url}" alt="Trade Image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block; cursor: pointer;" />`;
    html = html.replace(placeholder, imgTag);
  });

  // Restore inline references
  inlineRefs.forEach(({ marker, original }) => {
    html = html.replace(marker, original);
  });

  // Restore markdown images as <img> tags
  markdownImages.forEach(({ marker, imgTag }) => {
    html = html.replace(marker, imgTag);
  });

  // Add citation superscript links
  citations.forEach((citation, index) => {
    const citationNum = index + 1;
    const citationLink = `<sup><a href="${citation.url}" target="_blank" rel="noopener noreferrer" title="${citation.title}">[${citationNum}]</a></sup>`;

    // Add citation link at the end of relevant sentences
    // This is a simple heuristic - add citations near the end of content
    if (index === citations.length - 1) {
      html = html.replace(/<\/p>$/, `${citationLink}</p>`);
    }
  });

  return html;
}

/**
 * Format agent response with HTML and citations
 */
export function formatResponseWithHtmlAndCitations(
  message: string,
  toolCalls: ToolCall[]
): { messageHtml: string; citations: Citation[] } {
  const citations = extractCitations(toolCalls);

  // Remove markdown chart images from AI's message (we'll add charts from tool results)
  // This prevents duplicate charts when AI includes ![alt](url) in its response
  // But keep storage images (Firebase/Supabase) as they should be displayed
  let cleanedMessage = message.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]*quickchart\.io[^)]*)\)/g, '');

  // Remove "Open chart in new tab" links that appear after chart images
  cleanedMessage = cleanedMessage.replace(/\[Open chart in new tab\]\([^)]+\)/gi, '');

  // Remove standalone chart URLs that appear after [CHART_IMAGE:...] markers
  cleanedMessage = cleanedMessage.replace(/\[CHART_IMAGE:[^\]]+\]\s*\n?\s*https?:\/\/[^\s]+/g, (match) => {
    // Keep only the [CHART_IMAGE:...] part, remove the URL
    return match.match(/\[CHART_IMAGE:[^\]]+\]/)?.[0] || '';
  });

  // Remove JSON array at the end (display items)
  cleanedMessage = cleanedMessage.replace(/\[\s*\{[^}]*"type"\s*:\s*"(trade|event)"[^}]*"id"\s*:\s*"[^"]*"[^}]*\}[^\]]*\]/g, '');

  // Clean up extra whitespace
  cleanedMessage = cleanedMessage.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  // Check if the AI's message already contains chart markers [CHART_IMAGE:...]
  // If it does, don't append chart results again to avoid duplicates
  const hasChartMarkersInMessage = /\[CHART_IMAGE:(.+?)\]/.test(cleanedMessage);

  // Extract chart images from tool results (generate_chart tool)
  const chartToolCalls = toolCalls.filter(tc => tc.name === 'generate_chart');

  if (chartToolCalls.length > 0 && !hasChartMarkersInMessage) {
    // Only append chart results if the AI hasn't already included them
    const chartResults = chartToolCalls
      .map(tc => tc.result)
      .filter(result => result && typeof result === 'string')
      .join('\n\n');

    if (chartResults) {
      cleanedMessage = `${cleanedMessage}\n\n${chartResults}`;
    }
  }

  let messageHtml = convertMarkdownToHtml(cleanedMessage, citations);

  // Remove "Open chart in new tab" links from HTML (after conversion)
  // These appear as <a> tags after chart images and are redundant since images are clickable
  messageHtml = messageHtml.replace(/<p>\s*<a\s+href="[^"]*quickchart\.io[^"]*"[^>]*>Open chart in new tab<\/a>\s*<\/p>/gi, '');
  messageHtml = messageHtml.replace(/<a\s+href="[^"]*quickchart\.io[^"]*"[^>]*>Open chart in new tab<\/a>/gi, '');

  return {
    messageHtml,
    citations,
  };
}
