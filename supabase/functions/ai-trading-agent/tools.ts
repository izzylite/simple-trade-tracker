/**
 * AI Trading Agent - Tool Definitions and Implementations
 * All custom tools (non-MCP) are defined and implemented here
 */

import { log } from '../_shared/supabase.ts';

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
  description: 'Generate a chart visualization from data. Use this after querying trade data via MCP tools to create visual representations like equity curves, P&L over time, or performance metrics.',
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

    return `Chart generated successfully!\n\nTitle: ${title}\nChart URL: ${chartUrl}\n\nYou can view this chart by opening the URL in a browser.`;
  } catch (error) {
    return `Chart generation error: ${error instanceof Error ? error.message : 'Unknown'}`;
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
  args: Record<string, unknown>
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
    generateChartTool
  ];
}
