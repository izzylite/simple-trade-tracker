/**
 * API Key Management Service
 * Handles secure storage, validation, and management of AI provider API keys
 */

import { AIProvider, APIKeySettings, AI_PROVIDERS, ChatError } from '../types/aiChat';
import { logger } from '../utils/logger';

class APIKeyService {
  private readonly STORAGE_KEY = 'ai-chat-api-keys';
  private readonly ENCRYPTION_KEY = 'trade-tracker-ai-keys';
  
  /**
   * Simple encryption for localStorage (not cryptographically secure, but better than plain text)
   */
  private encrypt(text: string): string {
    try {
      // Simple XOR encryption with base64 encoding
      const key = this.ENCRYPTION_KEY;
      let encrypted = '';
      for (let i = 0; i < text.length; i++) {
        encrypted += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return btoa(encrypted);
    } catch (error) {
      logger.error('Error encrypting API key:', error);
      return text; // Fallback to plain text
    }
  }

  /**
   * Simple decryption for localStorage
   */
  private decrypt(encryptedText: string): string {
    try {
      const key = this.ENCRYPTION_KEY;
      const encrypted = atob(encryptedText);
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting API key:', error);
      return encryptedText; // Fallback to assuming it's plain text
    }
  }

  /**
   * Load all API keys from localStorage
   */
  loadAPIKeys(): Record<AIProvider, APIKeySettings> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultAPIKeys();
      }

      const parsed = JSON.parse(stored);
      const decrypted: Record<AIProvider, APIKeySettings> = {} as any;

      // Decrypt each API key
      for (const [provider, settings] of Object.entries(parsed)) {
        decrypted[provider as AIProvider] = {
          ...settings as APIKeySettings,
          apiKey: settings.apiKey ? this.decrypt(settings.apiKey) : '',
          lastValidated: settings.lastValidated ? new Date(settings.lastValidated) : undefined
        };
      }

      return { ...this.getDefaultAPIKeys(), ...decrypted };
    } catch (error) {
      logger.error('Error loading API keys:', error);
      return this.getDefaultAPIKeys();
    }
  }

  /**
   * Save API keys to localStorage with encryption
   */
  saveAPIKeys(apiKeys: Record<AIProvider, APIKeySettings>): void {
    try {
      const encrypted: Record<string, any> = {};

      // Encrypt each API key
      for (const [provider, settings] of Object.entries(apiKeys)) {
        encrypted[provider] = {
          ...settings,
          apiKey: settings.apiKey ? this.encrypt(settings.apiKey) : '',
          lastValidated: settings.lastValidated?.toISOString()
        };
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(encrypted));
      logger.log('API keys saved successfully');
    } catch (error) {
      logger.error('Error saving API keys:', error);
      throw new Error('Failed to save API keys');
    }
  }

  /**
   * Get default API key settings
   */
  private getDefaultAPIKeys(): Record<AIProvider, APIKeySettings> {
    const defaults: Record<AIProvider, APIKeySettings> = {} as any;
    
    for (const [provider, config] of Object.entries(AI_PROVIDERS)) {
      defaults[provider as AIProvider] = {
        provider: provider as AIProvider,
        apiKey: '',
        model: config.models[0]?.id || '',
        isValid: false,
        settings: {
          temperature: 0.7,
          maxTokens: 2000,
          topP: 1,
          frequencyPenalty: 0,
          presencePenalty: 0
        }
      };
    }

    return defaults;
  }

  /**
   * Validate an API key format
   */
  validateAPIKeyFormat(provider: AIProvider, apiKey: string): boolean {
    if (!apiKey.trim()) return false;
    
    const config = AI_PROVIDERS[provider];
    if (!config) return false;

    return config.apiKeyFormat.test(apiKey);
  }

  /**
   * Test an API key by making a simple API call
   */
  async testAPIKey(provider: AIProvider, apiKey: string, baseUrl?: string): Promise<{ isValid: boolean; error?: string }> {
    if (!this.validateAPIKeyFormat(provider, apiKey)) {
      return { isValid: false, error: 'Invalid API key format' };
    }

    const config = AI_PROVIDERS[provider];
    const url = (baseUrl || config.baseUrl) + config.testEndpoint;

    try {
      logger.log(`Testing API key for ${provider}...`);

      const headers: Record<string, string> = { ...config.headers };
      
      // Add authorization header based on provider
      switch (provider) {
        case 'openai':
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'anthropic':
          headers['x-api-key'] = apiKey;
          break;
        case 'google':
          // Google uses API key as query parameter
          break;
        case 'custom':
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
      }

      const testUrl = provider === 'google' ? `${url}?key=${apiKey}` : url;

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 401) {
        // 401 is expected for some test endpoints, it means the key format is correct
        return { isValid: response.ok };
      }

      return { 
        isValid: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };

    } catch (error) {
      logger.error(`Error testing API key for ${provider}:`, error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { isValid: false, error: 'Request timeout' };
        }
        return { isValid: false, error: error.message };
      }
      
      return { isValid: false, error: 'Unknown error occurred' };
    }
  }

  /**
   * Update API key settings for a provider
   */
  async updateAPIKey(provider: AIProvider, settings: Partial<APIKeySettings>): Promise<void> {
    const currentKeys = this.loadAPIKeys();
    
    currentKeys[provider] = {
      ...currentKeys[provider],
      ...settings,
      provider
    };

    // If API key is being updated, validate it
    if (settings.apiKey) {
      const validation = await this.testAPIKey(provider, settings.apiKey, settings.baseUrl);
      currentKeys[provider].isValid = validation.isValid;
      currentKeys[provider].lastValidated = new Date();
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'API key validation failed');
      }
    }

    this.saveAPIKeys(currentKeys);
  }

  /**
   * Get API key settings for a specific provider
   */
  getAPIKey(provider: AIProvider): APIKeySettings {
    const apiKeys = this.loadAPIKeys();
    return apiKeys[provider];
  }

  /**
   * Check if any valid API key is configured
   */
  hasValidAPIKey(): boolean {
    const apiKeys = this.loadAPIKeys();
    return Object.values(apiKeys).some(settings => settings.isValid && settings.apiKey);
  }

  /**
   * Get the first valid API key provider
   */
  getFirstValidProvider(): AIProvider | null {
    const apiKeys = this.loadAPIKeys();
    
    for (const [provider, settings] of Object.entries(apiKeys)) {
      if (settings.isValid && settings.apiKey) {
        return provider as AIProvider;
      }
    }
    
    return null;
  }

  /**
   * Remove API key for a provider
   */
  removeAPIKey(provider: AIProvider): void {
    const currentKeys = this.loadAPIKeys();
    currentKeys[provider] = {
      ...currentKeys[provider],
      apiKey: '',
      isValid: false,
      lastValidated: undefined
    };
    this.saveAPIKeys(currentKeys);
  }

  /**
   * Clear all API keys
   */
  clearAllAPIKeys(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    logger.log('All API keys cleared');
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: AIProvider): Array<{ id: string; name: string; description: string }> {
    const config = AI_PROVIDERS[provider];
    return config ? config.models : [];
  }

  /**
   * Validate API key and return appropriate error
   */
  validateAPIKeyWithError(provider: AIProvider, apiKey: string): ChatError | null {
    if (!apiKey.trim()) {
      return {
        type: 'api_key_invalid',
        message: 'API key is required',
        details: `Please configure your ${AI_PROVIDERS[provider]?.name || provider} API key`,
        retryable: false
      };
    }

    if (!this.validateAPIKeyFormat(provider, apiKey)) {
      return {
        type: 'api_key_invalid',
        message: 'Invalid API key format',
        details: `The API key format for ${AI_PROVIDERS[provider]?.name || provider} is incorrect`,
        retryable: false
      };
    }

    return null;
  }
}

// Export singleton instance
export const apiKeyService = new APIKeyService();
