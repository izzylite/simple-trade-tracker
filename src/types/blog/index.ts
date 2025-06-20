// Blog post types and interfaces
export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  publishedAt: Date; // Will be converted from Unix timestamp
  updatedAt: Date; // Will be converted from Unix timestamp
  source: NewsSource;
  category: BlogCategory;
  tags: string[];
  imageUrl?: string;
  url: string;
}

// News source configuration
export interface NewsSource {
  id: string;
  name: string;
  baseUrl: string;
  logoUrl?: string;
  isActive: boolean;
  priority: number; // Higher priority sources appear first
  rateLimit: number; // requests per hour
  lastFetched?: Date;
  apiKey?: string;
  feedUrl?: string;
}

// Blog categories for organizing content
export enum BlogCategory {
  MARKET_NEWS = 'market_news',
  TRADING_STRATEGIES = 'trading_strategies',
  ECONOMIC_INDICATORS = 'economic_indicators',
  CRYPTOCURRENCY = 'cryptocurrency',
  FOREX = 'forex',
  STOCKS = 'stocks',
  COMMODITIES = 'commodities',
  ANALYSIS = 'analysis',
  EDUCATION = 'education',
  REGULATION = 'regulation'
}

// API response types
export interface NewsApiResponse {
  status: 'success' | 'error';
  totalResults: number;
  articles: BlogPost[];
  nextPageToken?: string;
  error?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface NewsSourceResponse {
  sources: NewsSource[];
  status: 'success' | 'error';
  error?: string;
}

// Filter and search types
export interface BlogFilters {
  category?: BlogCategory;
  source?: string; // Single source for backward compatibility
  sources?: string[]; // Multiple sources for enhanced search
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  searchQuery?: string;
  sortBy?: 'publishedAt';
  sortOrder?: 'asc' | 'desc';
}

// Enhanced search parameters for backend API calls
export interface NewsSearchParams {
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

// Pagination
export interface BlogPagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Blog state management
export interface BlogState {
  posts: BlogPost[];
  sources: NewsSource[];
  filters: BlogFilters;
  pagination: BlogPagination;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Cache types
export interface BlogCache {
  posts: Map<string, BlogPost>;
  lastFetched: Map<string, Date>; // source ID -> last fetch time
  expiryTime: number; // in milliseconds
}

// RSS Feed types
export interface RssFeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author?: string;
  category?: string;
  guid?: string;
  enclosure?: {
    url: string;
    type: string;
    length: number;
  };
}

export interface RssFeed {
  title: string;
  description: string;
  link: string;
  lastBuildDate: string;
  items: RssFeedItem[];
}

// News API specific types (for external APIs like NewsAPI, Alpha Vantage, etc.)
export interface ExternalNewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

// Configuration for news fetching
export interface NewsConfig {
  refreshInterval: number; // in minutes
  maxArticlesPerSource: number;
  enableAutoRefresh: boolean;
  enableNotifications: boolean;
  defaultCategory: BlogCategory;
  enabledSources: string[];
}

// Error types
export interface BlogError {
  code: string;
  message: string;
  source?: string;
  timestamp: Date;
}

// Analytics types
export interface BlogAnalytics {
  totalViews: number;
  popularPosts: BlogPost[];
  topCategories: { category: BlogCategory; count: number }[];
  readingTime: number; // average reading time
  engagementRate: number;
}

// Export utility type for component props
export type BlogComponentProps = {
  className?: string;
  style?: React.CSSProperties;
};
