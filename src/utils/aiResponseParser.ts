/**
 * AI Response Parser
 * Parses AI responses to detect and extract structured trade data for card display
 */

import { Trade } from '../types/dualWrite';

export interface DisplayItem {
  type: 'trade' | 'event';
  id: string;
}

export interface InlineReference {
  type: 'trade' | 'event';
  id: string;
  originalText: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedAIResponse {
  textContent: string;
  displayItems?: DisplayItem[];
  inlineReferences?: InlineReference[];
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
  let inlineReferences: InlineReference[] = [];
  let hasStructuredData = false;

  // Check for inline references first (trade_id:xxx, event_id:xxx)
  const inlineRefs = extractInlineReferences(response, allTrades);
  if (inlineRefs.length > 0) {
    inlineReferences = inlineRefs;
    hasStructuredData = true;
    // Don't modify textContent here - we'll handle replacement in the component
  }

  // Check for new JSON format in response (fallback for existing functionality)
  const jsonDisplayItems = extractDisplayItemsFromResponse(response, allTrades);
  if (jsonDisplayItems.length > 0) {
    displayItems = jsonDisplayItems;
    hasStructuredData = true;
    textContent = cleanJsonFromResponse(response);
  }

  return {
    textContent,
    displayItems,
    inlineReferences,
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
 * Extract inline references from AI response (trade_id:xxx, event_id:xxx)
 */
function extractInlineReferences(
  response: string,
  allTrades?: Trade[]
): InlineReference[] {
  const inlineReferences: InlineReference[] = [];

  // Pattern to match trade_id:xxx-xxx-xxx or event_id:xxx-xxx-xxx
  const inlinePattern = /(trade_id|event_id):([a-zA-Z0-9-_]+)/gi;
  let match;

  while ((match = inlinePattern.exec(response)) !== null) {
    const [fullMatch, typePrefix, id] = match;
    const type = typePrefix.toLowerCase() === 'trade_id' ? 'trade' : 'event';

    // Validate trade exists if it's a trade reference
    if (type === 'trade' && allTrades) {
      const tradeExists = allTrades.some(trade => trade.id === id);
      if (!tradeExists) {
        continue; // Skip invalid trade references
      }
    }

    inlineReferences.push({
      type,
      id,
      originalText: fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length
    });
  }

  return inlineReferences;
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