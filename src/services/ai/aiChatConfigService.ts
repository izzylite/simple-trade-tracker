/**
 * AI Chat Configuration Service
 * Manages AI chat settings persistence and validation
 */

import { AIChatConfig, DEFAULT_AI_CHAT_CONFIG } from '../../types/aiChat';
import { logger } from '../../utils/logger';

class AIChatConfigService {
  private readonly STORAGE_KEY = 'ai-chat-config';
  private config: AIChatConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from localStorage
   */
  loadConfig(): AIChatConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_AI_CHAT_CONFIG };
      }

      const parsed = JSON.parse(stored);
      
      // Validate and merge with defaults to ensure all properties exist
      const config: AIChatConfig = {
        ...DEFAULT_AI_CHAT_CONFIG,
        ...parsed
      };

      // Validate ranges and constraints
      config.maxSessionHistory = Math.max(5, Math.min(200, config.maxSessionHistory));
      config.sessionRetentionDays = Math.max(1, Math.min(365, config.sessionRetentionDays));

      logger.log('AI chat configuration loaded');
      return config;
    } catch (error) {
      logger.error('Error loading AI chat configuration:', error);
      return { ...DEFAULT_AI_CHAT_CONFIG };
    }
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig(config: AIChatConfig): void {
    try {
      // Validate configuration before saving
      const validatedConfig = this.validateConfig(config);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validatedConfig));
      this.config = validatedConfig;
      
      logger.log('AI chat configuration saved');
    } catch (error) {
      logger.error('Error saving AI chat configuration:', error);
      throw new Error('Failed to save AI chat configuration');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIChatConfig {
    return { ...this.config };
  }

  /**
   * Update specific configuration properties
   */
  updateConfig(updates: Partial<AIChatConfig>): void {
    const newConfig = { ...this.config, ...updates };
    this.saveConfig(newConfig);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.saveConfig({ ...DEFAULT_AI_CHAT_CONFIG });
  }

  /**
   * Validate configuration values
   */
  private validateConfig(config: AIChatConfig): AIChatConfig {
    const validated = { ...config };

    // Validate numeric ranges
    validated.maxSessionHistory = Math.max(5, Math.min(200, validated.maxSessionHistory));
    validated.sessionRetentionDays = Math.max(1, Math.min(365, validated.sessionRetentionDays));

    // Ensure boolean values
    validated.autoScroll = Boolean(validated.autoScroll);
    validated.showTokenCount = Boolean(validated.showTokenCount);
    validated.enableSyntaxHighlighting = Boolean(validated.enableSyntaxHighlighting);
    validated.autoSaveSessions = Boolean(validated.autoSaveSessions);

    return validated;
  }

  /**
   * Get configuration for specific features
   */
  shouldShowTokenCount(): boolean {
    return this.config.showTokenCount;
  }

  shouldAutoScroll(): boolean {
    return this.config.autoScroll;
  }

  shouldAutoSaveSessions(): boolean {
    return this.config.autoSaveSessions;
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(jsonConfig: string): boolean {
    try {
      const parsed = JSON.parse(jsonConfig);
      this.saveConfig(parsed);
      return true;
    } catch (error) {
      logger.error('Error importing AI chat configuration:', error);
      return false;
    }
  }

  /**
   * Get configuration summary for display
   */
  getConfigSummary(): {
    provider: string;
    model: string;
    features: string[];
  } {
    const features: string[] = [];

    if (this.config.showTokenCount) features.push('Token Count');
    if (this.config.autoSaveSessions) features.push('Auto-save Sessions');
    if (this.config.enableSyntaxHighlighting) features.push('Syntax Highlighting');
    if (this.config.autoScroll) features.push('Auto-scroll');

    return {
      provider: this.config.defaultProvider.toUpperCase(),
      model: this.config.defaultModel,
      features
    };
  }

  /**
   * Check if configuration has been customized from defaults
   */
  isCustomized(): boolean {
    const defaults = DEFAULT_AI_CHAT_CONFIG;
    const current = this.config;

    return (
      current.defaultProvider !== defaults.defaultProvider ||
      current.defaultModel !== defaults.defaultModel ||
      current.autoScroll !== defaults.autoScroll ||
      current.showTokenCount !== defaults.showTokenCount ||
      current.enableSyntaxHighlighting !== defaults.enableSyntaxHighlighting ||
      current.maxSessionHistory !== defaults.maxSessionHistory ||
      current.autoSaveSessions !== defaults.autoSaveSessions ||
      current.sessionRetentionDays !== defaults.sessionRetentionDays
    );
  }

  /**
   * Get performance impact assessment
   */
  getPerformanceImpact(): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendations: string[];
  } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (this.config.maxSessionHistory > 100) {
      score += 1;
      factors.push('Large session history');
      recommendations.push('Consider reducing session history for better performance');
    }

    if (this.config.enableSyntaxHighlighting) {
      score += 1;
      factors.push('Syntax highlighting enabled');
    }

    if (score === 0) {
      factors.push('Minimal configuration');
      recommendations.push('Current settings are optimized for performance');
    }

    const level = score <= 1 ? 'low' : score <= 2 ? 'medium' : 'high';

    return { level, factors, recommendations };
  }
}

// Export singleton instance
export const aiChatConfigService = new AIChatConfigService();
