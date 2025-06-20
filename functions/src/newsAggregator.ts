import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import axios from 'axios';
import Parser from 'rss-parser';

// Define environment parameters for v2
const alphaVantageKey = defineString('ALPHA_VANTAGE_KEY', { default: '' });
const newsApiKey = defineString('NEWSAPI_KEY', { default: '' });

// Types for news aggregation
interface NewsSearchCapabilities {
  supportsKeywordSearch: boolean;
  supportsCategoryFilter: boolean;
  supportsDateRange: boolean;
  supportsSourceFilter: boolean;
  supportsTickerSearch?: boolean;
  supportsTopicFilter?: boolean;
  maxPageSize: number;
  searchEndpoints?: {
    everything?: string;
    headlines?: string;
  };
}

interface NewsSource {
  id: string;
  name: string;
  type: 'rss' | 'api' | 'scrape';
  url: string;
  apiKey?: string;
  priority: number;
  category: string;
  isActive: boolean;
  rateLimit: number;
  lastFetched?: Date;
  searchCapabilities?: NewsSearchCapabilities;
}

interface NewsSearchParams {
  query?: string;
  category?: string;
  dateRange?: {
    from: string; // ISO date string
    to: string;   // ISO date string
  };
  sources?: string[];
  tickers?: string[];
  topics?: string[];
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt' | 'latest';
  language?: string;
  pageSize?: number;
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  publishedAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  source: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  category: string;
  tags: string[];
  imageUrl?: string;
  url: string;

}

interface NewsApiResponse {
  status: 'success' | 'error';
  totalResults: number;
  articles: NewsArticle[];
  error?: string;
  lastUpdated: number; // Unix timestamp
}

class NewsAggregatorService {
  private readonly rssParser: Parser;
  private readonly MAX_ARTICLES_PER_SOURCE = 10; // Reduced from 20
  private readonly REQUEST_TIMEOUT = 8000; // Reduced from 10 seconds
  private readonly CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // Cleanup every 6 hours
  private lastCleanupTime = 0;

  constructor() {
    this.rssParser = new Parser({
      timeout: this.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Trade Calendar News Aggregator 1.0'
      }
    });
  }

  /**
   * Get default news sources configuration (for initialization)
   */
  private getDefaultNewsSources(): NewsSource[] {
    return [
      {
        id: 'marketwatch-rss',
        name: 'MarketWatch',
        type: 'rss',
        url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
        priority: 1,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'reuters-business',
        name: 'Reuters Business',
        type: 'rss',
        url: 'https://www.reuters.com/arc/outboundfeeds/rss/category/business/?outputType=xml',
        priority: 2,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'yahoo-finance',
        name: 'Yahoo Finance',
        type: 'rss',
        url: 'https://finance.yahoo.com/news/rssindex',
        priority: 3,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'cnbc-rss',
        name: 'CNBC',
        type: 'rss',
        url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
        priority: 4,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'newsapi-business',
        name: 'NewsAPI Business',
        type: 'api',
        url: 'https://newsapi.org/v2/top-headlines',
        apiKey: newsApiKey.value(),
        priority: 5,
        category: 'market_news',
        isActive: !!newsApiKey.value(),
        rateLimit: 1000,
        searchCapabilities: {
          supportsKeywordSearch: true,
          supportsCategoryFilter: true,
          supportsDateRange: true,
          supportsSourceFilter: true,
          maxPageSize: 100,
          searchEndpoints: {
            everything: 'https://newsapi.org/v2/everything',
            headlines: 'https://newsapi.org/v2/top-headlines'
          }
        }
      },
      {
        id: 'alpha-vantage-news',
        name: 'Alpha Vantage News',
        type: 'api',
        url: 'https://www.alphavantage.co/query',
        apiKey: alphaVantageKey.value(),
        priority: 6,
        category: 'market_news',
        isActive: !!alphaVantageKey.value(),
        rateLimit: 500,
        searchCapabilities: {
          supportsKeywordSearch: true,
          supportsCategoryFilter: false,
          supportsDateRange: true,
          supportsSourceFilter: false,
          supportsTickerSearch: true,
          supportsTopicFilter: true,
          maxPageSize: 1000
        }
      },
      // Additional RSS Sources
      {
        id: 'bloomberg-markets',
        name: 'Bloomberg Markets',
        type: 'rss',
        url: 'https://feeds.bloomberg.com/markets/news.rss',
        priority: 7,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'financial-times',
        name: 'Financial Times',
        type: 'rss',
        url: 'https://www.ft.com/rss/home',
        priority: 8,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'seeking-alpha',
        name: 'Seeking Alpha',
        type: 'rss',
        url: 'https://seekingalpha.com/feed.xml',
        priority: 9,
        category: 'market_analysis',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'investing-com',
        name: 'Investing.com',
        type: 'rss',
        url: 'https://www.investing.com/rss/news.rss',
        priority: 10,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'wall-street-journal',
        name: 'Wall Street Journal',
        type: 'rss',
        url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
        priority: 11,
        category: 'market_news',
        isActive: true,
        rateLimit: 100
      },
      {
        id: 'forex-factory',
        name: 'Forex Factory',
        type: 'rss',
        url: 'https://www.forexfactory.com/rss.php',
        priority: 12,
        category: 'forex_news',
        isActive: true,
        rateLimit: 100
      }
    ];
  }

  /**
   * Get news sources from Firestore (with fallback to defaults)
   */
  private async getNewsSources(): Promise<NewsSource[]> {
    try {
      const sourcesDoc = await admin.firestore()
        .collection('newsMetadata')
        .doc('sources')
        .get();

      if (sourcesDoc.exists) {
        const data = sourcesDoc.data();
        if (data && data.sources && Array.isArray(data.sources)) {
          console.log(`Loaded ${data.sources.length} sources from Firestore`);
          return data.sources;
        }
      }

      // If no sources in Firestore, initialize with defaults
      console.log('No sources found in Firestore, initializing with defaults');
      const defaultSources = this.getDefaultNewsSources();
      await this.saveSourcesConfiguration(defaultSources);
      return defaultSources;
    } catch (error) {
      console.error('Error loading sources from Firestore, using defaults:', error);
      return this.getDefaultNewsSources();
    }
  }

  /**
   * Save sources configuration to Firestore
   */
  private async saveSourcesConfiguration(sources: NewsSource[]): Promise<void> {
    try {
      await admin.firestore()
        .collection('newsMetadata')
        .doc('sources')
        .set({
          sources,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      console.log(`Saved ${sources.length} sources to Firestore`);
    } catch (error) {
      console.error('Error saving sources configuration:', error);
    }
  }

  /**
   * Fetch articles from RSS feed
   */
  private async fetchFromRss(source: NewsSource): Promise<NewsArticle[]> {
    try {
      const feed = await this.rssParser.parseURL(source.url);

      const articles: NewsArticle[] = [];
      const items = feed.items.slice(0, this.MAX_ARTICLES_PER_SOURCE);

      for (const item of items) {
        try {
          const article = await this.transformRssItemToArticle(item, source);
          articles.push(article);
        } catch (error) {
          // Skip failed items silently to reduce logging
          continue;
        }
      }

      return articles;
    } catch (error) {
      console.error(`Error fetching RSS from ${source.name}:`, error);
      return [];
    }
  }

  /**
   * Fetch articles from NewsAPI with enhanced search capabilities
   */
  private async fetchFromNewsApi(source: NewsSource, searchParams?: NewsSearchParams): Promise<NewsArticle[]> {
    if (!source.apiKey) {
      return [];
    }

    try {
      // Choose endpoint based on search requirements
      const useEverythingEndpoint = searchParams?.query || searchParams?.dateRange || searchParams?.sources;
      const endpoint = useEverythingEndpoint
        ? 'https://newsapi.org/v2/everything'
        : 'https://newsapi.org/v2/top-headlines';

      const params: any = {
        apiKey: source.apiKey,
        pageSize: searchParams?.pageSize || source.searchCapabilities?.maxPageSize || this.MAX_ARTICLES_PER_SOURCE,
        language: searchParams?.language || 'en'
      };

      // Add search parameters based on capabilities
      if (searchParams?.query && source.searchCapabilities?.supportsKeywordSearch) {
        params.q = searchParams.query;
      }

      if (searchParams?.category && source.searchCapabilities?.supportsCategoryFilter) {
        params.category = searchParams.category;
      } else if (!useEverythingEndpoint) {
        // Default to business for top-headlines if no category specified
        params.category = 'business';
      }

      if (searchParams?.dateRange && source.searchCapabilities?.supportsDateRange) {
        params.from = searchParams.dateRange.from;
        params.to = searchParams.dateRange.to;
      }

      if (searchParams?.sources && source.searchCapabilities?.supportsSourceFilter) {
        params.sources = searchParams.sources.join(',');
      }

      if (searchParams?.sortBy) {
        if (useEverythingEndpoint) {
          // Everything endpoint supports relevancy, popularity, publishedAt
          params.sortBy = searchParams.sortBy === 'latest' ? 'publishedAt' : searchParams.sortBy;
        }
        // Top-headlines are already sorted by relevancy/popularity
      }

      // For top-headlines endpoint, add country
      if (!useEverythingEndpoint) {
        params.country = 'us';
      }

      console.log(`Fetching from NewsAPI ${useEverythingEndpoint ? 'everything' : 'top-headlines'} with params:`, params);

      const response = await axios.get(endpoint, {
        params,
        timeout: this.REQUEST_TIMEOUT
      });

      if (response.data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${response.data.message}`);
      }

      const articles: NewsArticle[] = [];
      for (const item of response.data.articles) {
        try {
          const article = await this.transformNewsApiItemToArticle(item, source);
          articles.push(article);
        } catch (error) {
          continue;
        }
      }

      console.log(`NewsAPI returned ${articles.length} articles`);
      return articles;
    } catch (error) {
      console.error(`Error fetching from NewsAPI:`, error);
      return [];
    }
  }

  /**
   * Fetch articles from Alpha Vantage with enhanced search capabilities
   */
  private async fetchFromAlphaVantage(source: NewsSource, searchParams?: NewsSearchParams): Promise<NewsArticle[]> {
    if (!source.apiKey) {
      console.warn(`No API key for Alpha Vantage`);
      return [];
    }

    try {
      const params: any = {
        function: 'NEWS_SENTIMENT',
        apikey: source.apiKey,
        limit: searchParams?.pageSize || source.searchCapabilities?.maxPageSize || this.MAX_ARTICLES_PER_SOURCE
      };

      // Add ticker search if supported and provided
      if (searchParams?.tickers && source.searchCapabilities?.supportsTickerSearch) {
        params.tickers = searchParams.tickers.join(',');
      }

      // Add topic filtering if supported and provided
      if (searchParams?.topics && source.searchCapabilities?.supportsTopicFilter) {
        params.topics = searchParams.topics.join(',');
      } else {
        // Default topics for financial news
        params.topics = 'financial_markets,economy_fiscal,economy_monetary,technology,earnings';
      }

      // Add date range if supported
      if (searchParams?.dateRange && source.searchCapabilities?.supportsDateRange) {
        // Alpha Vantage expects format: YYYYMMDDTHHMM
        const fromDate = new Date(searchParams.dateRange.from);
        const toDate = new Date(searchParams.dateRange.to);

        params.time_from = fromDate.toISOString().replace(/[-:]/g, '').slice(0, 13) + '00';
        params.time_to = toDate.toISOString().replace(/[-:]/g, '').slice(0, 13) + '00';
      }

      // Add sorting if supported
      if (searchParams?.sortBy && source.searchCapabilities?.supportsKeywordSearch) {
        params.sort = searchParams.sortBy === 'latest' || searchParams.sortBy === 'publishedAt'
          ? 'LATEST'
          : 'RELEVANCE';
      } else {
        params.sort = 'LATEST';
      }

      console.log(`Fetching from Alpha Vantage with params:`, params);

      const response = await axios.get(source.url, {
        params,
        timeout: this.REQUEST_TIMEOUT
      });

      if (!response.data.feed) {
        throw new Error(`Invalid Alpha Vantage response`);
      }

      const articles: NewsArticle[] = [];
      for (const item of response.data.feed) {
        try {
          const article = await this.transformAlphaVantageItemToArticle(item, source);
          articles.push(article);
        } catch (error) {
          continue;
        }
      }

      console.log(`Alpha Vantage returned ${articles.length} articles`);
      return articles;
    } catch (error) {
      console.error(`Error fetching from Alpha Vantage:`, error);
      return [];
    }
  }

  /**
   * Transform RSS item to NewsArticle
   */
  private async transformRssItemToArticle(item: any, source: NewsSource): Promise<NewsArticle> {
    const content = item.content || item.description || item.summary || '';
    const plainContent = this.stripHtml(content);
    const summary = this.generateSummary(plainContent, 200);
    
    return {
      id: this.generateArticleId(item.link || item.guid, source.id),
      title: item.title || 'Untitled',
      summary,
      content: plainContent,
      author: item.creator || item.author || source.name,
      publishedAt: this.parsePublishedDate(undefined, item),
      updatedAt: Date.now(),
      source: {
        id: source.id,
        name: source.name
      },
      category: this.categorizeContent(item.title || '', content),
      tags: this.extractTags(item.title + ' ' + content),
      imageUrl: this.extractImageUrl(item),
      url: item.link || item.guid || ''
    };
  }

  /**
   * Transform NewsAPI item to NewsArticle
   */
  private async transformNewsApiItemToArticle(item: any, source: NewsSource): Promise<NewsArticle> {
    const content = item.content || item.description || '';
    const plainContent = this.stripHtml(content);
    const summary = this.generateSummary(plainContent, 200);
    
    return {
      id: this.generateArticleId(item.url, source.id),
      title: item.title || 'Untitled',
      summary,
      content: plainContent,
      author: item.author || item.source?.name || source.name,
      publishedAt: this.parsePublishedDate(item.publishedAt, item),
      updatedAt: Date.now(),
      source: {
        id: source.id,
        name: source.name
      },
      category: this.categorizeContent(item.title || '', content),
      tags: this.extractTags(item.title + ' ' + content),
      imageUrl: item.urlToImage,
      url: item.url || ''
    };
  }

  /**
   * Transform Alpha Vantage item to NewsArticle
   */
  private async transformAlphaVantageItemToArticle(item: any, source: NewsSource): Promise<NewsArticle> {
    const content = item.summary || '';
    const plainContent = this.stripHtml(content);
    const summary = this.generateSummary(plainContent, 200);
    
    return {
      id: this.generateArticleId(item.url, source.id),
      title: item.title || 'Untitled',
      summary,
      content: plainContent,
      author: item.authors?.[0] || source.name,
      publishedAt: this.parsePublishedDate(item.time_published, item),
      updatedAt: Date.now(),
      source: {
        id: source.id,
        name: source.name
      },
      category: this.categorizeContent(item.title || '', content),
      tags: this.extractTags(item.title + ' ' + content),
      imageUrl: item.banner_image,
      url: item.url || ''
    };
  }

  /**
   * Utility methods
   */
  private parsePublishedDate(dateString?: string, item?: any): number {
    // Try multiple date fields and formats
    const possibleDates = [
      dateString,
      item?.pubDate,
      item?.isoDate,
      item?.date,
      item?.published,
      item?.publishedAt,
      item?.time_published
    ].filter(Boolean);

    for (const dateStr of possibleDates) {
      if (!dateStr) continue;

      try {
        const parsed = new Date(dateStr);
        // Check if the date is valid
        if (!isNaN(parsed.getTime())) {
          const timestamp = parsed.getTime();
          console.log(`Successfully parsed date: ${dateStr} -> ${parsed.toISOString()} (${timestamp})`);
          return timestamp;
        }
      } catch (error) {
        console.warn(`Failed to parse date: ${dateStr}`, error);
        continue;
      }
    }

    // If no valid date found, use a realistic fallback with more variation
    console.warn(`No valid date found, using fallback. Tried: ${possibleDates.join(', ')}`);

    // Generate more varied fallback dates (from 30 minutes to 7 days ago)
    const randomMinutes = Math.floor(Math.random() * 10080) + 30; // 30 minutes to 7 days in minutes
    const fallbackTimestamp = Date.now() - (randomMinutes * 60 * 1000);

    console.log(`Using fallback timestamp: ${fallbackTimestamp} (${new Date(fallbackTimestamp).toISOString()}, ${randomMinutes} minutes ago)`);
    return fallbackTimestamp;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private generateSummary(content: string, maxLength: number): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let summary = '';

    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
    }

    return summary.trim() || content.substring(0, maxLength) + '...';
  }

  private generateArticleId(url: string, sourceId: string): string {
    const combined = `${sourceId}-${url}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `article-${Math.abs(hash).toString(36)}`;
  }

  private categorizeContent(title: string, content: string): string {
    const text = (title + ' ' + content).toLowerCase();

    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum')) {
      return 'cryptocurrency';
    }
    if (text.includes('forex') || text.includes('currency') || text.includes('exchange rate')) {
      return 'forex';
    }
    if (text.includes('stock') || text.includes('equity') || text.includes('shares')) {
      return 'stocks';
    }
    if (text.includes('commodity') || text.includes('gold') || text.includes('oil')) {
      return 'commodities';
    }
    if (text.includes('fed') || text.includes('interest rate') || text.includes('inflation')) {
      return 'economic_indicators';
    }
    if (text.includes('strategy') || text.includes('trading') || text.includes('investment')) {
      return 'trading_strategies';
    }
    if (text.includes('regulation') || text.includes('sec') || text.includes('compliance')) {
      return 'regulation';
    }
    if (text.includes('analysis') || text.includes('forecast') || text.includes('outlook')) {
      return 'analysis';
    }

    return 'market_news';
  }

  private extractTags(content: string): string[] {
    const text = content.toLowerCase();
    const tags: string[] = [];

    const tagPatterns = [
      { pattern: /\b(trading|trade|trader)\b/, tag: 'trading' },
      { pattern: /\b(market|markets)\b/, tag: 'market' },
      { pattern: /\b(stock|stocks|equity)\b/, tag: 'stocks' },
      { pattern: /\b(crypto|bitcoin|ethereum|blockchain)\b/, tag: 'cryptocurrency' },
      { pattern: /\b(forex|currency|fx)\b/, tag: 'forex' },
      { pattern: /\b(fed|federal reserve|interest rate)\b/, tag: 'federal-reserve' },
      { pattern: /\b(inflation|cpi|ppi)\b/, tag: 'inflation' },
      { pattern: /\b(earnings|revenue|profit)\b/, tag: 'earnings' },
      { pattern: /\b(analysis|forecast|outlook)\b/, tag: 'analysis' },
      { pattern: /\b(investment|investing|investor)\b/, tag: 'investment' }
    ];

    for (const { pattern, tag } of tagPatterns) {
      if (pattern.test(text)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  private extractImageUrl(item: any): string | undefined {
    // Try different possible image fields
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    if (item['media:thumbnail']?.url) {
      return item['media:thumbnail'].url;
    }
    if (item['media:content']?.url) {
      return item['media:content'].url;
    }
    if (item.image?.url) {
      return item.image.url;
    }
    return undefined;
  }





  /**
   * Main aggregation method with enhanced search capabilities
   */
  async aggregateNews(searchParams?: NewsSearchParams): Promise<NewsApiResponse> {
    try {
      const allSources = await this.getNewsSources();
      const sources = allSources.filter(source => source.isActive);
      const allArticles: NewsArticle[] = [];
      const errors: string[] = [];
      const sourceUpdates: { [key: string]: any } = {};

      console.log(`Starting news aggregation from ${sources.length} sources`);

      // Process sources in smaller batches to reduce concurrent load
      const BATCH_SIZE = 3;
      for (let i = 0; i < sources.length; i += BATCH_SIZE) {
        const batch = sources.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (source: NewsSource) => {
          try {
            let articles: NewsArticle[] = [];

            switch (source.type) {
              case 'rss':
                articles = await this.fetchFromRss(source);
                // Apply client-side filtering for RSS sources if search params provided
                if (searchParams) {
                  articles = this.filterArticlesClientSide(articles, searchParams);
                }
                break;
              case 'api':
                if (source.id.includes('newsapi')) {
                  articles = await this.fetchFromNewsApi(source, searchParams);
                } else if (source.id.includes('alpha-vantage')) {
                  articles = await this.fetchFromAlphaVantage(source, searchParams);
                }
                break;
              default:
                console.warn(`Unknown source type: ${source.type}`);
            }

            allArticles.push(...articles);

            // Collect source updates for batch write
            sourceUpdates[source.id] = {
              lastFetched: admin.firestore.FieldValue.serverTimestamp()
            };

          } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
            errors.push(`Failed to fetch from ${source.name}: ${error}`);
          }
        });

        await Promise.allSettled(batchPromises);

        // Small delay between batches to prevent overwhelming external APIs
        if (i + BATCH_SIZE < sources.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Batch update all source timestamps in a single operation
      if (Object.keys(sourceUpdates).length > 0) {
        await this.batchUpdateSourceTimestamps(sourceUpdates);
      }

      // Remove duplicates and sort
      const uniqueArticles = this.removeDuplicates(allArticles);
      const sortedArticles = uniqueArticles.sort((a, b) =>
        b.publishedAt - a.publishedAt
      );

      console.log(`News aggregation completed: ${sortedArticles.length} unique articles`);

      return {
        status: 'success',
        totalResults: sortedArticles.length,
        articles: sortedArticles,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        lastUpdated: Date.now()
      };

    } catch (error) {
      console.error('Error in news aggregation:', error);
      return {
        status: 'error',
        totalResults: 0,
        articles: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: Date.now()
      };
    }
  }

  private removeDuplicates(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = `${article.title}-${article.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Apply client-side filtering for RSS sources that don't support server-side search
   */
  public filterArticlesClientSide(articles: NewsArticle[], searchParams: NewsSearchParams): NewsArticle[] {
    let filtered = [...articles];

    // Apply keyword search
    if (searchParams.query) {
      const query = searchParams.query.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (searchParams.category) {
      filtered = filtered.filter(article => article.category === searchParams.category);
    }

    // Apply date range filter
    if (searchParams.dateRange) {
      const fromDate = new Date(searchParams.dateRange.from).getTime();
      const toDate = new Date(searchParams.dateRange.to).getTime();
      filtered = filtered.filter(article =>
        article.publishedAt >= fromDate && article.publishedAt <= toDate
      );
    }

    // Apply topic filter (check against tags)
    if (searchParams.topics && searchParams.topics.length > 0) {
      filtered = filtered.filter(article =>
        searchParams.topics!.some(topic =>
          article.tags.some(tag => tag.toLowerCase().includes(topic.toLowerCase()))
        )
      );
    }

    return filtered;
  }

  /**
   * Batch update source timestamps to reduce Firebase writes
   */
  private async batchUpdateSourceTimestamps(sourceUpdates: { [key: string]: any }): Promise<void> {
    try {
      await admin.firestore()
        .collection('newsMetadata')
        .doc('sources')
        .set(sourceUpdates, { merge: true });
      console.log(`Updated timestamps for ${Object.keys(sourceUpdates).length} sources`);
    } catch (error) {
      console.warn(`Failed to batch update source timestamps:`, error);
    }
  }

  /**
   * Cache articles in Firestore - optimized to avoid duplicate writes
   */
  async cacheArticles(articles: NewsArticle[]): Promise<void> {
    try {
      const cacheRef = admin.firestore().collection('newsCache');

      // Only cleanup if enough time has passed
      const now = Date.now();
      if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
        await this.cleanupOldArticles(cacheRef);
        this.lastCleanupTime = now;
      }

      // Check which articles already exist to avoid unnecessary writes
      const existingArticleIds = await this.getExistingArticleIds(cacheRef, articles.map(a => a.id));
      const newArticles = articles.filter(article => !existingArticleIds.has(article.id));

      if (newArticles.length === 0) {
        console.log('No new articles to cache');
        return;
      }

      // Batch write only new articles
      const batch = admin.firestore().batch();
      newArticles.forEach(article => {
        const docRef = cacheRef.doc(article.id);
        batch.set(docRef, {
          ...article,
          // Ensure no undefined values for Firestore
          imageUrl: article.imageUrl || null,
          cachedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`Cached ${newArticles.length} new articles (${articles.length - newArticles.length} already existed)`);
    } catch (error) {
      console.error('Error caching articles:', error);
    }
  }

  /**
   * Get existing article IDs to avoid duplicate writes
   */
  private async getExistingArticleIds(cacheRef: admin.firestore.CollectionReference, articleIds: string[]): Promise<Set<string>> {
    try {
      // Split into batches of 10 (Firestore 'in' query limit)
      const existingIds = new Set<string>();
      const BATCH_SIZE = 10;

      for (let i = 0; i < articleIds.length; i += BATCH_SIZE) {
        const batch = articleIds.slice(i, i + BATCH_SIZE);
        const snapshot = await cacheRef
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .select() // Only get document IDs, not full data
          .get();

        snapshot.docs.forEach(doc => existingIds.add(doc.id));
      }

      return existingIds;
    } catch (error) {
      console.warn('Error checking existing articles, proceeding with all writes:', error);
      return new Set();
    }
  }

  /**
   * Clean up old articles - optimized to be less aggressive
   */
  private async cleanupOldArticles(cacheRef: admin.firestore.CollectionReference): Promise<void> {
    try {
      // More conservative cleanup - keep articles for 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Only cleanup articles older than 7 days
      const totalDeletedCount = await this.cleanupByField(cacheRef, 'publishedAt', sevenDaysAgo.getTime(), 'published');

      if (totalDeletedCount > 0) {
        console.log(`Cleanup completed: ${totalDeletedCount} old articles removed`);
      }
    } catch (error) {
      console.error('Error cleaning up old articles:', error);
    }
  }

  /**
   * Clean up articles by a specific field - optimized with smaller batches
   */
  private async cleanupByField(
    cacheRef: admin.firestore.CollectionReference,
    field: string,
    cutoffValue: Date | number,
    description: string
  ): Promise<number> {
    let deletedCount = 0;
    const MAX_CLEANUP_PER_RUN = 100; // Limit cleanup to reduce Firebase operations

    try {
      // Query for old articles with smaller limit
      const oldCacheQuery = await cacheRef
        .where(field, '<', cutoffValue)
        .limit(MAX_CLEANUP_PER_RUN)
        .get();

      if (oldCacheQuery.empty) {
        return 0;
      }

      // Create batch for deletion
      const deleteBatch = admin.firestore().batch();
      oldCacheQuery.docs.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });

      // Commit the deletion batch
      await deleteBatch.commit();
      deletedCount = oldCacheQuery.docs.length;

      console.log(`Deleted ${deletedCount} old articles by ${description} date`);

    } catch (error) {
      console.error(`Error in cleanup for ${description} field:`, error);
    }

    return deletedCount;
  }

  /**
   * Get cached articles from Firestore
   */
  async getCachedArticles(): Promise<NewsArticle[]> {
    try {
      console.log('Getting cached articles with improved date handling');
      const cacheRef = admin.firestore().collection('newsCache');
      const snapshot = await cacheRef
        .orderBy('publishedAt', 'desc')
        .limit(100)
        .get();

      const articles: NewsArticle[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Data should already contain Unix timestamps
        articles.push({
          ...data,
          publishedAt: data.publishedAt || Date.now(),
          updatedAt: data.updatedAt || Date.now()
        } as NewsArticle);
      });

      return articles;
    } catch (error) {
      console.error('Error getting cached articles:', error);
      return [];
    }
  }
}

// Create service instance
const newsAggregator = new NewsAggregatorService();

/**
 * Cloud Function: Fetch news on-demand - optimized
 */
export const fetchNewsV2 = onCall({
  cors: true,
  timeoutSeconds: 180, // Reduced from 5 minutes to 3 minutes
  memory: '512MiB' // Reduced memory allocation
}, async (request) => {
  try {
    console.log('Starting news fetch request with search params:', request.data);

    // Check if user is authenticated (optional for news)
    const isAuthenticated = !!request.auth;
    console.log(`Request authenticated: ${isAuthenticated}`);

    // Extract search parameters from request data
    const searchParams: NewsSearchParams | undefined = request.data?.searchParams;

    // Get fresh news with search parameters
    const newsResponse = await newsAggregator.aggregateNews(searchParams);

    // Cache the articles for future requests
    if (newsResponse.status === 'success' && newsResponse.articles.length > 0) {
      await newsAggregator.cacheArticles(newsResponse.articles);
    }

    return newsResponse;
  } catch (error) {
    console.error('Error in fetchNews function:', error);
    throw new HttpsError('internal', 'Failed to fetch news');
  }
});

/**
 * Cloud Function: Get cached news (faster response)
 */
export const getCachedNewsV2 = onCall({
  cors: true,
  timeoutSeconds: 60
}, async (request) => {
  try {
    console.log('Getting cached news with search params:', request.data);

    const cachedArticles = await newsAggregator.getCachedArticles();

    // Apply client-side filtering to cached articles if search params provided
    let filteredArticles = cachedArticles;
    const searchParams: NewsSearchParams | undefined = request.data?.searchParams;

    if (searchParams) {
      filteredArticles = newsAggregator.filterArticlesClientSide(cachedArticles, searchParams);
    }

    return {
      status: 'success',
      totalResults: filteredArticles.length,
      articles: filteredArticles,
      lastUpdated: Date.now(),
      fromCache: true
    } as NewsApiResponse;
  } catch (error) {
    console.error('Error in getCachedNews function:', error);
    throw new HttpsError('internal', 'Failed to get cached news');
  }
});

/**
 * Scheduled Function: Auto-refresh news every 2 hours (optimized frequency)
 */
export const autoRefreshNewsV2 = onSchedule({
  schedule: 'every 2 hours',
  timeZone: 'America/New_York',
  memory: '512MiB' // Reduced memory allocation
}, async (_event) => {
  try {
    console.log('Starting scheduled news refresh');

    const newsResponse = await newsAggregator.aggregateNews();

    if (newsResponse.status === 'success' && newsResponse.articles.length > 0) {
      await newsAggregator.cacheArticles(newsResponse.articles);
      console.log(`Scheduled refresh completed: ${newsResponse.articles.length} articles cached`);
    } else {
      console.warn('Scheduled refresh failed or returned no articles');
    }
  } catch (error) {
    console.error('Error in scheduled news refresh:', error);
  }
});
