/**
 * AI Trading Agent - Tool Definitions and Implementations
 * All custom tools (non-MCP) are defined and implemented here
 */

import { log } from "../_shared/supabase.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Note } from "./types.ts";

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
  name: "search_web",
  description:
    "Search web for market news, analysis, and trading information. After getting search results, you can use scrape_url to extract more detailed content from specific URLs.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      type: {
        type: "string",
        description: 'Type: "search" or "news"',
        enum: ["search", "news"],
      },
    },
    required: ["query"],
  },
};

/**
 * URL scraping tool definition
 */
export const scrapeUrlTool: GeminiFunctionDeclaration = {
  name: "scrape_url",
  description:
    "Scrape and extract content from a URL to get more detailed information. Use this after search_web to get full article content. You can also use this to extract and analyze sentiment from news articles.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to scrape and extract content from",
      },
    },
    required: ["url"],
  },
};

/**
 * Crypto price tool definition
 */
export const getCryptoPriceTool: GeminiFunctionDeclaration = {
  name: "get_crypto_price",
  description:
    "Get real-time cryptocurrency price, 24h change, volume, and market cap. Use this to understand current market conditions when analyzing trades.",
  parameters: {
    type: "object",
    properties: {
      coin_id: {
        type: "string",
        description:
          "Coin ID (lowercase): bitcoin, ethereum, solana, cardano, ripple, dogecoin, etc. Use common names.",
      },
    },
    required: ["coin_id"],
  },
};

/**
 * Forex price tool definition
 */
export const getForexPriceTool: GeminiFunctionDeclaration = {
  name: "get_forex_price",
  description:
    "Get real-time foreign exchange (forex) rates for currency pairs like EUR/USD, GBP/USD, etc. Use this for forex trading analysis.",
  parameters: {
    type: "object",
    properties: {
      base_currency: {
        type: "string",
        description:
          "Base currency code (3-letter): EUR, GBP, USD, JPY, CHF, CAD, AUD, NZD, etc.",
      },
      quote_currency: {
        type: "string",
        description:
          "Quote currency code (3-letter): USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD, etc.",
      },
    },
    required: ["base_currency", "quote_currency"],
  },
};

/**
 * Chart generation tool definition
 */
export const generateChartTool: GeminiFunctionDeclaration = {
  name: "generate_chart",
  description:
    "Generate a chart visualization from data. Returns HTML with an embedded image that displays inline in the chat. Use this after querying trade data via MCP tools to create visual representations like equity curves, P&L over time, or performance metrics.",
  parameters: {
    type: "object",
    properties: {
      chart_type: {
        type: "string",
        description: "Type of chart to generate",
        enum: ["line", "bar"],
      },
      title: {
        type: "string",
        description: "Chart title",
      },
      x_label: {
        type: "string",
        description: "X-axis label",
      },
      y_label: {
        type: "string",
        description: "Y-axis label",
      },
      labels: {
        type: "array",
        description: "Array of X-axis labels (e.g., dates, times)",
        items: { type: "string" },
      },
      datasets: {
        type: "array",
        description:
          "Array of dataset objects with {label: string, data: array of numbers, color: string}",
        items: { type: "object" },
      },
    },
    required: ["chart_type", "title", "labels", "datasets"],
  },
};

/**
 * Create note tool definition
 */
export const createNoteTool: GeminiFunctionDeclaration = {
  name: "create_note",
  description: `Create a new note for the user in their trading calendar.

USE CASES:
- Save trading strategies, insights, lessons learned, or game plans for the user

⚠️ CANNOT create AGENT_MEMORY notes - use update_memory tool instead (it auto-creates if needed).

Content should be in plain text format. User ID and Calendar ID are automatically provided from context.`,
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Note title (concise and descriptive)",
      },
      content: {
        type: "string",
        description:
          "Note content in plain text format. Use clear paragraphs and line breaks for readability. Do not use HTML tags.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          'Categorize the note. Available: "STRATEGY", "GAME_PLAN", "INSIGHT", "LESSON_LEARNED", "RISK_MANAGEMENT", "PSYCHOLOGY", "GENERAL". Use "AGENT_MEMORY" ONLY for AI memory notes.',
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description:
          'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days)',
      },
      reminder_date: {
        type: "string",
        description:
          'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".',
      },
      reminder_days: {
        type: "array",
        items: {
          type: "string",
          enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        description:
          'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]',
      },
      color: {
        type: "string",
        description:
          "Optional background color name. Available: 'red', 'pink', 'purple', 'deepPurple', 'indigo', 'blue', 'lightBlue', 'cyan', 'teal', 'green', 'lightGreen', 'lime', 'yellow', 'amber', 'orange', 'deepOrange', 'brown', 'grey', 'blueGrey'. If not provided, a random color will be assigned.",
      },
    },
    required: ["title", "content"],
  },
};

/**
 * Update memory tool definition - dedicated tool for memory management with merge logic
 */
export const updateMemoryTool: GeminiFunctionDeclaration = {
  name: "update_memory",
  description:
    `Update your persistent memory with new insights. This tool MERGES new information with existing memory - it does NOT replace.

CRITICAL: Provide ONLY the new information to add. The system will automatically merge it with existing content.

SECTIONS (choose one):
- TRADER_PROFILE: Trading style, risk tolerance, experience level, timeframes
- PERFORMANCE_PATTERNS: Setups/sessions that work, with win rates and evidence
- STRATEGY_PREFERENCES: User-stated rules, entry criteria, risk management
- PSYCHOLOGICAL_PATTERNS: Emotional triggers, tilt patterns, confidence cycles, behavioral tendencies
- LESSONS_LEARNED: Errors to avoid, corrections received, communication preferences
- ACTIVE_FOCUS: Current goals, things to watch (this section CAN be replaced)

FORMAT each insight as: "[Pattern/Rule]: [Evidence] [Confidence: High/Med/Low] [YYYY-MM]"

EXAMPLES:
- "London session scalps: 72% win rate on 15 trades [High] [2024-12]"
- "Avoids trading during FOMC: User preference stated [High] [2024-12]"
- "Struggles with counter-trend entries: 30% win rate [Med] [2024-12]"
- "Tends to overtrade after 2+ consecutive wins: Observed pattern [Med] [2024-12]"`,
  parameters: {
    type: "object",
    properties: {
      section: {
        type: "string",
        enum: [
          "TRADER_PROFILE",
          "PERFORMANCE_PATTERNS",
          "STRATEGY_PREFERENCES",
          "PSYCHOLOGICAL_PATTERNS",
          "LESSONS_LEARNED",
          "ACTIVE_FOCUS",
        ],
        description: "Which section to update",
      },
      new_insights: {
        type: "array",
        items: { type: "string" },
        description:
          "New bullet points to ADD to this section (will be merged with existing)",
      },
      replace_section: {
        type: "boolean",
        description:
          "If true, replaces section entirely. Only use for ACTIVE_FOCUS when goals change completely. Default: false (merge mode)",
      },
    },
    required: ["section", "new_insights"],
  },
};

/**
 * Update note tool definition
 */
export const updateNoteTool: GeminiFunctionDeclaration = {
  name: "update_note",
  description:
    `Update an existing AI-created note. You can only update notes that you created (by_assistant=true).

⚠️ CANNOT update AGENT_MEMORY notes - use update_memory tool instead for memory management.

USE CASES:
- Refine strategies or update insights
- Add/modify/remove tags and reminders`,
  parameters: {
    type: "object",
    properties: {
      note_id: {
        type: "string",
        description: "ID of the note to update",
      },
      title: {
        type: "string",
        description: "New title (optional - only include if changing)",
      },
      content: {
        type: "string",
        description:
          "New content in plain text format (optional - only include if changing). Use clear paragraphs and line breaks for readability. Do not use HTML tags.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          'Updated tags (optional). Available: "STRATEGY", "GAME_PLAN", "INSIGHT", "LESSON_LEARNED", "RISK_MANAGEMENT", "PSYCHOLOGY", "GENERAL", "AGENT_MEMORY".',
      },
      reminder_type: {
        type: "string",
        enum: ["none", "once", "weekly"],
        description:
          'Reminder type: "none" (no reminder), "once" (specific date), or "weekly" (recurring days). Use "none" to remove reminders.',
      },
      reminder_date: {
        type: "string",
        description:
          'ISO date string (YYYY-MM-DD) for one-time reminders. Only used when reminder_type is "once".',
      },
      reminder_days: {
        type: "array",
        items: {
          type: "string",
          enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        },
        description:
          'Array of day abbreviations for weekly reminders. Only used when reminder_type is "weekly". Example: ["Mon", "Wed", "Fri"]',
      },
    },
    required: ["note_id"],
  },
};

/**
 * Delete note tool definition
 */
export const deleteNoteTool: GeminiFunctionDeclaration = {
  name: "delete_note",
  description:
    "Delete an existing AI-created note. You can only delete notes that you created (by_assistant=true). Use this to remove outdated or incorrect notes.",
  parameters: {
    type: "object",
    properties: {
      note_id: {
        type: "string",
        description: "ID of the note to delete",
      },
    },
    required: ["note_id"],
  },
};

/**
 * Search notes tool definition
 */
export const searchNotesTool: GeminiFunctionDeclaration = {
  name: "search_notes",
  description: `Search and retrieve notes from the user's trading calendar.

CRITICAL: At the START of EVERY session, search with tags: ["AGENT_MEMORY"] to retrieve your persistent memory about this trader.

AVAILABLE TAGS (use these to filter by category):
- "STRATEGY" - Trading strategies and methodologies
- "GAME_PLAN" - Daily/weekly trading plans and preparation
- "INSIGHT" - Market observations and realizations
- "LESSON_LEARNED" - Post-trade reflections and mistakes to avoid
- "RISK_MANAGEMENT" - Position sizing, stop loss rules, risk parameters
- "PSYCHOLOGY" - Trading mindset, emotions, mental frameworks
- "GENERAL" - Miscellaneous notes
- "AGENT_MEMORY" - AI persistent memory (retrieve at session start)

SMART QUERYING EXAMPLES:
- Analyze user's risk approach: tags: ["RISK_MANAGEMENT"]
- Review strategies before trading: tags: ["STRATEGY"]
- Understand daily preparation: tags: ["GAME_PLAN"]
- Learn from past mistakes: tags: ["LESSON_LEARNED"]
- Combine with search_query for precision: tags: ["STRATEGY"], search_query: "scalping"

EMBEDDED IMAGES:
- Notes may contain embedded images (diagrams, charts, frameworks)
- Results show: [Embedded images: url1, url2] when images exist
- Use analyze_image tool on these URLs for visual context
- Especially valuable for: strategy diagrams, setup examples, risk frameworks

Returns both user-created and AI-created notes. User ID and Calendar ID are automatically provided from context.`,
  parameters: {
    type: "object",
    properties: {
      search_query: {
        type: "string",
        description:
          "Optional text search to filter notes by title or content. Combine with tags for precision.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          'Filter by category. Available: "STRATEGY", "GAME_PLAN", "INSIGHT", "LESSON_LEARNED", "RISK_MANAGEMENT", "PSYCHOLOGY", "GENERAL", "AGENT_MEMORY". Notes must have ALL specified tags.',
      },
      include_archived: {
        type: "boolean",
        description: "Whether to include archived notes. Default is false.",
      },
    },
    required: [],
  },
};

/**
 * Analyze trade image tool definition
 */
export const analyzeImageTool: GeminiFunctionDeclaration = {
  name: "analyze_image",
  description:
    "Analyze a trade chart image to extract insights about entries, exits, patterns, and price action. Use this when reviewing trades that have attached images. Pass the image URL from trade.images[].url field.",
  parameters: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description:
          "The URL of the trade image to analyze (from trade.images[].url)",
      },
      analysis_focus: {
        type: "string",
        description:
          "What to focus the analysis on: entry quality, exit timing, pattern identification, support/resistance, or general overview",
        enum: ["entry", "exit", "patterns", "levels", "overview"],
      },
      trade_context: {
        type: "string",
        description:
          'Optional context about the trade (e.g., "Long EUR/USD, won 2R") to help interpret the chart',
      },
    },
    required: ["image_url"],
  },
};

/**
 * Get tag definition tool - look up user-defined meanings for custom tags
 */
export const getTagDefinitionTool: GeminiFunctionDeclaration = {
  name: "get_tag_definition",
  description: `Look up the user's definition for a custom trading tag.

USE WHEN: You encounter a tag you don't understand (e.g., "Confluence:3x Displacement", "Setup:ICT OTE", "Risk:A++ Setup").

WORKFLOW:
1. If tag meaning is unclear, call this tool to get user's definition
2. If no definition exists, you may SUGGEST a definition based on context
3. ALWAYS ask user permission before saving a new definition
4. Present your suggested definition and ask: "Would you like me to save this definition for future reference?"

Returns the user's explanation of what this tag means to them, or null if no definition exists.`,
  parameters: {
    type: "object",
    properties: {
      tag_name: {
        type: "string",
        description:
          "The exact tag name to look up (e.g., 'Confluence:3x Displacement')",
      },
    },
    required: ["tag_name"],
  },
};

/**
 * Save tag definition tool - save a definition with user permission
 */
export const saveTagDefinitionTool: GeminiFunctionDeclaration = {
  name: "save_tag_definition",
  description:
    `Save or update a definition for a trading tag. IMPORTANT: Only use this AFTER getting explicit user permission.

WORKFLOW:
1. First suggest a definition to the user
2. Wait for user confirmation
3. Only then call this tool to save

Never call this tool without user consent.`,
  parameters: {
    type: "object",
    properties: {
      tag_name: {
        type: "string",
        description: "The exact tag name to define",
      },
      definition: {
        type: "string",
        description: "The definition/meaning of the tag",
      },
    },
    required: ["tag_name", "definition"],
  },
};

/**
 * ============================================================================
 * TOOL IMPLEMENTATIONS
 * ============================================================================
 */

/**
 * Execute web search using Serper API
 */
export async function executeWebSearch(
  query: string,
  searchType: string = "search",
): Promise<string> {
  try {
    const serperApiKey = Deno.env.get("SERPER_API_KEY");
    if (!serperApiKey) {
      return "Web search not configured";
    }

    const endpoint = searchType === "news"
      ? "https://google.serper.dev/news"
      : "https://google.serper.dev/search";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 10 }),
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
    const hasKnowledge = data.knowledgeGraph &&
      (data.knowledgeGraph.title || data.knowledgeGraph.description);

    if (!hasOrganic && !hasNews && !hasKnowledge) {
      return `⚠️ NO RESULTS FOUND for query: "${query}". Try different search terms or use your market knowledge.`;
    }

    let results = `Search results for: "${query}"\n\n`;

    if (hasOrganic) {
      results += "Top Results:\n";
      for (const result of data.organic.slice(0, 5)) {
        results +=
          `\n- ${result.title}\n  ${result.snippet}\n  ${result.link}\n`;
      }
    }

    if (hasNews) {
      results += "News Results:\n";
      for (const result of data.news.slice(0, 5)) {
        results += `\n- ${result.title}\n  ${
          result.snippet || result.description || ""
        }\n  ${result.link}\n`;
      }
    }

    if (hasKnowledge) {
      const title = data.knowledgeGraph.title || "";
      const desc = data.knowledgeGraph.description || "";
      results += `\n\n${title}\n${desc}\n`;
    }

    return results;
  } catch (error) {
    return `Search error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Scrape URL content using Serper API
 */
export async function scrapeUrl(url: string): Promise<string> {
  try {
    const serperApiKey = Deno.env.get("SERPER_API_KEY");
    if (!serperApiKey) {
      return "URL scraping not configured (SERPER_API_KEY missing)";
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return "Invalid URL format";
    }

    const response = await fetch("https://google.serper.dev/scrape", {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json",
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
        ? data.text.substring(0, maxLength) + "..."
        : data.text;
      result += `Content:\n${text}`;
    }

    return result || "No content extracted from URL";
  } catch (error) {
    return `URL scraping error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get cryptocurrency price using CoinGecko API
 */
export async function getCryptoPrice(coinId: string): Promise<string> {
  try {
    // Normalize coin ID to lowercase
    coinId = coinId.toLowerCase().trim();

    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

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
    const changeSymbol = priceChange >= 0 ? "📈" : "📉";

    let result = `${coinId.toUpperCase()} Market Data:\n\n`;
    result += `💰 Price: $${
      coin.usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }\n`;
    result += `${changeSymbol} 24h Change: ${priceChange.toFixed(2)}%\n`;
    result += `📊 24h Volume: $${(coin.usd_24h_vol / 1e6).toFixed(2)}M\n`;
    result += `🏦 Market Cap: $${(coin.usd_market_cap / 1e9).toFixed(2)}B\n`;

    return result;
  } catch (error) {
    return `Crypto price error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get forex exchange rate using Frankfurter API
 */
export async function getForexPrice(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<string> {
  try {
    // Normalize currency codes to uppercase
    baseCurrency = baseCurrency.toUpperCase().trim();
    quoteCurrency = quoteCurrency.toUpperCase().trim();

    const url =
      `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${quoteCurrency}`;

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
    return `Forex rate error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
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
  datasets: unknown[],
): Promise<string> {
  try {
    // Validate chart type
    if (!["line", "bar"].includes(chartType)) {
      return 'Invalid chart type. Use "line" or "bar".';
    }

    // Build Chart.js configuration
    const chartConfig = {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        title: {
          display: true,
          text: title,
          fontSize: 16,
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: !!xLabel,
              labelString: xLabel,
            },
          }],
          yAxes: [{
            scaleLabel: {
              display: !!yLabel,
              labelString: yLabel,
            },
          }],
        },
        legend: {
          display: true,
          position: "bottom",
        },
      },
    };

    // Encode chart config for URL
    const chartConfigEncoded = encodeURIComponent(JSON.stringify(chartConfig));

    // Generate QuickChart URL
    const chartUrl =
      `https://quickchart.io/chart?c=${chartConfigEncoded}&width=800&height=400&format=png`;

    log(`Generated chart URL for: ${title}`, "info");

    // Return special format that the formatter will convert to HTML with embedded image
    // Using a marker that the formatter can detect and convert to <img> tag
    return `Chart generated successfully!

**${title}**

[CHART_IMAGE:${chartUrl}]`;
  } catch (error) {
    return `Chart generation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
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
  tags?: string[],
  color?: string,
): Promise<string> {
  try {
    log(`Creating note: ${title}`, "info");

    // Block creation of AGENT_MEMORY notes - must use update_memory tool instead
    // update_memory auto-creates memory if it doesn't exist and properly merges content
    if (tags && tags.includes("AGENT_MEMORY")) {
      return `Cannot create AGENT_MEMORY notes with create_note. Use the update_memory tool instead - it automatically creates the memory note if needed and properly merges new insights with existing memory.`;
    }

    // Assistant Colors Palette (Semantic)
    const ASSISTANT_COLORS = [
      "red",
      "pink",
      "purple",
      "deepPurple",
      "indigo",
      "blue",
      "lightBlue",
      "cyan",
      "teal",
      "green",
      "lightGreen",
      "lime",
      "yellow",
      "amber",
      "orange",
      "deepOrange",
      "brown",
      "grey",
      "blueGrey",
    ];

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
      tags: tags || [],
    };

    // Assign color: use provided color or random assistant color
    if (color) {
      noteData.color = color;
    } else {
      // Randomly select a color from the assistant palette
      const randomColor =
        ASSISTANT_COLORS[Math.floor(Math.random() * ASSISTANT_COLORS.length)];
      noteData.color = randomColor;
    }

    // Assign color: use provided color or random assistant color
    if (color) {
      noteData.color = color;
    } else {
      // Randomly select a color from the assistant palette
      const randomColor =
        ASSISTANT_COLORS[Math.floor(Math.random() * ASSISTANT_COLORS.length)];
      noteData.color = randomColor;
    }

    // Add reminder fields if provided
    if (reminderType && reminderType !== "none") {
      noteData.reminder_type = reminderType;
      noteData.is_reminder_active = true;

      if (reminderType === "once" && reminderDate) {
        noteData.reminder_date = reminderDate;
      } else if (
        reminderType === "weekly" && reminderDays && reminderDays.length > 0
      ) {
        noteData.reminder_days = reminderDays;
      }
    } else {
      noteData.reminder_type = "none";
      noteData.is_reminder_active = false;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert(noteData)
      .select()
      .single();

    if (error) {
      log(`Error creating note: ${error.message}`, "error");
      return `Failed to create note: ${error.message}`;
    }

    log(`Note created successfully: ${data.id}`, "info");

    // Return the note ID so it can be referenced in the response
    return `Note "${title}" created successfully! [NOTE_CREATED:${data.id}]`;
  } catch (error) {
    return `Note creation error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Update an existing AI-created note
 * NOTE: Cannot update AGENT_MEMORY notes - use updateMemory instead
 */
export async function updateNote(
  supabase: SupabaseClient,
  noteId: string,
  title?: string,
  content?: string,
  reminderType?: string,
  reminderDate?: string,
  reminderDays?: string[],
  tags?: string[],
): Promise<string> {
  try {
    log(`Updating note: ${noteId}`, "info");

    // First, verify this is an AI-created note and check for AGENT_MEMORY
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title, tags")
      .eq("id", noteId)
      .single();

    if (fetchError) {
      return `Failed to find note: ${fetchError.message}`;
    }

    if (!existingNote) {
      return `Note not found with ID: ${noteId}`;
    }

    // Block updates to AGENT_MEMORY notes - must use update_memory tool instead
    const noteTags = existingNote.tags || [];
    if (noteTags.includes("AGENT_MEMORY")) {
      return `Cannot update AGENT_MEMORY notes with update_note. Use the update_memory tool instead - it properly merges new insights with existing memory without losing information.`;
    }

    if (!existingNote.by_assistant) {
      return `Permission denied: You can only update AI-created notes. This note was created by the user.`;
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
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

      if (reminderType === "none") {
        // Remove reminder
        updateData.is_reminder_active = false;
        updateData.reminder_date = null;
        updateData.reminder_days = [];
      } else {
        updateData.is_reminder_active = true;

        if (reminderType === "once" && reminderDate) {
          updateData.reminder_date = reminderDate;
          updateData.reminder_days = [];
        } else if (
          reminderType === "weekly" && reminderDays && reminderDays.length > 0
        ) {
          updateData.reminder_days = reminderDays;
          updateData.reminder_date = null;
        }
      }
    }

    // Update the note
    const { error: updateError } = await supabase
      .from("notes")
      .update(updateData)
      .eq("id", noteId)
      .eq("by_assistant", true); // Extra safety check

    if (updateError) {
      log(`Error updating note: ${updateError.message}`, "error");
      return `Failed to update note: ${updateError.message}`;
    }

    log(`Note updated successfully: ${noteId}`, "info");

    return `Note "${existingNote.title}" updated successfully!`;
  } catch (error) {
    return `Note update error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Delete an AI-created note
 */
export async function deleteNote(
  supabase: SupabaseClient,
  noteId: string,
): Promise<string> {
  try {
    log(`Deleting note: ${noteId}`, "info");

    // First, verify this is an AI-created note
    const { data: existingNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, by_assistant, title")
      .eq("id", noteId)
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
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("by_assistant", true); // Extra safety check

    if (deleteError) {
      log(`Error deleting note: ${deleteError.message}`, "error");
      return `Failed to delete note: ${deleteError.message}`;
    }

    log(`Note deleted successfully: ${noteId}`, "info");

    return `Note "${existingNote.title}" deleted successfully!`;
  } catch (error) {
    return `Note deletion error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

// =============================================================================
// MEMORY SYSTEM - Dedicated merge-based memory management
// =============================================================================

type MemorySection =
  | "TRADER_PROFILE"
  | "PERFORMANCE_PATTERNS"
  | "STRATEGY_PREFERENCES"
  | "PSYCHOLOGICAL_PATTERNS"
  | "LESSONS_LEARNED"
  | "ACTIVE_FOCUS";

const MEMORY_SECTION_ORDER: MemorySection[] = [
  "TRADER_PROFILE",
  "PERFORMANCE_PATTERNS",
  "STRATEGY_PREFERENCES",
  "PSYCHOLOGICAL_PATTERNS",
  "LESSONS_LEARNED",
  "ACTIVE_FOCUS",
];

/**
 * Parse memory content into sections
 */
function parseMemorySections(content: string): Record<MemorySection, string[]> {
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };

  // Handle empty content
  if (!content || content.trim().length === 0) {
    log(`[parseMemorySections] Empty content received`, "warn");
    return sections;
  }

  // Split by section headers
  const sectionPattern =
    /^## (TRADER_PROFILE|PERFORMANCE_PATTERNS|STRATEGY_PREFERENCES|PSYCHOLOGICAL_PATTERNS|LESSONS_LEARNED|ACTIVE_FOCUS)\s*$/gm;
  const parts = content.split(sectionPattern);

  // Debug: log how many parts were found
  const sectionNamesFound = parts.filter((_, i) => i % 2 === 1);
  log(
    `[parseMemorySections] Found ${sectionNamesFound.length} section headers: ${
      sectionNamesFound.join(", ")
    }`,
    "info",
  );

  // parts will be: [preamble, "SECTION_NAME", content, "SECTION_NAME", content, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const sectionName = parts[i] as MemorySection;
    const sectionContent = parts[i + 1] || "";

    // Extract bullet points from section content (excluding placeholder text)
    const bullets = sectionContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.substring(2).trim())
      .filter((line) => line.length > 0)
      .filter((line) => line !== "(No data yet)");

    if (MEMORY_SECTION_ORDER.includes(sectionName)) {
      sections[sectionName] = bullets;
    }
  }

  // Warn if no sections were parsed from non-empty content
  const totalBullets = Object.values(sections).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  if (content.length > 50 && totalBullets === 0) {
    log(
      `[parseMemorySections] WARNING: No bullets parsed from ${content.length} char content. Content may be malformed.`,
      "warn",
    );
    log(
      `[parseMemorySections] Content start: ${
        content.substring(0, 200).replace(/\n/g, "\\n")
      }`,
      "warn",
    );
  }

  return sections;
}

/**
 * Build memory content from sections
 */
function buildMemoryContent(sections: Record<MemorySection, string[]>): string {
  const parts: string[] = [];

  for (const section of MEMORY_SECTION_ORDER) {
    const items = sections[section] || [];
    parts.push(`## ${section}`);
    if (items.length > 0) {
      parts.push(items.map((item) => `- ${item}`).join("\n"));
    } else {
      parts.push("- (No data yet)");
    }
    parts.push(""); // Empty line between sections
  }

  return parts.join("\n").trim();
}

/**
 * Deduplicate similar insights (basic similarity check)
 */
function deduplicateInsights(insights: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const insight of insights) {
    // Normalize for comparison: lowercase, remove dates, trim
    const normalized = insight
      .toLowerCase()
      .replace(/\[\d{4}-\d{2}\]/g, "") // Remove date tags
      .replace(/\[high\]|\[med\]|\[low\]/gi, "") // Remove confidence
      .trim();

    // Check if we've seen something very similar
    let isDuplicate = false;
    for (const seenNorm of seen) {
      // Simple similarity: if 80%+ of words match, consider duplicate
      const words1 = new Set(normalized.split(/\s+/));
      const words2 = new Set(seenNorm.split(/\s+/));
      const intersection = [...words1].filter((w) => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      if (union > 0 && intersection / union > 0.8) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seen.add(normalized);
      result.push(insight);
    }
  }

  return result;
}

/**
 * Create initial memory note with structure
 */
async function createInitialMemory(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  section: MemorySection,
  insights: string[],
): Promise<string> {
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };

  sections[section] = insights;
  const content = buildMemoryContent(sections);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      calendar_id: calendarId,
      title: "Memory",
      content: content,
      by_assistant: true,
      is_archived: false,
      is_pinned: true,
      tags: ["AGENT_MEMORY"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    log(`Error creating memory: ${error.message}`, "error");
    return `Failed to create memory: ${error.message}`;
  }

  log(`Memory created with ID: ${data.id}`, "info");
  return `Memory initialized with ${insights.length} insight(s) in ${section}.`;
}

/**
 * Update memory with merge logic - preserves existing knowledge
 */
export async function updateMemory(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  section: MemorySection,
  newInsights: string[],
  replaceSection: boolean = false,
): Promise<string> {
  try {
    // Enhanced logging for debugging
    log(
      `[updateMemory] START - section: ${section}, newInsights: ${newInsights.length}, replaceSection: ${replaceSection}`,
      "info",
    );
    log(
      `[updateMemory] New insights to add: ${
        JSON.stringify(newInsights).substring(0, 500)
      }`,
      "info",
    );

    // 1. Fetch existing memory note
    const { data: memoryNote, error: fetchError } = await supabase
      .from("notes")
      .select("id, content")
      .eq("user_id", userId)
      .eq("calendar_id", calendarId)
      .contains("tags", ["AGENT_MEMORY"])
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      log(
        `[updateMemory] Error fetching memory: ${fetchError.message}`,
        "error",
      );
      return `Failed to fetch memory: ${fetchError.message}`;
    }

    // 2. If no memory exists, create initial one
    if (!memoryNote) {
      log(
        "[updateMemory] No existing memory found, creating initial memory",
        "info",
      );
      return await createInitialMemory(
        supabase,
        userId,
        calendarId,
        section,
        newInsights,
      );
    }

    // 3. Parse existing content into sections
    const existingContent = memoryNote.content || "";
    log(
      `[updateMemory] Existing content length: ${existingContent.length} chars`,
      "info",
    );

    // Debug: Log first 500 chars of existing content
    if (existingContent.length > 0) {
      log(
        `[updateMemory] Existing content preview: ${
          existingContent.substring(0, 500).replace(/\n/g, "\\n")
        }`,
        "info",
      );
    }

    const sections = parseMemorySections(existingContent);

    // Debug: Log what was parsed from each section
    log(
      `[updateMemory] Parsed sections - TRADER_PROFILE: ${sections.TRADER_PROFILE.length}, PERFORMANCE_PATTERNS: ${sections.PERFORMANCE_PATTERNS.length}, STRATEGY_PREFERENCES: ${sections.STRATEGY_PREFERENCES.length}, PSYCHOLOGICAL_PATTERNS: ${sections.PSYCHOLOGICAL_PATTERNS.length}, LESSONS_LEARNED: ${sections.LESSONS_LEARNED.length}, ACTIVE_FOCUS: ${sections.ACTIVE_FOCUS.length}`,
      "info",
    );

    const existingCount = sections[section].length;
    log(
      `[updateMemory] Target section ${section} has ${existingCount} existing insights: ${
        JSON.stringify(sections[section]).substring(0, 300)
      }`,
      "info",
    );

    // 4. Merge or replace section
    if (replaceSection) {
      // SAFEGUARD: Only allow replace_section for ACTIVE_FOCUS
      if (section !== "ACTIVE_FOCUS") {
        log(
          `[updateMemory] WARNING: replace_section=true attempted on ${section}, but only ACTIVE_FOCUS can be replaced. Falling back to MERGE mode.`,
          "warn",
        );
        // Fall through to merge logic instead of replacing
      } else {
        log(
          `[updateMemory] REPLACING ${section} section entirely (was: ${existingCount}, will be: ${newInsights.length})`,
          "info",
        );
        sections[section] = newInsights;
        // Skip the else block by returning early after the full flow
      }
    }

    // MERGE mode (default) - also used when replace_section was incorrectly set for non-ACTIVE_FOCUS
    if (!replaceSection || section !== "ACTIVE_FOCUS") {
      // APPEND new insights, preserving existing
      log(
        `[updateMemory] MERGING ${newInsights.length} new insights into ${section} (existing: ${existingCount})`,
        "info",
      );
      sections[section] = [...sections[section], ...newInsights];

      // Deduplicate similar entries
      const beforeDedup = sections[section].length;
      sections[section] = deduplicateInsights(sections[section]);
      const afterDedup = sections[section].length;

      if (beforeDedup !== afterDedup) {
        log(
          `[updateMemory] Deduplication removed ${
            beforeDedup - afterDedup
          } similar insights`,
          "info",
        );
      }

      log(
        `[updateMemory] After merge - ${section}: ${
          sections[section].length
        } insights`,
        "info",
      );
    }

    // 5. Rebuild content preserving structure
    const updatedContent = buildMemoryContent(sections);
    log(
      `[updateMemory] Updated content length: ${updatedContent.length} chars`,
      "info",
    );

    // Debug: Verify all sections are present in rebuilt content
    const verifyParsed = parseMemorySections(updatedContent);
    log(
      `[updateMemory] VERIFY after rebuild - TRADER_PROFILE: ${verifyParsed.TRADER_PROFILE.length}, PERFORMANCE_PATTERNS: ${verifyParsed.PERFORMANCE_PATTERNS.length}, STRATEGY_PREFERENCES: ${verifyParsed.STRATEGY_PREFERENCES.length}, PSYCHOLOGICAL_PATTERNS: ${verifyParsed.PSYCHOLOGICAL_PATTERNS.length}, LESSONS_LEARNED: ${verifyParsed.LESSONS_LEARNED.length}, ACTIVE_FOCUS: ${verifyParsed.ACTIVE_FOCUS.length}`,
      "info",
    );

    // 6. Check size limit (~2000 tokens ≈ 8000 chars)
    if (updatedContent.length > 8000) {
      log(
        `[updateMemory] Memory exceeds size limit (${updatedContent.length} chars), consider compression`,
        "warn",
      );
    }

    // 7. Update note
    const { error: updateError } = await supabase
      .from("notes")
      .update({
        content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryNote.id);

    if (updateError) {
      log(
        `[updateMemory] Error updating memory: ${updateError.message}`,
        "error",
      );
      return `Failed to update memory: ${updateError.message}`;
    }

    const finalCount = sections[section].length;
    const addedCount = replaceSection
      ? newInsights.length
      : (finalCount - existingCount);

    log(
      `[updateMemory] SUCCESS - ${section} now has ${finalCount} insights (added: ${addedCount})`,
      "info",
    );
    return `Memory updated: ${
      replaceSection ? "Replaced" : "Added"
    } ${addedCount} insight(s) in ${section}. Total: ${finalCount} insights in section.`;
  } catch (error) {
    log(`[updateMemory] ERROR: ${error}`, "error");
    return `Memory update error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Extract image URLs from Draft.js content
 * Filters out stock/splash images (unsplash, pexels, etc.)
 */
function extractImagesFromContent(content: string): string[] {
  try {
    const rawContent = JSON.parse(content);
    const images: string[] = [];

    // Draft.js stores entities in entityMap
    if (rawContent.entityMap) {
      for (const key in rawContent.entityMap) {
        const entity = rawContent.entityMap[key];
        if (entity.type === "IMAGE" && entity.data?.src) {
          const src = entity.data.src;
          // Filter out stock/splash image sources
          const isStockImage = src.includes("unsplash.com") ||
            src.includes("pexels.com") ||
            src.includes("pixabay.com") ||
            src.includes("stock") ||
            src.includes("placeholder");

          if (!isStockImage) {
            images.push(src);
          }
        }
      }
    }
    return images;
  } catch {
    return [];
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
  tags?: string[],
): Promise<string> {
  try {
    log(
      `Searching ${
        tags?.length ? `tags: ${tags.join(", ")}` : "all"
      } notes for user ${userId} in calendar ${calendarId}`,
      "info",
    );

    // Build the query
    let query = supabase
      .from("notes")
      .select(
        "id, title, content, by_assistant, is_pinned, is_archived, created_at, updated_at, reminder_type, reminder_date, reminder_days, tags",
      )
      .eq("user_id", userId)
      .eq("calendar_id", calendarId);

    // Filter by archived status
    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    // Apply tag filter if provided
    if (tags && tags.length > 0) {
      // Filter notes that contain ALL specified tags
      for (const tag of tags) {
        query = query.contains("tags", [tag]);
      }
    }

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      query = query.or(
        `title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`,
      );
    }

    // Order by pinned first, then by updated date
    query = query.order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    const { data: notes, error } = await query;

    if (error) {
      log(`Error searching notes: ${error.message}`, "error");
      return `Failed to search notes: ${error.message}`;
    }

    if (!notes || notes.length === 0) {
      return searchQuery
        ? `No notes found matching "${searchQuery}".`
        : tags && tags.length > 0
        ? `No notes found with tags: ${tags.join(", ")}.`
        : "No notes found in this calendar.";
    }

    log(`Found ${notes.length} notes`, "info");

    // Format the results with note-ref tags for card display
    let result = `Found ${notes.length} note${
      notes.length === 1 ? "" : "s"
    }:\n\n`;

    for (const note of notes) {
      // Add note-ref tag on its own line for card display
      result += `<note-ref id="${note.id}"/>`;

      // Extract and include embedded images from content
      const contentImages = extractImagesFromContent(note.content);
      if (contentImages.length > 0) {
        result += `\n[Embedded images: ${contentImages.join(", ")}]`;
      }

      result += "\n\n";
    }

    return result;
  } catch (error) {
    return `Note search error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Get tag definition from database
 * Supports partial matching: "3x Displacement" will match "Confluence:3x Displacement"
 */
export async function getTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
): Promise<string> {
  try {
    console.log(
      `[getTagDefinition] Looking up: "${tagName}" for user: ${userId}`,
    );
    log(`Looking up definition for tag: ${tagName}`, "info");

    // First try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .eq("tag_name", tagName)
      .single();

    if (exactError && exactError.code !== "PGRST116") {
      log(`Error fetching tag definition: ${exactError.message}`, "error");
      return `Error looking up tag definition: ${exactError.message}`;
    }

    if (exactMatch) {
      console.log(
        `[getTagDefinition] Found exact match: ${JSON.stringify(exactMatch)}`,
      );
      log(`Found exact definition for tag: ${tagName}`, "info");
      return `Tag "${tagName}" definition: ${exactMatch.definition}`;
    }

    console.log(
      `[getTagDefinition] No exact match, exactError: ${
        JSON.stringify(exactError)
      }`,
    );

    // If no exact match, try partial match (tag name part of grouped tags)
    // This allows "3x Displacement" to match "Confluence:3x Displacement"
    const { data: partialMatches, error: partialError } = await supabase
      .from("tag_definitions")
      .select("tag_name, definition")
      .eq("user_id", userId)
      .ilike("tag_name", `%:${tagName}`);

    if (partialError) {
      log(
        `Error fetching partial tag definition: ${partialError.message}`,
        "error",
      );
      return `Error looking up tag definition: ${partialError.message}`;
    }

    if (partialMatches && partialMatches.length > 0) {
      // Return the first match (most likely the intended one)
      const match = partialMatches[0];
      log(
        `Found partial match for tag "${tagName}": ${match.tag_name}`,
        "info",
      );
      return `Tag "${match.tag_name}" definition: ${match.definition}`;
    }

    return `No definition found for tag "${tagName}". You may suggest a definition and ask the user if they'd like to save it.`;
  } catch (error) {
    return `Error looking up tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Save tag definition to database
 */
export async function saveTagDefinition(
  supabase: SupabaseClient,
  userId: string,
  tagName: string,
  definition: string,
): Promise<string> {
  try {
    log(`Saving definition for tag: ${tagName}`, "info");

    const { error } = await supabase.from("tag_definitions").upsert(
      {
        user_id: userId,
        tag_name: tagName,
        definition: definition,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tag_name" },
    );

    if (error) {
      log(`Error saving tag definition: ${error.message}`, "error");
      return `Error saving tag definition: ${error.message}`;
    }

    log(`Saved definition for tag: ${tagName}`, "info");
    return `Successfully saved definition for tag "${tagName}".`;
  } catch (error) {
    return `Error saving tag definition: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

/**
 * Check if URL is a stock/placeholder image that should be skipped
 */
function isStockImageUrl(url: string): boolean {
  const stockDomains = [
    "unsplash.com",
    "images.unsplash.com",
    "pexels.com",
    "pixabay.com",
    "stock",
    "placeholder",
    "via.placeholder.com",
  ];
  return stockDomains.some((domain) => url.toLowerCase().includes(domain));
}

/**
 * Prepare image for multimodal analysis
 * Returns a marker that the conversation builder will detect and inject as inline_data
 */
export function analyzeImage(
  imageUrl: string,
  analysisFocus: string = "overview",
  tradeContext?: string,
): string {
  try {
    // Skip stock/placeholder images
    if (isStockImageUrl(imageUrl)) {
      log(`Skipping stock image: ${imageUrl.substring(0, 50)}...`, "info");
      return `This appears to be a stock/placeholder image (${
        imageUrl.substring(0, 30)
      }...) and not an actual trade chart. Skipping analysis. Please provide a real trade chart image for analysis.`;
    }

    log(
      `Preparing image for analysis: ${imageUrl.substring(0, 50)}...`,
      "info",
    );

    // Build analysis instruction based on focus
    const focusPrompts: Record<string, string> = {
      entry:
        "Focus on analyzing the entry point: Was the entry well-timed? What price action or patterns preceded the entry? Was there confluence?",
      exit:
        "Focus on analyzing the exit: Was the exit optimal? Was profit left on the table? Was the stop loss placement appropriate?",
      patterns:
        "Focus on identifying chart patterns: What patterns are visible (head & shoulders, flags, wedges, etc.)? Are there trend lines or channels?",
      levels:
        "Focus on support/resistance levels: Identify key horizontal levels, trend lines, and areas of interest. Where are the key decision points?",
      overview:
        "Provide a general analysis of this trade chart including: entry/exit quality, patterns, key levels, and any notable observations.",
    };

    const focusInstruction = focusPrompts[analysisFocus] ||
      focusPrompts.overview;
    const contextNote = tradeContext
      ? ` Trade context: "${tradeContext}".`
      : "";

    // Return marker with image URL - conversation builder will inject the actual image
    // The prompt tells the model to generate its own analysis (not return instructions)
    return `[IMAGE_ANALYSIS:${imageUrl}]
IMAGE LOADED SUCCESSFULLY. You are now viewing the chart image above.
${focusInstruction}${contextNote}
YOUR TASK: Analyze what you SEE in this image and respond with your findings (3-5 bullet points). Describe specific visual elements you observe: candlesticks, indicators, levels, patterns, entry/exit markers, platform UI, annotations, etc.`;
  } catch (error) {
    log(`Image preparation error: ${error}`, "error");
    return `Image analysis error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
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
      case "search_web": {
        const query = typeof args.query === "string" ? args.query : "";
        const searchType = typeof args.type === "string" ? args.type : "search";
        return await executeWebSearch(query, searchType);
      }

      case "scrape_url": {
        const url = typeof args.url === "string" ? args.url : "";
        return await scrapeUrl(url);
      }

      case "get_crypto_price": {
        const coinId = typeof args.coin_id === "string" ? args.coin_id : "";
        return await getCryptoPrice(coinId);
      }

      case "get_forex_price": {
        const baseCurrency = typeof args.base_currency === "string"
          ? args.base_currency
          : "";
        const quoteCurrency = typeof args.quote_currency === "string"
          ? args.quote_currency
          : "";
        return await getForexPrice(baseCurrency, quoteCurrency);
      }

      case "generate_chart": {
        const chartType = typeof args.chart_type === "string"
          ? args.chart_type
          : "line";
        const title = typeof args.title === "string" ? args.title : "Chart";
        const xLabel = typeof args.x_label === "string" ? args.x_label : "";
        const yLabel = typeof args.y_label === "string" ? args.y_label : "";
        const labels = Array.isArray(args.labels) ? args.labels : [];
        const datasets = Array.isArray(args.datasets) ? args.datasets : [];
        return await generateChart(
          chartType,
          title,
          xLabel,
          yLabel,
          labels,
          datasets,
        );
      }

      case "create_note": {
        if (!supabase) {
          return "Supabase client not available for note creation";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        const title = typeof args.title === "string" ? args.title : "";
        const content = typeof args.content === "string" ? args.content : "";
        const reminderType = typeof args.reminder_type === "string"
          ? args.reminder_type
          : undefined;
        const reminderDate = typeof args.reminder_date === "string"
          ? args.reminder_date
          : undefined;
        const reminderDays = Array.isArray(args.reminder_days)
          ? args.reminder_days
          : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;

        return await createNote(
          supabase,
          userId,
          calendarId,
          title,
          content,
          reminderType,
          reminderDate,
          reminderDays,
          tags,
        );
      }

      case "update_note": {
        if (!supabase) {
          return "Supabase client not available for note update";
        }
        const noteId = typeof args.note_id === "string" ? args.note_id : "";
        const title = typeof args.title === "string" ? args.title : undefined;
        const content = typeof args.content === "string"
          ? args.content
          : undefined;
        const reminderType = typeof args.reminder_type === "string"
          ? args.reminder_type
          : undefined;
        const reminderDate = typeof args.reminder_date === "string"
          ? args.reminder_date
          : undefined;
        const reminderDays = Array.isArray(args.reminder_days)
          ? args.reminder_days
          : undefined;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        return await updateNote(
          supabase,
          noteId,
          title,
          content,
          reminderType,
          reminderDate,
          reminderDays,
          tags,
        );
      }

      case "delete_note": {
        if (!supabase) {
          return "Supabase client not available for note deletion";
        }
        const noteId = typeof args.note_id === "string" ? args.note_id : "";
        return await deleteNote(supabase, noteId);
      }

      case "search_notes": {
        if (!supabase) {
          return "Supabase client not available for note search";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        const searchQuery = typeof args.search_query === "string"
          ? args.search_query
          : undefined;
        const includeArchived = typeof args.include_archived === "boolean"
          ? args.include_archived
          : false;
        const tags = Array.isArray(args.tags) ? args.tags : undefined;
        return await searchNotes(
          supabase,
          userId,
          calendarId,
          searchQuery,
          includeArchived,
          tags,
        );
      }

      case "analyze_image": {
        const imageUrl = typeof args.image_url === "string"
          ? args.image_url
          : "";
        const analysisFocus = typeof args.analysis_focus === "string"
          ? args.analysis_focus
          : "overview";
        const tradeContext = typeof args.trade_context === "string"
          ? args.trade_context
          : undefined;
        return analyzeImage(imageUrl, analysisFocus, tradeContext);
      }

      case "get_tag_definition": {
        if (!supabase) {
          return "Supabase client not available for tag lookup";
        }
        const userId = context.userId || "";
        const tagName = typeof args.tag_name === "string" ? args.tag_name : "";
        return await getTagDefinition(supabase, userId, tagName);
      }

      case "save_tag_definition": {
        if (!supabase) {
          return "Supabase client not available for saving tag definition";
        }
        const userId = context.userId || "";
        const tagName = typeof args.tag_name === "string" ? args.tag_name : "";
        const definition = typeof args.definition === "string"
          ? args.definition
          : "";
        return await saveTagDefinition(supabase, userId, tagName, definition);
      }

      case "update_memory": {
        if (!supabase) {
          return "Supabase client not available for memory update";
        }
        const userId = context.userId || "";
        const calendarId = context.calendarId || "";
        const section = typeof args.section === "string"
          ? args.section as
            | "TRADER_PROFILE"
            | "PERFORMANCE_PATTERNS"
            | "STRATEGY_PREFERENCES"
            | "LESSONS_LEARNED"
            | "ACTIVE_FOCUS"
          : "PERFORMANCE_PATTERNS";
        const newInsights = Array.isArray(args.new_insights)
          ? args.new_insights.map((i) => String(i))
          : [];
        const replaceSection = typeof args.replace_section === "boolean"
          ? args.replace_section
          : false;
        return await updateMemory(
          supabase,
          userId,
          calendarId,
          section,
          newInsights,
          replaceSection,
        );
      }

      default:
        return `Unknown custom tool: ${toolName}`;
    }
  } catch (error) {
    return `Tool execution error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
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
    searchNotesTool,
    analyzeImageTool,
    getTagDefinitionTool,
    saveTagDefinitionTool,
    updateMemoryTool,
  ];
}
