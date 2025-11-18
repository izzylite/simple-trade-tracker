/**
 * AI Trading Agent - Tool Definitions and Implementations
 * All custom tools (non-MCP) are defined and implemented here
 */

import { log } from '../_shared/supabase.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Note } from './types.ts';

/**
 * Gemini function declaration type
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * ============================================================================
 * TOOL DEFINITIONS
 * ============================================================================
 */

/**
 * Web search tool definition
 */
export const searchWebTool: GeminiFunctionDeclaration = {
  name: 'search_web',
  description: 'Search web for market news, analysis, and trading information. After getting search results, you can use scrape_url to extract more detailed content from specific URLs.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      type: {
        type: 'string',
        description: 'Type: "search" or "news"',
        enum: ['search', 'news']
      }
    },
    required: ['query']
  }
};

/**
 * URL scraping tool definition
 */
export const scrapeUrlTool: GeminiFunctionDeclaration = {
  name: 'scrape_url',
  description: 'Scrape and extract content from a URL to get more detailed information. Use this after search_web to get full article content. You can also use this to extract and analyze sentiment from news articles.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to scrape and extract content from'
      }
    },
    required: ['url']
  }
};

/**
 * Crypto price tool definition
 */
export const getCryptoPriceTool: GeminiFunctionDeclaration = {
  name: 'get_crypto_price',
  description: 'Get real-time cryptocurrency price, 24h change, volume, and market cap. Use this to understand current market conditions when analyzing trades.',
  parameters: {
    type: 'object',
    properties: {
      coin_id: {
        type: 'string',
        description: 'Coin ID (lowercase): bitcoin, ethereum, solana, cardano, ripple, dogecoin, etc. Use common names.'
      }
    },
    required: ['coin_id']
  }
};

/**
 * Forex price tool definition
 */
export const getForexPriceTool: GeminiFunctionDeclaration = {
  name: 'get_forex_price',
  description: 'Get real-time foreign exchange (forex) rates for currency pairs like EUR/USD, GBP/USD, etc. Use this for forex trading analysis.',
  parameters: {
    type: 'object',
    properties: {
      base_currency: {
        type: 'string',
        description: 'Base currency code (3-letter): EUR, GBP, USD, JPY, CHF, CAD, AUD, NZD, etc.'
      },
      quote_currency: {
        type: 'string',
        description: 'Quote currency code (3-letter): USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD, etc.'
      }
    },
    required: ['base_currency', 'quote_currency']
  }
};

/**
 * Chart generation tool definition
 */
export const generateChartTool: GeminiFunctionDeclaration = {
  name: 'generate_chart',
  description: 'Generate a chart visualization from data. Returns HTML with an embedded image that displays inline in the chat. Use this after querying trade data via MCP tools to create visual representations like equity curves, P&L over time, or performance metrics.',
  parameters: {
    type: 'object',
    properties: {
      chart_type: {
        type: 'string',
        description: 'Type of chart to generate',
        enum: ['line', 'bar']
      },
      title: {
        type: 'string',
        description: 'Chart title'
      },
      x_label: {
        type: 'string',
        description: 'X-axis label'
      },
      y_label: {
        type: 'string',
        description: 'Y-axis label'
      },
      labels: {
        type: 'array',
        description: 'Array of X-axis labels (e.g., dates, times)',
        items: { type: 'string' }
      },
      datasets: {
        type: 'array',
        description: 'Array of dataset objects with {label: string, data: array of numbers, color: string}',
        items: { type: 'object' }
      }
    },
    required: ['chart_type', 'title', 'labels', 'datasets']
  }
};

/**
 * Create note tool definition
 */
export const createNoteTool: GeminiFunctionDeclaration = {
  name: 'create_note',
  description: 'Create a new note for the user in their trading calendar. Use this to save trading strategies, insights, lessons learned, or game plans. IMPORTANT: Also use this to maintain YOUR OWN AGENT MEMORY by creating a special note titled "Trading Agent Memory - [Calendar Name]" with tag "AGENT_MEMORY" that stores discovered patterns, user preferences, and lessons learned across sessions. This memory note should be created after identifying 3+ significant patterns and updated incrementally. Content should be in plain text format. User ID and Calendar ID are automatically provided from context.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Note title (concise and descriptive)'
      },
      content: {
        type: 'string',
        description: 'Note content in plain text format. Use clear paragraphs and line breaks for readability. Do not use HTML tags.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of tags for categorizing the note. Common tags: "AGENT_MEMORY" (for AI persistent memory), "STRATEGY", "GAME_PLAN", "INSIGHT", "LESSON_LEARNED". REQUIRED: Use "AGENT_MEMORY" tag for memory notes.'
      },
      reminder_type: {
        type: 'string',
        enum: ['none', 'once', 'weekly'],
        description: 'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days)'
      },
      reminder_date: {
        type: 'string',
        description: 'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".'
      },
      reminder_days: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        },
        description: 'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]'
      }
    },
    required: ['title', 'content']
  }
};

/**
 * Update note tool definition
 */
export const updateNoteTool: GeminiFunctionDeclaration = {
  name: 'update_note',
  description: 'Update an existing AI-created note. You can only update notes that you created (by_assistant=true). Use this to refine strategies or update insights. IMPORTANT: Use this to update your "Trading Agent Memory" note incrementally by appending new discoveries (don\'t rewrite the entire memory). You can also add/modify/remove tags and reminders.',
  parameters: {
    type: 'object',
    properties: {
      note_id: {
        type: 'string',
        description: 'ID of the note to update'
      },
      title: {
        type: 'string',
        description: 'New title (optional - only include if changing)'
      },
      content: {
        type: 'string',
        description: 'New content in plain text format (optional - only include if changing). Use clear paragraphs and line breaks for readability. Do not use HTML tags.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated array of tags (optional - only include if changing). Common tags: "AGENT_MEMORY", "STRATEGY", "GAME_PLAN", "INSIGHT", "LESSON_LEARNED".'
      },
      reminder_type: {
        type: 'string',
        enum: ['none', 'once', 'weekly'],
        description: 'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days). Use "none" to remove reminders.'
      },
      reminder_date: {
        type: 'string',
        description: 'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".'
      },
      reminder_days: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        },
        description: 'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]'
      }
    },
    required: ['note_id']
  }
};

/**
 * Delete note tool definition
 */
export const deleteNoteTool: GeminiFunctionDeclaration = {
  name: 'delete_note',
  description: 'Delete an existing AI-created note. You can only delete notes that you created (by_assistant=true). Use this to remove outdated or incorrect notes.',
  parameters: {
    type: 'object',
    properties: {
      note_id: {
        type: 'string',
        description: 'ID of the note to delete'
      }
    },
    required: ['note_id']
  }
};

/**
 * Search notes tool definition
 */
export const searchNotesTool: GeminiFunctionDeclaration = {
  name: 'search_notes',
  description: 'Search and retrieve notes from the user\'s trading calendar. CRITICAL: At the START of EVERY session, search with tags: ["AGENT_MEMORY"] to retrieve your persistent memory about this trader (discovered patterns, preferences, lessons learned). Use this memory to provide personalized analysis. Also use this to understand user strategies, insights, and game plans. Returns both user-created and AI-created notes. User ID and Calendar ID are automatically provided from context.',
  parameters: {
    type: 'object',
    properties: {
      search_query: {
        type: 'string',
        description: 'Optional search query to filter notes by title or content. Leave empty to get all notes.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of tags to filter notes. Use ["AGENT_MEMORY"] to retrieve AI memory notes. If provided, only notes with ALL specified tags will be returned.'
      },
      include_archived: {
        type: 'boolean',
        description: 'Whether to include archived notes. Default is false.'
      }
    },
    required: []
  }
};

/**
 * ============================================================================
 * TOOL IMPLEMENTATIONS
 * ============================================================================
 */

/**
 * Execute web search using Serper API
 */
export async function executeWebSearch(query: string, searchType: string = 'search'): Promise<string> {
  try {
    const serperApiKey = Deno.env.get('SERPER_API_KEY');
    if (!serperApiKey) {
      return 'Web search not configured';
    }

    const endpoint = searchType === 'news'
      ? 'https://google.serper.dev/news'
      : 'https://google.serper.dev/search';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 10 }),
    });

    if (!response.ok) {
      return `Search failed: ${response.status}`;
    }

    const data = await response.json();

    // Check if we have any results
    // For search endpoint: data.organic
    // For news endpoint: data.news
    const hasOrganic = data.organic && data.organic.length > 0;
    const hasNews = data.news && data.news.length > 0;
    const hasKnowledge = data.knowledgeGraph && (data.knowledgeGraph.title || data.knowledgeGraph.description);

    if (!hasOrganic && !hasNews && !hasKnowledge) {
      return `⚠️ NO RESULTS FOUND for query: "${query}". Try different search terms or use your market knowledge.`;
    }

    let results = `Search results for: "${query}"\n\n`;

    if (hasOrganic) {
      results += 'Top Results:\n';
      for (const result of data.organic.slice(0, 5)) {
        results += `\n- ${result.title}\n  ${result.snippet}\n  ${result.link}\n`;
      }
    }

    if (hasNews) {
      results += 'News Results:\n';
      for (const result of data.news.slice(0, 5)) {
        results += `\n- ${result.title}\n  ${result.snippet || result.description || ''}\n  ${result.link}\n`;
      }
    }

    if (hasKnowledge) {
      const title = data.knowledgeGraph.title || '';
      const desc = data.knowledgeGraph.description || '';
      results += `\n\n${title}\n${desc}\n`;
    }

    return results;
  } catch (error) {
    return `Search error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Scrape URL content using Serper API
 */
export async function scrapeUrl(url: string): Promise<string> {
  try {
    const serperApiKey = Deno.env.get('SERPER_API_KEY');
    if (!serperApiKey) {
      return 'URL scraping not configured (SERPER_API_KEY missing)';
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return 'Invalid URL format';
    }

    const response = await fetch('https://google.serper.dev/scrape', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return `Scraping failed: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();

    let result = `Content from: ${url}\n\n`;

    if (data.metadata?.title) {
      result += `Title: ${data.metadata.title}\n\n`;
    }

    if (data.text) {
      // Limit content length to manage token usage
      const maxLength = 3000;
      const text = data.text.length > maxLength
        ? data.text.substring(0, maxLength) + '...'
        : data.text;
      result += `Content:\n${text}`;
    }

    return result || 'No content extracted from URL';
  } catch (error) {
    return `URL scraping error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Get cryptocurrency price using CoinGecko API
 */
export async function getCryptoPrice(coinId: string): Promise<string> {
  try {
    // Normalize coin ID to lowercase
    coinId = coinId.toLowerCase().trim();

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

    const response = await fetch(url);

    if (!response.ok) {
      return `Failed to fetch crypto price: ${response.status}`;
    }

    const data = await response.json();

    if (!data[coinId]) {
      return `Cryptocurrency '${coinId}' not found. Try common names like: bitcoin, ethereum, solana, cardano, ripple, dogecoin`;
    }

    const coin = data[coinId];
    const priceChange = coin.usd_24h_change || 0;
    const changeSymbol = priceChange >= 0 ? '📈' : '📉';

    let result = `${coinId.toUpperCase()} Market Data:\n\n`;
    result += `💰 Price: $${coin.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    result += `${changeSymbol} 24h Change: ${priceChange.toFixed(2)}%\n`;
    result += `📊 24h Volume: $${(coin.usd_24h_vol / 1e6).toFixed(2)}M\n`;
    result += `🏦 Market Cap: $${(coin.usd_market_cap / 1e9).toFixed(2)}B\n`;

    return result;
  } catch (error) {
    return `Crypto price error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Get forex exchange rate using Frankfurter API
 */
export async function getForexPrice(baseCurrency: string, quoteCurrency: string): Promise<string> {
  try {
    // Normalize currency codes to uppercase
    baseCurrency = baseCurrency.toUpperCase().trim();
    quoteCurrency = quoteCurrency.toUpperCase().trim();

    const url = `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${quoteCurrency}`;

    const response = await fetch(url);

    if (!response.ok) {
      return `Failed to fetch forex rate: ${response.status}. Make sure currency codes are valid (e.g., EUR, USD, GBP, JPY).`;
    }

    const data = await response.json();

    if (!data.rates || !data.rates[quoteCurrency]) {
      return `Forex pair ${baseCurrency}/${quoteCurrency} not found. Supported currencies: EUR, USD, GBP, JPY, CHF, CAD, AUD, NZD, and more.`;
    }

    const rate = data.rates[quoteCurrency];
    const date = data.date;

    let result = `${baseCurrency}/${quoteCurrency} Forex Rate:\n\n`;
    result += `💱 Exchange Rate: ${rate.toFixed(5)}\n`;
    result += `📅 Date: ${date}\n`;
    result += `\n1 ${baseCurrency} = ${rate.toFixed(5)} ${quoteCurrency}\n`;

    return result;
  } catch (error) {
    return `Forex rate error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Generate chart using QuickChart API
 */
export async function generateChart(
  chartType: string,
  title: string,
  xLabel: string,
  yLabel: string,
  labels: unknown[],
  datasets: unknown[]
): Promise<string> {
  try {
    // Validate chart type
    if (!['line', 'bar'].includes(chartType)) {
      return 'Invalid chart type. Use "line" or "bar".';
    }

    // Build Chart.js configuration
    const chartConfig = {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: true,
          text: title,
          fontSize: 16
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: !!xLabel,
              labelString: xLabel
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: !!yLabel,
              labelString: yLabel
            }
          }]
        },
        legend: {
          display: true,
          position: 'bottom'
        }
      }
    };

    // Encode chart config for URL
    const chartConfigEncoded = encodeURIComponent(JSON.stringify(chartConfig));

    // Generate QuickChart URL
    const chartUrl = `https://quickchart.io/chart?c=${chartConfigEncoded}&width=800&height=400&format=png`;

    log(`Generated chart URL for: ${title}`, 'info');

    // Return special format that the formatter will convert to HTML with embedded image
    // Using a marker that the formatter can detect and convert to <img> tag
    return `Chart generated successfully!

**${title}**

[CHART_IMAGE:${chartUrl}]`;
  } catch (error) {
    return `Chart generation error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Create a new note for the user
 */
export async function createNote(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  title: string,
  content: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[]
): Promise<string> {
  try {
    log(`Creating note: ${title}`, 'info');

    const noteData: Record<string, unknown> = {
      user_id: userId,
      calendar_id: calendarId,
      title: title,
      content: content,
      by_assistant: true,
      is_archived: false,
      is_pinned: false,
      cover_image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: tags || []
    };

    // Add reminder fields if provided
    if (reminderType && reminderType !== 'none') {
      noteData.reminder_type = reminderType;
      noteData.is_reminder_active = true;

      if (reminderType === 'once' && reminderDate) {
        noteData.reminder_date = reminderDate;
      } else if (reminderType === 'weekly' && reminderDays && reminderDays.length > 0) {
        noteData.reminder_days = reminderDays;
      }
    } else {
      noteData.reminder_type = 'none';
      noteData.is_reminder_active = false;
    }

    const { data, error } = await supabase
      .from('notes')
      .insert(noteData)
      .select()
      .single();

    if (error) {
      log(`Error creating note: ${error.message}`, 'error');
      return `Failed to create note: ${error.message}`;
    }

    log(`Note created successfully: ${data.id}`, 'info');

    // Return the note ID so it can be referenced in the response
    return `Note "${title}" created successfully! [NOTE_CREATED:${data.id}]`;
  } catch (error) {
    return `Note creation error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Update an existing AI-created note
 */
export async function updateNote(
  supabase: SupabaseClient,
  noteId: string,
  title?: string,
  content?: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[]
): Promise<string> {
  try {
    log(`Updating note: ${noteId}`, 'info');

    // First, verify this is an AI-created note
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id, by_assistant, title')
      .eq('id', noteId)
      .single();

    if (fetchError) {
      return `Failed to find note: ${fetchError.message}`;
    }

    if (!existingNote) {
      return `Note not found with ID: ${noteId}`;
    }

    if (!existingNote.by_assistant) {
      return `Permission denied: You can only update AI-created notes. This note was created by the user.`;
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (content !== undefined) {
      updateData.content = content;
    }

    // Handle tags update
    if (tags !== undefined) {
      updateData.tags = tags;
    }

    // Handle reminder fields
    if (reminderType !== undefined) {
      updateData.reminder_type = reminderType;

      if (reminderType === 'none') {
        // Remove reminder
        updateData.is_reminder_active = false;
        updateData.reminder_date = null;
        updateData.reminder_days = [];
      } else {
        updateData.is_reminder_active = true;

        if (reminderType === 'once' && reminderDate) {
          updateData.reminder_date = reminderDate;
          updateData.reminder_days = [];
        } else if (reminderType === 'weekly' && reminderDays && reminderDays.length > 0) {
          updateData.reminder_days = reminderDays;
          updateData.reminder_date = null;
        }
      }
    }

    // Update the note
    const { error: updateError } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('by_assistant', true); // Extra safety check

    if (updateError) {
      log(`Error updating note: ${updateError.message}`, 'error');
      return `Failed to update note: ${updateError.message}`;
    }

    log(`Note updated successfully: ${noteId}`, 'info');

    return `Note "${existingNote.title}" updated successfully!`;
  } catch (error) {
    return `Note update error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Delete an AI-created note
 */
export async function deleteNote(
  supabase: SupabaseClient,
  noteId: string
): Promise<string> {
  try {
    log(`Deleting note: ${noteId}`, 'info');

    // First, verify this is an AI-created note
    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id, by_assistant, title')
      .eq('id', noteId)
      .single();

    if (fetchError) {
      return `Failed to find note: ${fetchError.message}`;
    }

    if (!existingNote) {
      return `Note not found with ID: ${noteId}`;
    }

    if (!existingNote.by_assistant) {
      return `Permission denied: You can only delete AI-created notes. This note was created by the user.`;
    }

    // Delete the note
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('by_assistant', true); // Extra safety check

    if (deleteError) {
      log(`Error deleting note: ${deleteError.message}`, 'error');
      return `Failed to delete note: ${deleteError.message}`;
    }

    log(`Note deleted successfully: ${noteId}`, 'info');

    return `Note "${existingNote.title}" deleted successfully!`;
  } catch (error) {
    return `Note deletion error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Search notes in a calendar
 */
export async function searchNotes(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  searchQuery?: string,
  includeArchived: boolean = false,
  tags?: string[]
): Promise<string> {
  try {
    log(`Searching notes for user ${userId} in calendar ${calendarId}`, 'info');

    // Build the query
    let query = supabase
      .from('notes')
      .select('id, title, content, by_assistant, is_pinned, is_archived, created_at, updated_at, reminder_type, reminder_date, reminder_days, tags')
      .eq('user_id', userId)
      .eq('calendar_id', calendarId);

    // Filter by archived status
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    // Apply tag filter if provided
    if (tags && tags.length > 0) {
      // Filter notes that contain ALL specified tags
      for (const tag of tags) {
        query = query.contains('tags', [tag]);
      }
    }

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    // Order by pinned first, then by updated date
    query = query.order('is_pinned', { ascending: false })
                 .order('updated_at', { ascending: false });

    const { data: notes, error } = await query;

    if (error) {
      log(`Error searching notes: ${error.message}`, 'error');
      return `Failed to search notes: ${error.message}`;
    }

    if (!notes || notes.length === 0) {
      return searchQuery
        ? `No notes found matching "${searchQuery}".`
        : tags && tags.length > 0
        ? `No notes found with tags: ${tags.join(', ')}.`
        : 'No notes found in this calendar.';
    }

    log(`Found ${notes.length} notes`, 'info');

    // Format the results with note-ref tags for card display
    let result = `Found ${notes.length} note${notes.length === 1 ? '' : 's'}:\n\n`;

    for (const note of notes) {
      // Add note-ref tag on its own line for card display
      result += `<note-ref id="${note.id}"/>\n\n`;
    }

    return result;
  } catch (error) {
    return `Note search error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * ============================================================================
 * TOOL EXECUTOR
 * ============================================================================
 */

/**
 * Execute a custom tool by name
 */
export async function executeCustomTool(
  toolName: string,
  args: Record<string, unknown>,
  context: Record<string, string | undefined>,
  supabase?: SupabaseClient,
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_web': {
        const query = typeof args.query === 'string' ? args.query : '';
        const searchType = typeof args.type === 'string' ? args.type : 'search';
        return await executeWebSearch(query, searchType);
      }

      case 'scrape_url': {
        const url = typeof args.url === 'string' ? args.url : '';
        return await scrapeUrl(url);
      }

      case 'get_crypto_price': {
        const coinId = typeof args.coin_id === 'string' ? args.coin_id : '';
        return await getCryptoPrice(coinId);
      }

      case 'get_forex_price': {
        const baseCurrency = typeof args.base_currency === 'string' ? args.base_currency : '';
        const quoteCurrency = typeof args.quote_currency === 'string' ? args.quote_currency : '';
        return await getForexPrice(baseCurrency, quoteCurrency);
      }

      case 'generate_chart': {
        const chartType = typeof args.chart_type === 'string' ? args.chart_type : 'line';
        const title = typeof args.title === 'string' ? args.title : 'Chart';
        const xLabel = typeof args.x_label === 'string' ? args.x_label : '';
        const yLabel = typeof args.y_label === 'string' ? args.y_label : '';
        const labels = Array.isArray(args.labels) ? args.labels : [];
        const datasets = Array.isArray(args.datasets) ? args.datasets : [];
        return await generateChart(chartType, title, xLabel, yLabel, labels, datasets);
      }

      case 'create_note': {
        if (!supabase) {
          return 'Supabase client not available for note creation';
        }
        const userId = context.userId || '';
        const calendarId = context.calendarId || '';
        const title = typeof args.title === 'string' ? args.title : '';
        const content = typeof args.content === 'string' ? args.content : '';
        const reminderType = typeof args.reminder_type === 'string' ? args.reminder_type : undefined;
        const reminderDate = typeof args.reminder_date === 'string' ? args.reminder_date : undefined;
        const reminderDays = Array.isArray(args.reminder_days) ? args.reminder_days : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;

        return await createNote(supabase, userId, calendarId, title, content, reminderType, reminderDate, reminderDays, tags);
      }

      case 'update_note': {
        if (!supabase) {
          return 'Supabase client not available for note update';
        }
        const noteId = typeof args.note_id === 'string' ? args.note_id : '';
        const title = typeof args.title === 'string' ? args.title : undefined;
        const content = typeof args.content === 'string' ? args.content : undefined;
        const reminderType = typeof args.reminder_type === 'string' ? args.reminder_type : undefined;
        const reminderDate = typeof args.reminder_date === 'string' ? args.reminder_date : undefined;
        const reminderDays = Array.isArray(args.reminder_days) ? args.reminder_days : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        return await updateNote(supabase, noteId, title, content, reminderType, reminderDate, reminderDays, tags);
      }

      case 'delete_note': {
        if (!supabase) {
          return 'Supabase client not available for note deletion';
        }
        const noteId = typeof args.note_id === 'string' ? args.note_id : '';
        return await deleteNote(supabase, noteId);
      }

      case 'search_notes': {
        if (!supabase) {
          return 'Supabase client not available for note search';
        }
        const userId = context.userId || '';
        const calendarId = context.calendarId || '';
        const searchQuery = typeof args.search_query === 'string' ? args.search_query : undefined;
        const includeArchived = typeof args.include_archived === 'boolean' ? args.include_archived : false;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        return await searchNotes(supabase, userId, calendarId, searchQuery, includeArchived, tags);
      }

      default:
        return `Unknown custom tool: ${toolName}`;
    }
  } catch (error) {
    return `Tool execution error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
}

/**
 * Get all custom tool definitions
 */
export function getAllCustomTools(): GeminiFunctionDeclaration[] {
  return [
    searchWebTool,
    scrapeUrlTool,
    getCryptoPriceTool,
    getForexPriceTool,
    generateChartTool,
    createNoteTool,
    updateNoteTool,
    deleteNoteTool,
    searchNotesTool
  ];
}
