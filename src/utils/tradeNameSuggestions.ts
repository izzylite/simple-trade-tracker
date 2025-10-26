import { Trade } from '../types/dualWrite';

/**
 * Generate trade name suggestions based on past trades
 * @param allTrades Array of all trades
 * @param currentInput Current input value to filter suggestions
 * @param maxSuggestions Maximum number of suggestions to return
 * @returns Array of suggested trade names
 */
export const generateTradeNameSuggestions = (
  allTrades: Trade[],
  currentInput: string = '',
  maxSuggestions: number = 10
): string[] => {
  if (!allTrades || allTrades.length === 0) {
    return [];
  }

  // Extract all unique trade names from past trades
  const tradeNames = allTrades
    .map(trade => trade.name)
    .filter((name): name is string => Boolean(name && name.trim()))
    .map(name => name.trim())
    .filter(name => name !== 'New Trade') // Exclude default temporary names
    .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates

  // If no input, return most frequently used names
  if (!currentInput.trim()) {
    // Count frequency of each trade name
    const nameFrequency = new Map<string, number>();
    tradeNames.forEach(name => {
      nameFrequency.set(name, (nameFrequency.get(name) || 0) + 1);
    });

    // Sort by frequency (most used first) and return top suggestions
    return Array.from(nameFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, maxSuggestions);
  }

  // Filter names that match the current input (case-insensitive)
  const inputLower = currentInput.toLowerCase();
  const matchingNames = tradeNames.filter(name =>
    name.toLowerCase().includes(inputLower)
  );

  // Sort matching names by relevance:
  // 1. Exact matches first
  // 2. Names that start with the input
  // 3. Names that contain the input
  const exactMatches = matchingNames.filter(name => 
    name.toLowerCase() === inputLower
  );
  
  const startsWithMatches = matchingNames.filter(name => 
    name.toLowerCase().startsWith(inputLower) && 
    name.toLowerCase() !== inputLower
  );
  
  const containsMatches = matchingNames.filter(name => 
    name.toLowerCase().includes(inputLower) && 
    !name.toLowerCase().startsWith(inputLower)
  );

  // Combine and limit results
  const suggestions = [
    ...exactMatches,
    ...startsWithMatches,
    ...containsMatches
  ].slice(0, maxSuggestions);

  return suggestions;
};

/**
 * Generate smart trade name suggestions based on current trade context
 * @param allTrades Array of all trades
 * @param currentTags Current trade tags
 * @param currentSession Current trade session
 * @param currentInput Current input value
 * @param maxSuggestions Maximum number of suggestions to return
 * @returns Array of contextual trade name suggestions
 */
export const generateContextualTradeNameSuggestions = (
  allTrades: Trade[],
  currentTags: string[] = [],
  currentSession?: string,
  currentInput: string = '',
  maxSuggestions: number = 8
): string[] => {
  if (!allTrades || allTrades.length === 0) {
    return generateTradeNameSuggestions(allTrades, currentInput, maxSuggestions);
  }

  // Find trades with similar context (same tags or session)
  const contextualTrades = allTrades.filter(trade => {
    if (!trade.name || trade.name.trim() === '' || trade.name === 'New Trade') {
      return false;
    }

    // Check for matching tags
    const hasMatchingTags = currentTags.length > 0 && trade.tags && 
      trade.tags.some(tag => currentTags.includes(tag));

    // Check for matching session
    const hasMatchingSession = currentSession && trade.session === currentSession;

    return hasMatchingTags || hasMatchingSession;
  });

  // If we have contextual trades, prioritize their names
  if (contextualTrades.length > 0) {
    const contextualNames = generateTradeNameSuggestions(
      contextualTrades, 
      currentInput, 
      Math.ceil(maxSuggestions * 0.7) // 70% of suggestions from contextual trades
    );

    // Fill remaining slots with general suggestions
    const remainingSlots = maxSuggestions - contextualNames.length;
    if (remainingSlots > 0) {
      const generalNames = generateTradeNameSuggestions(
        allTrades, 
        currentInput, 
        remainingSlots
      ).filter(name => !contextualNames.includes(name)); // Avoid duplicates

      return [...contextualNames, ...generalNames];
    }

    return contextualNames;
  }

  // Fallback to general suggestions
  return generateTradeNameSuggestions(allTrades, currentInput, maxSuggestions);
};

/**
 * Generate common trade name patterns based on currency pairs and strategies
 * @param currentInput Current input value
 * @returns Array of common trade name patterns
 */
export const generateCommonTradeNamePatterns = (currentInput: string = ''): string[] => {
  const commonPatterns = [
    // Currency pairs
    'EURUSD Long',
    'EURUSD Short',
    'GBPUSD Long',
    'GBPUSD Short',
    'USDJPY Long',
    'USDJPY Short',
    'AUDUSD Long',
    'AUDUSD Short',
    'USDCAD Long',
    'USDCAD Short',
    'NZDUSD Long',
    'NZDUSD Short',
    'EURJPY Long',
    'EURJPY Short',
    'GBPJPY Long',
    'GBPJPY Short',
    
    // Strategy patterns
    'Breakout Trade',
    'Reversal Trade',
    'Trend Following',
    'Support Bounce',
    'Resistance Rejection',
    'News Trade',
    'Scalp Trade',
    'Swing Trade',
    'Range Trade',
    'Momentum Trade'
  ];

  if (!currentInput.trim()) {
    return commonPatterns.slice(0, 5); // Return first 5 if no input
  }

  const inputLower = currentInput.toLowerCase();
  return commonPatterns
    .filter(pattern => pattern.toLowerCase().includes(inputLower))
    .slice(0, 5);
};