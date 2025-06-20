import {
  BlogPost,
  NewsApiResponse,
  BlogFilters,
  BlogCache,
  NewsSearchParams
} from '../../types/blog';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';

class NewsService {
  private cache: BlogCache;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cache = {
      posts: new Map(),
      lastFetched: new Map(),
      expiryTime: this.CACHE_DURATION
    };
    // Clear any existing cache on initialization
    this.clearCache();
  }



  /**
   * Convert Unix timestamp to Date object
   */
  private parseUnixTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  /**
   * Convert BlogFilters to NewsSearchParams for backend API calls
   */
  private convertFiltersToSearchParams(filters: BlogFilters): NewsSearchParams {
    const searchParams: NewsSearchParams = {};

    if (filters.searchQuery) {
      searchParams.query = filters.searchQuery;
    }

    if (filters.category) {
      searchParams.category = filters.category;
    }

    if (filters.dateRange) {
      searchParams.dateRange = {
        from: filters.dateRange.start.toISOString().split('T')[0], // YYYY-MM-DD format
        to: filters.dateRange.end.toISOString().split('T')[0]
      };
    }

    // Handle source filtering - convert NewsAPI source names to their IDs
    const allSources: string[] = [];

    // Handle single source (backward compatibility)
    if (filters.source) {
      const newsApiSources = this.getNewsApiSourceIds(filters.source);
      allSources.push(...newsApiSources);
    }

    // Handle multiple sources
    if (filters.sources && filters.sources.length > 0) {
      for (const source of filters.sources) {
        const newsApiSources = this.getNewsApiSourceIds(source);
        allSources.push(...newsApiSources);
      }
    }

    // Remove duplicates and set sources
    if (allSources.length > 0) {
      searchParams.sources = Array.from(new Set(allSources));
    }

    if (filters.tags && filters.tags.length > 0) {
      searchParams.topics = filters.tags;
    }

    if (filters.sortBy) {
      searchParams.sortBy = filters.sortBy;
    }

    // Set reasonable defaults
    searchParams.language = 'en';
    searchParams.pageSize = 100;

    return searchParams;
  }

  /**
   * Convert source names to NewsAPI source IDs
   * NewsAPI requires specific source IDs, not display names
   */
  private getNewsApiSourceIds(sourceName: string): string[] {
    // Map of display names to NewsAPI source IDs
    const sourceMapping: { [key: string]: string[] } = {
      'bloomberg': ['bloomberg'],
      'reuters': ['reuters'],
      'cnbc': ['cnbc'],
      'wall-street-journal': ['the-wall-street-journal'],
      'financial-times': ['financial-times'],
      'yahoo-finance': ['yahoo-finance'],
      'marketwatch': ['marketwatch'],
      'business-insider': ['business-insider'],
      'techcrunch': ['techcrunch'],
      'the-verge': ['the-verge'],
      'ars-technica': ['ars-technica'],
      'engadget': ['engadget'],
      'wired': ['wired'],
      'fortune': ['fortune'],
      'forbes': ['forbes'],
      'cnn-business': ['cnn'],
      'bbc-business': ['bbc-news'],
      'associated-press': ['associated-press'],
      'axios': ['axios'],
      'politico': ['politico']
    };

    const lowerSourceName = sourceName.toLowerCase();
    return sourceMapping[lowerSourceName] || [];
  }

  /**
   * Determine if enhanced search should be used based on filters
   */
  private shouldUseEnhancedSearch(filters?: BlogFilters): boolean {
    if (!filters) return false;

    // Use enhanced search if we have search query, specific source(s), or date range
    return !!(
      filters.searchQuery ||
      filters.source ||
      (filters.sources && filters.sources.length > 0) ||
      filters.dateRange
    );
  }

  /**
   * Fetch news using enhanced search via Cloud Functions
   */
  private async fetchNewsWithEnhancedSearch(filters: BlogFilters, page: number, pageSize: number): Promise<NewsApiResponse> {
    try {
      const searchParams = this.convertFiltersToSearchParams(filters);
      const fetchNewsFunction = httpsCallable(functions, 'fetchNewsV2');

      console.log('Using enhanced search with params:', searchParams);

      const result = await fetchNewsFunction({ searchParams });
      const response = result.data as NewsApiResponse;

      // Apply pagination to the results
      const offset = (page - 1) * pageSize;
      const paginatedArticles = response.articles.slice(offset, offset + pageSize);

      // Calculate pagination info
      const totalPages = Math.ceil(response.articles.length / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        ...response,
        articles: paginatedArticles,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize,
          totalItems: response.articles.length,
          hasNext: hasNextPage,
          hasPrev: hasPrevPage
        }
      };
    } catch (error) {
      console.error('Error with enhanced search, falling back to cached data:', error);
      throw error;
    }
  }

  /**
   * Fetch news from Firestore newsCache collection or use enhanced search
   */
  async fetchAllNews(filters?: BlogFilters, page: number = 1, pageSize: number = 20): Promise<NewsApiResponse> {
    try {
      // Use enhanced search for complex queries
      if (this.shouldUseEnhancedSearch(filters)) {
        try {
          return await this.fetchNewsWithEnhancedSearch(filters!, page, pageSize);
        } catch (enhancedSearchError) {
          console.warn('Enhanced search failed, falling back to Firestore:', enhancedSearchError);
          // Continue to Firestore fallback below
        }
      }

      // Fallback to direct Firestore access with client-side filtering
      const newsRef = collection(db, 'newsCache');
      const offset = (page - 1) * pageSize;

      const allDocsQuery = query(
        newsRef,
        orderBy('publishedAt', 'desc')
      );

      const allDocsSnapshot = await getDocs(allDocsQuery);
      const allArticles: BlogPost[] = [];

      allDocsSnapshot.forEach((doc) => {
        const data = doc.data();

        // Transform the Firestore document to BlogPost format
        const article: BlogPost = {
          id: doc.id,
          title: data.title ?? '',
          summary: data.summary ?? '',
          content: data.content ?? '',
          author: data.author ?? '',
          publishedAt: this.parseUnixTimestamp(data.publishedAt ?? Date.now()),
          updatedAt: this.parseUnixTimestamp(data.updatedAt ?? Date.now()),
          source: data.source ?? { id: 'unknown', name: 'Unknown', baseUrl: '', isActive: true, priority: 0, rateLimit: 0 },
          category: data.category ?? 'market_news',
          tags: data.tags ?? [],
          imageUrl: data.imageUrl ?? undefined,
          url: data.url ?? ''
        };

        allArticles.push(article);
      });

      // Apply filters to all articles first
      const filteredArticles = filters ?
        this.applyFilters(allArticles, filters) :
        allArticles;

      // Then apply pagination to filtered results
      const paginatedArticles = filteredArticles.slice(offset, offset + pageSize);

      // Cache articles locally for immediate access
      paginatedArticles.forEach(article => {
        this.cache.posts.set(article.id, article);
      });
      this.cache.lastFetched.set('firestore-direct', new Date());

      // Calculate pagination info
      const totalPages = Math.ceil(filteredArticles.length / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        status: 'success',
        totalResults: filteredArticles.length,
        articles: paginatedArticles,
        nextPageToken: hasNextPage ? `page-${page + 1}` : undefined,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize,
          totalItems: filteredArticles.length,
          hasNext: hasNextPage,
          hasPrev: hasPrevPage
        }
      };

    } catch (error) {
      console.error('Error fetching news:', error);

      // Fallback to local cache if available
      const cachedPosts = Array.from(this.cache.posts.values());
      if (cachedPosts.length > 0) {
        const filteredPosts = filters ? this.applyFilters(cachedPosts, filters) : cachedPosts;

        return {
          status: 'success',
          totalResults: filteredPosts.length,
          articles: filteredPosts,
          error: 'Using cached data due to network error'
        };
      }

      // Return error without fallback
      return {
        status: 'error',
        totalResults: 0,
        articles: [],
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}. Unable to fetch news.`
      };
    }
  }







  /**
   * Apply filters to posts
   */
  private applyFilters(posts: BlogPost[], filters: BlogFilters): BlogPost[] {
    let filtered = [...posts];

    if (filters.category) {
      filtered = filtered.filter(post => post.category === filters.category);
    }

    if (filters.source) {
      filtered = filtered.filter(post => post.source.id === filters.source);
    }

    if (filters.dateRange) {
      filtered = filtered.filter(post =>
        post.publishedAt >= filters.dateRange!.start &&
        post.publishedAt <= filters.dateRange!.end
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(post =>
        filters.tags!.some(tag => post.tags.includes(tag))
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.summary.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (filters.sortBy) {
          case 'publishedAt':
            aValue = a.publishedAt.getTime();
            bValue = b.publishedAt.getTime();
            break;
          default:
            return 0;
        }

        const result = aValue - bValue;
        return filters.sortOrder === 'desc' ? -result : result;
      });
    }

    return filtered;
  }



  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.posts.clear();
    this.cache.lastFetched.clear();
    // Also clear any localStorage cache that might contain sample posts
    try {
      localStorage.removeItem('blogCache');
      localStorage.removeItem('blogPosts');
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  /**
   * Get cached posts
   */
  getCachedPosts(): BlogPost[] {
    return Array.from(this.cache.posts.values());
  }


}

// Export singleton instance
export const newsService = new NewsService();
export default newsService;
