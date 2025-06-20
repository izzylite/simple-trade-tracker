import { newsService } from './newsService';
import { BlogFilters, NewsConfig } from '../../types/blog';

class AutoRefreshService {
  private intervalId: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;
  private refreshInterval: number = 5 * 60 * 1000; // 5 minutes default
  private onUpdate?: (silent: boolean) => void;
  private onError?: (error: string) => void;

  constructor() {
    // Load settings from localStorage
    this.loadSettings();
  }

  /**
   * Start auto-refresh with callback functions
   */
  start(
    onUpdate: (silent: boolean) => void,
    onError?: (error: string) => void,
    filters?: BlogFilters
  ): void {
    this.onUpdate = onUpdate;
    this.onError = onError;

    if (!this.isEnabled) return;

    // Clear existing interval
    this.stop();

    // Set up new interval
    this.intervalId = setInterval(async () => {
      try {
        await this.performRefresh(filters);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Auto-refresh failed';
        console.error('Auto-refresh error:', errorMessage);
        this.onError?.(errorMessage);
      }
    }, this.refreshInterval);

    console.log(`Auto-refresh started with ${this.refreshInterval / 1000}s interval`);
  }

  /**
   * Stop auto-refresh
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Auto-refresh stopped');
    }
  }

  /**
   * Perform a single refresh
   */
  private async performRefresh(filters?: BlogFilters): Promise<void> {
    if (!this.onUpdate) return;

    try {
      // Fetch latest news (first page only for auto-refresh)
      const response = await newsService.fetchAllNews(filters, 1, 20);

      if (response.status === 'success') {
        // Notify that update is available
        this.onUpdate(true); // silent = true for auto-refresh
      } else {
        throw new Error(response.error || 'Failed to fetch news');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update refresh interval
   */
  setRefreshInterval(intervalMs: number): void {
    this.refreshInterval = Math.max(60000, intervalMs); // Minimum 1 minute
    this.saveSettings();
    
    // Restart with new interval if currently running
    if (this.intervalId && this.onUpdate) {
      const currentOnUpdate = this.onUpdate;
      const currentOnError = this.onError;
      this.stop();
      this.start(currentOnUpdate, currentOnError);
    }
  }

  /**
   * Enable/disable auto-refresh
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.saveSettings();
    
    if (!enabled) {
      this.stop();
    } else if (this.onUpdate) {
      this.start(this.onUpdate, this.onError);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): { enabled: boolean; intervalMs: number } {
    return {
      enabled: this.isEnabled,
      intervalMs: this.refreshInterval
    };
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const settings = localStorage.getItem('blogAutoRefreshSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.isEnabled = parsed.enabled ?? true;
        this.refreshInterval = parsed.intervalMs ?? (5 * 60 * 1000);
      }
    } catch (error) {
      console.warn('Failed to load auto-refresh settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      const settings = {
        enabled: this.isEnabled,
        intervalMs: this.refreshInterval
      };
      localStorage.setItem('blogAutoRefreshSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save auto-refresh settings:', error);
    }
  }

  /**
   * Get available refresh intervals
   */
  static getAvailableIntervals(): { label: string; value: number }[] {
    return [
      { label: '1 minute', value: 60 * 1000 },
      { label: '2 minutes', value: 2 * 60 * 1000 },
      { label: '5 minutes', value: 5 * 60 * 1000 },
      { label: '10 minutes', value: 10 * 60 * 1000 },
      { label: '15 minutes', value: 15 * 60 * 1000 },
      { label: '30 minutes', value: 30 * 60 * 1000 },
      { label: '1 hour', value: 60 * 60 * 1000 }
    ];
  }

  /**
   * Check if browser supports background sync
   */
  static supportsBackgroundSync(): boolean {
    return 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype;
  }

  /**
   * Register for background sync (if supported)
   */
  async registerBackgroundSync(): Promise<void> {
    if (!AutoRefreshService.supportsBackgroundSync()) {
      console.warn('Background sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-ignore - Background sync API may not be fully typed
      await registration.sync.register('blog-news-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.warn('Failed to register background sync:', error);
    }
  }

  /**
   * Handle visibility change to pause/resume refresh
   */
  handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, stop auto-refresh to save resources
      this.stop();
    } else if (this.isEnabled && this.onUpdate) {
      // Page is visible again, restart auto-refresh
      this.start(this.onUpdate, this.onError);
      // Immediately refresh to get latest data
      this.onUpdate(true);
    }
  }

  /**
   * Initialize visibility change listener
   */
  initVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.onUpdate = undefined;
    this.onError = undefined;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}

// Export singleton instance
export const autoRefreshService = new AutoRefreshService();
export default autoRefreshService;
