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
      config.maxContextTrades = Math.max(10, Math.min(500, config.maxContextTrades));
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
    validated.maxContextTrades = Math.max(10, Math.min(500, validated.maxContextTrades));
    validated.maxSessionHistory = Math.max(5, Math.min(200, validated.maxSessionHistory));
    validated.sessionRetentionDays = Math.max(1, Math.min(365, validated.sessionRetentionDays));

    // Ensure boolean values
    validated.autoScroll = Boolean(validated.autoScroll);
    validated.showTokenCount = Boolean(validated.showTokenCount);
    validated.enableSyntaxHighlighting = Boolean(validated.enableSyntaxHighlighting);
    validated.includeRecentTrades = Boolean(validated.includeRecentTrades);
    validated.includeTagAnalysis = Boolean(validated.includeTagAnalysis);
    validated.includeEconomicEvents = Boolean(validated.includeEconomicEvents);
    validated.includeDetailedTrades = Boolean(validated.includeDetailedTrades);
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

  shouldIncludeDetailedTrades(): boolean {
    return this.config.includeDetailedTrades;
  }

  getMaxContextTrades(): number {
    return this.config.maxContextTrades;
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
    maxTrades: number;
    features: string[];
  } {
    const features: string[] = [];
    
    if (this.config.includeDetailedTrades) features.push('Detailed Trades');
    if (this.config.includeTagAnalysis) features.push('Tag Analysis');
    if (this.config.includeEconomicEvents) features.push('Economic Events');
    if (this.config.showTokenCount) features.push('Token Count');
    if (this.config.autoSaveSessions) features.push('Auto-save Sessions');

    return {
      provider: this.config.defaultProvider.toUpperCase(),
      model: this.config.defaultModel,
      maxTrades: this.config.maxContextTrades,
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
      current.includeRecentTrades !== defaults.includeRecentTrades ||
      current.includeTagAnalysis !== defaults.includeTagAnalysis ||
      current.includeEconomicEvents !== defaults.includeEconomicEvents ||
      current.includeDetailedTrades !== defaults.includeDetailedTrades ||
      current.maxContextTrades !== defaults.maxContextTrades ||
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

    if (this.config.includeDetailedTrades) {
      score += 3;
      factors.push('Detailed trade information');
    }

    if (this.config.maxContextTrades > 200) {
      score += 2;
      factors.push('High trade count limit');
      recommendations.push('Consider reducing max trades for better performance');
    }

    if (this.config.includeEconomicEvents) {
      score += 1;
      factors.push('Economic events analysis');
    }

    if (this.config.includeTagAnalysis) {
      score += 1;
      factors.push('Tag analysis');
    }

    if (score === 0) {
      recommendations.push('Current settings are optimized for performance');
    } else if (score > 5) {
      recommendations.push('Consider disabling some features for faster responses');
    }

    const level = score <= 2 ? 'low' : score <= 5 ? 'medium' : 'high';

    return { level, factors, recommendations };
  }
}

// Export singleton instance
export const aiChatConfigService = new AIChatConfigService();
