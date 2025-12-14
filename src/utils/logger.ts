/**
 * Simple log wrapper that can be toggled on/off
 * Provides consistent logging interface throughout the application
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
  timestamp: boolean;
}

class Logger {
  private config: LoggerConfig;
  private readonly STORAGE_KEY = 'app-logger-config';
  private readonly DEFAULT_CONFIG: LoggerConfig = {
    enabled: process.env.NODE_ENV === 'development', // Enable by default in development
    level: 'info',
    prefix: '[JournoTrades]',
    timestamp: true
  };

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from localStorage or use defaults
   */
  private loadConfig(): LoggerConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...this.DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      // Fallback to default if localStorage fails
    }
    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  /**
   * Check if logging is enabled for the given level
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.config.level];
  }

  /**
   * Format log message with prefix and timestamp
   */
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];
    
    if (this.config.timestamp) {
      parts.push(new Date().toISOString());
    }
    
    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }
    
    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * Debug level logging
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Log level logging (alias for info)
   */
  log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }

  /**
   * Warning level logging
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.saveConfig();
  }

  /**
   * Set log prefix
   */
  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
    this.saveConfig();
  }

  /**
   * Enable or disable timestamps
   */
  setTimestamp(enabled: boolean): void {
    this.config.timestamp = enabled;
    this.saveConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...this.DEFAULT_CONFIG };
    this.saveConfig();
  }

  /**
   * Check if logging is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience methods for direct use
export const log = logger.log.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);

// Export logger controls for settings/debug purposes
export const loggerControls = {
  enable: () => logger.setEnabled(true),
  disable: () => logger.setEnabled(false),
  setLevel: (level: LogLevel) => logger.setLevel(level),
  setPrefix: (prefix: string) => logger.setPrefix(prefix),
  setTimestamp: (enabled: boolean) => logger.setTimestamp(enabled),
  getConfig: () => logger.getConfig(),
  reset: () => logger.reset(),
  isEnabled: () => logger.isEnabled()
};

// Make logger available globally for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).logger = logger;
  (window as any).loggerControls = loggerControls;
}
