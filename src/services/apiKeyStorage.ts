/**
 * API Key Storage Service
 * Handles secure storage and retrieval of user's Gemini API key in localStorage
 */

const STORAGE_KEY = 'gemini_api_key';
const ENCRYPTION_KEY = 'tradejourno_encrypt_v1'; // Simple obfuscation key

/**
 * Simple XOR-based obfuscation (not true encryption, but better than plain text)
 * For production, consider using Web Crypto API for proper encryption
 */
function obfuscate(text: string): string {
  if (!text) return '';
  
  const result = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    result.push(String.fromCharCode(charCode));
  }
  
  // Base64 encode to make it safe for localStorage
  return btoa(result.join(''));
}

/**
 * Reverse the obfuscation
 */
function deobfuscate(obfuscated: string): string {
  if (!obfuscated) return '';
  
  try {
    // Base64 decode
    const decoded = atob(obfuscated);
    
    const result = [];
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result.push(String.fromCharCode(charCode));
    }
    
    return result.join('');
  } catch (error) {
    console.error('Error deobfuscating API key:', error);
    return '';
  }
}

/**
 * Save API key to localStorage (obfuscated)
 */
export function saveApiKey(apiKey: string): void {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key cannot be empty');
  }
  
  const trimmedKey = apiKey.trim();
  const obfuscated = obfuscate(trimmedKey);
  localStorage.setItem(STORAGE_KEY, obfuscated);
}

/**
 * Get API key from localStorage (deobfuscated)
 */
export function getApiKey(): string | null {
  const obfuscated = localStorage.getItem(STORAGE_KEY);
  if (!obfuscated) return null;
  
  const deobfuscated = deobfuscate(obfuscated);
  return deobfuscated || null;
}

/**
 * Remove API key from localStorage
 */
export function removeApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if API key exists in localStorage
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Validate API key format (basic check)
 * Gemini API keys typically start with "AIza" and are 39 characters long
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  const trimmedKey = apiKey.trim();
  
  // Basic format validation for Google API keys
  // They typically start with "AIza" and are 39 characters
  return trimmedKey.startsWith('AIza') && trimmedKey.length === 39;
}

/**
 * Mask API key for display (show first 8 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '••••••••••••';
  
  const start = apiKey.substring(0, 8);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = '•'.repeat(Math.max(0, apiKey.length - 12));
  
  return `${start}${middle}${end}`;
}

/**
 * Test API key by making a simple request to Gemini API
 */
export async function testApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!isValidApiKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format. Expected format: AIza...' };
  }
  
  try {
    // Make a minimal request to Gemini API to test the key
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'test' }]
          }]
        })
      }
    );
    
    if (response.ok) {
      return { valid: true };
    } else if (response.status === 429) {
      // Rate limited - but key format is valid if we got this far
      return {
        valid: true,
        error: 'Rate limited (key is valid but too many requests). Try again in a few moments.'
      };
    } else if (response.status === 400) {
      const data = await response.json();
      return { valid: false, error: data.error?.message || 'Invalid API key' };
    } else if (response.status === 403) {
      return { valid: false, error: 'API key is invalid or does not have permission' };
    } else {
      return { valid: false, error: `API returned status ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

