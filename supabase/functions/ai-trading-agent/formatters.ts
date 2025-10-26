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
 * Format error response
 */
export function formatErrorResponse(error: Error, model: string): AgentResponse {
  return {
    success: false,
    message: 'I encountered an error processing your request. Please try again.',
    metadata: {
      functionCalls: [],
      model,
      timestamp: new Date().toISOString(),
    },
    error: error.message,
  };
}

/**
 * Validate and clean trade data
 */
export function cleanTradeData(trade: any): Trade | null {
  try {
    // Ensure required fields exist
    if (!trade.id || !trade.calendar_id || !trade.user_id || !trade.trade_date) {
      return null;
    }

    return {
      id: trade.id,
      calendar_id: trade.calendar_id,
      user_id: trade.user_id,
      name: trade.name,
      amount: parseFloat(trade.amount) || 0,
      trade_type: trade.trade_type,
      trade_date: trade.trade_date,
      entry_price: trade.entry_price ? parseFloat(trade.entry_price) : undefined,
      exit_price: trade.exit_price ? parseFloat(trade.exit_price) : undefined,
      stop_loss: trade.stop_loss ? parseFloat(trade.stop_loss) : undefined,
      take_profit: trade.take_profit ? parseFloat(trade.take_profit) : undefined,
      risk_to_reward: trade.risk_to_reward ? parseFloat(trade.risk_to_reward) : undefined,
      partials_taken: trade.partials_taken,
      session: trade.session,
      notes: trade.notes,
      tags: Array.isArray(trade.tags) ? trade.tags : [],
      is_temporary: trade.is_temporary,
      is_pinned: trade.is_pinned,
      images: Array.isArray(trade.images) ? trade.images : [],
      economic_events: Array.isArray(trade.economic_events) ? trade.economic_events : [],
      share_link: trade.share_link,
      is_shared: trade.is_shared,
      shared_at: trade.shared_at,
      share_id: trade.share_id,
      created_at: trade.created_at,
      updated_at: trade.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Format trade statistics for display
 */
export function formatStatisticsMessage(stats: any): string {
  const lines = [
    `📊 **Trading Performance Statistics**\n`,
    `**Overview:**`,
    `• Total Trades: ${stats.totalTrades}`,
    `• Wins: ${stats.winCount} | Losses: ${stats.lossCount} | Breakeven: ${stats.breakevenCount}`,
    `• Win Rate: ${stats.winRate}%`,
    `• Profit Factor: ${stats.profitFactor}`,
    `\n**Performance Metrics:**`,
    `• Total P&L: $${stats.totalPnL}`,
    `• Average Win: $${stats.avgWin}`,
    `• Average Loss: $${stats.avgLoss}`,
    `• Largest Win: $${stats.largestWin}`,
    `• Largest Loss: $${stats.largestLoss}`,
    `• Max Drawdown: $${stats.maxDrawdown}`,
    `\n**Streaks:**`,
    `• Max Consecutive Wins: ${stats.consecutiveWins}`,
    `• Max Consecutive Losses: ${stats.consecutiveLosses}`,
  ];

  // Add session breakdown if available
  if (stats.sessionStats && Object.keys(stats.sessionStats).length > 0) {
    lines.push(`\n**Session Performance:**`);
    Object.entries(stats.sessionStats).forEach(([session, data]: [string, any]) => {
      lines.push(`• ${session}: ${data.trades} trades, ${data.winRate.toFixed(1)}% win rate, $${data.pnl.toFixed(2)} P&L`);
    });
  }

  // Add tag breakdown if available
  if (stats.tagStats && Object.keys(stats.tagStats).length > 0) {
    lines.push(`\n**Tag Performance (Top 5):**`);
    const topTags = Object.entries(stats.tagStats)
      .sort(([, a]: [string, any], [, b]: [string, any]) => b.pnl - a.pnl)
      .slice(0, 5);

    topTags.forEach(([tag, data]: [string, any]) => {
      lines.push(`• ${tag}: ${data.trades} trades, ${data.winRate.toFixed(1)}% win rate, $${data.pnl.toFixed(2)} P&L`);
    });
  }

  return lines.join('\n');
}

/**
 * Format economic events for display
 */
export function formatEconomicEventsMessage(events: EconomicEvent[]): string {
  if (events.length === 0) {
    return 'No economic events found for the specified criteria.';
  }

  const lines = [`📅 **Economic Calendar Events** (${events.length} events)\n`];

  // Group by impact
  const highImpact = events.filter((e) => e.impact === 'High');
  const mediumImpact = events.filter((e) => e.impact === 'Medium');
  const lowImpact = events.filter((e) => e.impact === 'Low');

  if (highImpact.length > 0) {
    lines.push(`🔴 **High Impact (${highImpact.length}):**`);
    highImpact.slice(0, 5).forEach((event) => {
      lines.push(`• ${event.currency} - ${event.event} (${new Date(event.timeUtc).toLocaleString()})`);
    });
    if (highImpact.length > 5) {
      lines.push(`  ... and ${highImpact.length - 5} more high impact events`);
    }
  }

  if (mediumImpact.length > 0) {
    lines.push(`\n🟡 **Medium Impact (${mediumImpact.length}):**`);
    mediumImpact.slice(0, 3).forEach((event) => {
      lines.push(`• ${event.currency} - ${event.event} (${new Date(event.timeUtc).toLocaleString()})`);
    });
    if (mediumImpact.length > 3) {
      lines.push(`  ... and ${mediumImpact.length - 3} more medium impact events`);
    }
  }

  if (lowImpact.length > 0) {
    lines.push(`\n🟢 **Low Impact:** ${lowImpact.length} events`);
  }

  return lines.join('\n');
}

/**
 * Format correlation analysis for display
 */
export function formatCorrelationMessage(correlations: Array<{ event: EconomicEvent; trades: Trade[] }>): string {
  if (correlations.length === 0) {
    return 'No correlations found between economic events and trades.';
  }

  const lines = [`📊 **Event-Trade Correlation Analysis**\n`, `Found ${correlations.length} events with related trades:\n`];

  correlations.slice(0, 10).forEach((correlation, index) => {
    const { event, trades } = correlation;
    const wins = trades.filter((t) => t.trade_type === 'win').length;
    const losses = trades.filter((t) => t.trade_type === 'loss').length;
    const totalPnL = trades.reduce((sum, t) => sum + t.amount, 0);

    lines.push(
      `${index + 1}. **${event.currency} - ${event.event}**`,
      `   Time: ${new Date(event.timeUtc).toLocaleString()}`,
      `   Impact: ${event.impact}`,
      `   Related Trades: ${trades.length} (${wins}W/${losses}L)`,
      `   P&L: $${totalPnL.toFixed(2)}\n`
    );
  });

  if (correlations.length > 10) {
    lines.push(`... and ${correlations.length - 10} more correlations`);
  }

  return lines.join('\n');
}

/**
 * Extract URLs from tool results
 */
function extractUrlsFromToolResult(result: any): string[] {
  const urls: string[] = [];

  if (!result) return urls;

  // Handle string results (from search_web, scrape_url)
  if (typeof result === 'string') {
    const urlRegex = /(https?:\/\/[^\s\n]+)/g;
    const matches = result.match(urlRegex);
    if (matches) {
      urls.push(...matches);
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

  let html = text;

  // Escape HTML special characters first
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
  const messageHtml = convertMarkdownToHtml(message, citations);

  return {
    messageHtml,
    citations,
  };
}
