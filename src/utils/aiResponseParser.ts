/**
 * AI Response Parser
 * Parses AI responses to detect and extract structured trade data for card display
 */

import { Trade } from '../types/trade';

export interface DisplayItem {
  type: 'trade' | 'event';
  id: string;
}

export interface ParsedAIResponse {
  textContent: string;
  displayItems?: DisplayItem[];
  hasStructuredData: boolean;
}


 

/**
 * Parse AI response to extract trade data and display items
 */
export function parseAIResponse(
  response: string,
  allTrades?: Trade[]
): ParsedAIResponse {
  let textContent = response;
  let displayItems: DisplayItem[] = [];
  let hasStructuredData = false;

  // Check for new JSON format in response
  const jsonDisplayItems = extractDisplayItemsFromResponse(response, allTrades);
  if (jsonDisplayItems.length > 0) {
    displayItems = jsonDisplayItems;
    hasStructuredData = true;
    textContent = cleanJsonFromResponse(response);
  }
 
  return {
    textContent,
    displayItems,
    hasStructuredData
  };
}

 
/**
 * Check if response contains display items JSON
 */
export function hasDisplayItems(response: string): boolean {
  const jsonPattern = /\[\s*\{[^}]*"type"\s*:\s*"(trade|event)"[^}]*"id"\s*:\s*"[^"]*"[^}]*\}[^\]]*\]/;
  return jsonPattern.test(response);
}



/**
 * Extract display items from AI response JSON
 */
function extractDisplayItemsFromResponse(
  response: string,
  allTrades?: Trade[]
): DisplayItem[] {
  const displayItems: DisplayItem[] = [];

  try {
    // Look for JSON array pattern at the end of the response
    const jsonPattern = /\[\s*\{[^}]*"type"\s*:\s*"(trade|event)"[^}]*"id"\s*:\s*"[^"]*"[^}]*\}[^\]]*\]/g;
    const matches = response.match(jsonPattern);

    if (matches) {
      for (const match of matches) {
        try {
          const items = JSON.parse(match) as DisplayItem[];
          if (Array.isArray(items)) {
            // Validate that the items exist in our data
            for (const item of items) {
              if (item.type === 'trade' && allTrades) {
                const tradeExists = allTrades.some(trade => trade.id === item.id);
                if (tradeExists) {
                  displayItems.push(item);
                }
              } else if (item.type === 'event') {
                // For events, we'll validate existence when displaying
                // Economic events are stored separately and fetched dynamically
                displayItems.push(item);
              }
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse display items JSON:', parseError);
        }
      }
    }
  } catch (error) {
    console.warn('Error extracting display items:', error);
  }

  return displayItems;
}

/**
 * Remove JSON display items from response text
 */
function cleanJsonFromResponse(response: string): string {
  // Remove JSON display items pattern
  let cleaned = response.replace(/\[\s*\{[^}]*"type"\s*:\s*"(trade|event)"[^}]*"id"\s*:\s*"[^"]*"[^}]*\}[^\]]*\]/g, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return cleaned;
}