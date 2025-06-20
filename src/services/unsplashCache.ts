interface UnsplashImage {
  id: string;
  urls: {
    small: string;
    regular: string;
    full: string;
  };
  links: {
    download_location: string;
    html: string;
  };
  alt_description: string;
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
}

interface CacheEntry {
  query: string;
  images: UnsplashImage[];
  timestamp: number;
  expiresAt: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
}

class UnsplashCacheService {
  private readonly CACHE_KEY = 'unsplash_image_cache';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cached queries
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes (rough estimate)

  /**
   * Get cached images for a query
   */
  getCachedImages(query: string): UnsplashImage[] | null {
    try {
      const cache = this.getCache();
      const normalizedQuery = this.normalizeQuery(query);
      const entry = cache[normalizedQuery];

      if (!entry) {
        return null;
      }

      // Check if cache entry has expired
      if (Date.now() > entry.expiresAt) {
        this.removeCacheEntry(normalizedQuery);
        return null;
      }

      // Update access time for LRU management
      entry.timestamp = Date.now();
      this.saveCache(cache);

      return entry.images;
    } catch (error) {
      console.warn('Error reading from Unsplash cache:', error);
      return null;
    }
  }

  /**
   * Cache images for a query
   */
  cacheImages(query: string, images: UnsplashImage[]): void {
    try {
      const cache = this.getCache();
      const normalizedQuery = this.normalizeQuery(query);
      const now = Date.now();

      // Create new cache entry
      const entry: CacheEntry = {
        query: normalizedQuery,
        images,
        timestamp: now,
        expiresAt: now + this.CACHE_DURATION
      };

      // Add to cache
      cache[normalizedQuery] = entry;

      // Clean up cache if needed
      this.cleanupCache(cache);

      // Save to localStorage
      this.saveCache(cache);
    } catch (error) {
      console.warn('Error saving to Unsplash cache:', error);
    }
  }

  /**
   * Check if a query is cached and not expired
   */
  isCached(query: string): boolean {
    const cached = this.getCachedImages(query);
    return cached !== null;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('Error clearing Unsplash cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    try {
      const cache = this.getCache();
      const entries = Object.values(cache);
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          totalSize: 0,
          oldestEntry: 0,
          newestEntry: 0
        };
      }

      const timestamps = entries.map(entry => entry.timestamp);
      const cacheString = JSON.stringify(cache);
      
      return {
        totalEntries: entries.length,
        totalSize: new Blob([cacheString]).size,
        oldestEntry: Math.min(...timestamps),
        newestEntry: Math.max(...timestamps)
      };
    } catch (error) {
      console.warn('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }

  /**
   * Remove expired entries from cache
   */
  removeExpiredEntries(): number {
    try {
      const cache = this.getCache();
      const now = Date.now();
      let removedCount = 0;

      Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
          delete cache[key];
          removedCount++;
        }
      });

      if (removedCount > 0) {
        this.saveCache(cache);
      }

      return removedCount;
    } catch (error) {
      console.warn('Error removing expired cache entries:', error);
      return 0;
    }
  }

  /**
   * Get popular/frequently searched queries from cache
   */
  getPopularQueries(limit: number = 5): string[] {
    try {
      const cache = this.getCache();
      const entries = Object.values(cache);
      
      // Sort by timestamp (most recently accessed first)
      entries.sort((a, b) => b.timestamp - a.timestamp);
      
      return entries
        .slice(0, limit)
        .map(entry => entry.query)
        .filter(query => query.length > 0);
    } catch (error) {
      console.warn('Error getting popular queries:', error);
      return [];
    }
  }

  // Private methods

  private getCache(): Record<string, CacheEntry> {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Error parsing cache data, clearing cache:', error);
      this.clearCache();
      return {};
    }
  }

  private saveCache(cache: Record<string, CacheEntry>): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        // Storage quota exceeded, clear some cache
        console.warn('Storage quota exceeded, cleaning cache...');
        this.aggressiveCleanup(cache);
        try {
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        } catch (retryError) {
          console.warn('Failed to save cache even after cleanup:', retryError);
        }
      } else {
        console.warn('Error saving cache:', error);
      }
    }
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private removeCacheEntry(query: string): void {
    try {
      const cache = this.getCache();
      delete cache[query];
      this.saveCache(cache);
    } catch (error) {
      console.warn('Error removing cache entry:', error);
    }
  }

  private cleanupCache(cache: Record<string, CacheEntry>): void {
    const entries = Object.entries(cache);
    
    // Remove expired entries first
    const now = Date.now();
    entries.forEach(([key, entry]) => {
      if (entry.expiresAt < now) {
        delete cache[key];
      }
    });

    // If still too many entries, remove oldest ones (LRU)
    const remainingEntries = Object.entries(cache);
    if (remainingEntries.length > this.MAX_CACHE_SIZE) {
      // Sort by timestamp (oldest first)
      remainingEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries
      const entriesToRemove = remainingEntries.length - this.MAX_CACHE_SIZE;
      for (let i = 0; i < entriesToRemove; i++) {
        delete cache[remainingEntries[i][0]];
      }
    }
  }

  private aggressiveCleanup(cache: Record<string, CacheEntry>): void {
    const entries = Object.entries(cache);
    
    // Keep only the most recent 25% of entries
    const keepCount = Math.floor(entries.length * 0.25);
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // Clear cache and keep only the newest entries
    Object.keys(cache).forEach(key => delete cache[key]);
    
    for (let i = 0; i < keepCount && i < entries.length; i++) {
      const [key, entry] = entries[i];
      cache[key] = entry;
    }
  }
}

// Export singleton instance
export const unsplashCache = new UnsplashCacheService();
export type { UnsplashImage };
