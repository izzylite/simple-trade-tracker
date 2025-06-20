import {
  doc,
  getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';
import { NewsSource } from '../../types/blog';

interface SourcesResponse {
  status: 'success' | 'error';
  sources: NewsSource[];
  error?: string;
  lastUpdated?: number;
}

class SourcesService {
  private cache: {
    sources: NewsSource[];
    lastFetched: Date | null;
  };
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cache = {
      sources: [],
      lastFetched: null
    };
  }

  /**
   * Fetch news sources from Firestore newsMetadata collection
   */
  async fetchSources(useCache = true): Promise<SourcesResponse> {
    try {
      // Check cache first if enabled
      if (useCache && this.isCacheValid()) {
        return {
          status: 'success',
          sources: this.cache.sources
        };
      }

      // Query the newsMetadata/sources document
      const sourcesDocRef = doc(db, 'newsMetadata', 'sources');
      const sourcesDoc = await getDoc(sourcesDocRef);

      if (sourcesDoc.exists()) {
        const data = sourcesDoc.data();

        // Check if data has sources array (new format) or individual source objects (current format)
        let sources: NewsSource[] = [];

        if (data && data.sources && Array.isArray(data.sources)) {
          // New format: sources as array
          sources = data.sources.map((source: any) => ({
            id: source.id,
            name: source.name,
            baseUrl: source.url || '',
            isActive: source.isActive,
            priority: source.priority,
            rateLimit: source.rateLimit,
            lastFetched: source.lastFetched ? new Date(source.lastFetched.seconds * 1000) : undefined
          }));
        } else if (data) {
          // Current format: individual source objects as keys
          // Filter out non-source fields like lastUpdated
          const sourceKeys = Object.keys(data).filter(key =>
            key !== 'lastUpdated' &&
            typeof data[key] === 'object' &&
            data[key] !== null &&
            'lastFetched' in data[key]
          );

          // For now, create basic source objects from the keys
          // This is a temporary solution until the backend provides proper source metadata
          sources = sourceKeys.map(sourceId => ({
            id: sourceId,
            name: this.getSourceDisplayName(sourceId),
            baseUrl: '',
            isActive: true,
            priority: 1,
            rateLimit: 100,
            lastFetched: data[sourceId].lastFetched ? new Date(data[sourceId].lastFetched.seconds * 1000) : undefined
          }));
        }

        if (sources.length > 0) {
          // Update cache
          this.cache.sources = sources;
          this.cache.lastFetched = new Date();

          return {
            status: 'success',
            sources,
            lastUpdated: data.lastUpdated?.seconds ? data.lastUpdated.seconds * 1000 : Date.now()
          };
        }
      }

      // No sources found
      return {
        status: 'error',
        sources: [],
        error: 'No sources configuration found'
      };

    } catch (error) {
      console.error('Error fetching sources from Firestore:', error);

      // Fallback to cached sources if available
      if (this.cache.sources.length > 0) {
        return {
          status: 'success',
          sources: this.cache.sources,
          error: 'Using cached data due to network error'
        };
      }

      return {
        status: 'error',
        sources: [],
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}. Unable to fetch sources.`
      };
    }
  }

  /**
   * Get active sources only
   */
  async getActiveSources(useCache = true): Promise<NewsSource[]> {
    const response = await this.fetchSources(useCache);
    if (response.status === 'success') {
      return response.sources.filter(source => source.isActive);
    }
    return [];
  }

  /**
   * Get source by ID
   */
  async getSourceById(sourceId: string, useCache = true): Promise<NewsSource | null> {
    const response = await this.fetchSources(useCache);
    if (response.status === 'success') {
      return response.sources.find(source => source.id === sourceId) || null;
    }
    return null;
  }

  /**
   * Get display name for source ID
   */
  private getSourceDisplayName(sourceId: string): string {
    const displayNames: { [key: string]: string } = {
      'alpha-vantage-news': 'Alpha Vantage',
      'bloomberg-markets': 'Bloomberg Markets',
      'cnbc-rss': 'CNBC',
      'financial-times': 'Financial Times',
      'forex-factory': 'Forex Factory',
      'investing-com': 'Investing.com',
      'marketwatch-rss': 'MarketWatch',
      'newsapi-business': 'NewsAPI Business',
      'reuters-business': 'Reuters Business',
      'seeking-alpha': 'Seeking Alpha',
      'wall-street-journal': 'Wall Street Journal',
      'yahoo-finance': 'Yahoo Finance'
    };

    return displayNames[sourceId] || sourceId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Initialize sources by calling the Firebase function to populate newsMetadata
   */
  async initializeSources(): Promise<SourcesResponse> {
    try {
      // Call the fetchNewsV2 function which will initialize the newsMetadata collection
      const fetchNews = httpsCallable(functions, 'fetchNewsV2');
      await fetchNews();

      // Wait a moment for the data to be written to Firestore
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now try to fetch sources again
      return await this.fetchSources(false); // Don't use cache

    } catch (error) {
      return {
        status: 'error',
        sources: [],
        error: `Failed to initialize sources: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache.lastFetched || this.cache.sources.length === 0) {
      return false;
    }

    const now = new Date();
    const cacheAge = now.getTime() - this.cache.lastFetched.getTime();
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.sources = [];
    this.cache.lastFetched = null;
  }
}

// Create and export service instance
export const sourcesService = new SourcesService();
