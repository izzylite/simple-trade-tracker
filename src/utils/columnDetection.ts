/**
 * Column Detection Utility
 * Auto-detects column mappings from file headers
 */

import { TradeField, ColumnMapping, ColumnSuggestion } from '../types/import';

/**
 * Mapping patterns for each trade field
 * Key: TradeField, Value: array of patterns to match (case-insensitive)
 */
const FIELD_PATTERNS: Record<TradeField, string[]> = {
  trade_date: [
    'date',
    'trade date',
    'trade_date',
    'tradedate',
    'day',
    'timestamp',
    'time',
    'executed',
    'execution date',
    'entry date'
  ],
  amount: [
    'amount',
    'p&l',
    'pnl',
    'profit',
    'loss',
    'profit/loss',
    'profit loss',
    'net',
    'net amount',
    'result',
    'pl'
  ],
  trade_type: [
    'type',
    'trade type',
    'trade_type',
    'tradetype',
    'result',
    'outcome',
    'status',
    'win/loss',
    'win loss'
  ],
  name: [
    'name',
    'trade name',
    'trade_name',
    'tradename',
    'title',
    'symbol',
    'ticker',
    'instrument',
    'asset',
    'pair',
    'description'
  ],
  entry_price: [
    'entry',
    'entry price',
    'entry_price',
    'entryprice',
    'buy price',
    'buy',
    'open price',
    'open',
    'purchase price',
    'in',
    'entry point'
  ],
  exit_price: [
    'exit',
    'exit price',
    'exit_price',
    'exitprice',
    'sell price',
    'sell',
    'close price',
    'close',
    'sale price',
    'out',
    'exit point'
  ],
  stop_loss: [
    'stop loss',
    'stop_loss',
    'stoploss',
    'sl',
    's/l',
    's.l',
    'stop',
    'stop price'
  ],
  take_profit: [
    'take profit',
    'take_profit',
    'takeprofit',
    'tp',
    't/p',
    't.p',
    'target',
    'target price',
    'profit target'
  ],
  risk_to_reward: [
    'risk to reward',
    'risk_to_reward',
    'risktoreward',
    'r:r',
    'rr',
    'r/r',
    'r2r',
    'risk reward',
    'risk:reward',
    'reward risk',
    'reward:risk'
  ],
  partials_taken: [
    'partials',
    'partials taken',
    'partials_taken',
    'partial',
    'partial profit',
    'scaled out',
    'scale out',
    'partials_out'
  ],
  session: [
    'session',
    'trading session',
    'market session',
    'time session',
    'period',
    'shift'
  ],
  notes: [
    'notes',
    'note',
    'comments',
    'comment',
    'description',
    'details',
    'remarks',
    'memo',
    'observations'
  ],
  tags: [
    'tags',
    'tag',
    'categories',
    'category',
    'labels',
    'label',
    'keywords'
  ],
  images: [
    'images',
    'image',
    'imgs',
    'img',
    'pictures',
    'picture',
    'photos',
    'photo',
    'screenshots',
    'screenshot',
    'image url',
    'image urls',
    'image_url',
    'image_urls',
    'imageurl',
    'imageurls'
  ]
};

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance normalized
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Levenshtein distance
  const matrix: number[][] = [];
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  return 1 - distance / maxLength;
}

/**
 * Find the best matching trade field for a file column
 */
function findBestFieldMatch(fileColumn: string): { field: TradeField | null; confidence: number; reason: string } {
  let bestMatch: TradeField | null = null;
  let highestScore = 0;
  let matchReason = '';

  const normalizedColumn = fileColumn.toLowerCase().trim();

  // Check each field's patterns
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      const similarity = calculateSimilarity(normalizedColumn, pattern);

      if (similarity > highestScore) {
        highestScore = similarity;
        bestMatch = field as TradeField;
        matchReason = similarity === 1 ? 'exact match' : similarity >= 0.8 ? 'contains match' : 'similar match';
      }
    }
  }

  // Only return match if confidence is reasonable
  const confidenceThreshold = 0.6;
  if (highestScore < confidenceThreshold) {
    return { field: null, confidence: 0, reason: 'no clear match found' };
  }

  return {
    field: bestMatch,
    confidence: Math.round(highestScore * 100),
    reason: matchReason
  };
}

/**
 * Auto-detect column mappings from file columns
 */
export function detectColumnMapping(fileColumns: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedFields = new Set<TradeField>();

  for (const fileColumn of fileColumns) {
    const { field, confidence, reason } = findBestFieldMatch(fileColumn);

    // If we found a match and it hasn't been used yet
    if (field && !usedFields.has(field)) {
      mappings.push({
        fileColumn,
        target: field,
        confidence,
        autoDetected: true
      });
      usedFields.add(field);
    } else {
      // No match or duplicate - don't map by default
      mappings.push({
        fileColumn,
        target: 'ignore',
        confidence: 0,
        autoDetected: false
      });
    }
  }

  return mappings;
}

/**
 * Get suggestions for unmapped columns
 */
export function getSuggestedMapping(fileColumn: string, alreadyMappedFields: TradeField[]): ColumnSuggestion {
  const { field, confidence, reason } = findBestFieldMatch(fileColumn);

  // If field is already mapped, don't suggest it
  if (field && alreadyMappedFields.includes(field)) {
    return {
      fileColumn,
      suggestedField: null,
      confidence: 0,
      reason: 'field already mapped'
    };
  }

  return {
    fileColumn,
    suggestedField: field,
    confidence,
    reason
  };
}

/**
 * Analyze sample data to help with field detection
 * Returns enhanced suggestions based on data patterns
 */
export function analyzeColumnData(
  fileColumn: string,
  sampleValues: any[]
): {
  likelyType: 'date' | 'number' | 'string' | 'boolean' | 'unknown';
  suggestedField: TradeField | null;
  confidence: number;
} {
  // Filter out null/undefined values
  const validValues = sampleValues.filter(v => v !== null && v !== undefined && v !== '');

  if (validValues.length === 0) {
    return {
      likelyType: 'unknown',
      suggestedField: null,
      confidence: 0
    };
  }

  // Analyze data types
  let dateCount = 0;
  let numberCount = 0;
  let booleanCount = 0;
  let stringCount = 0;

  for (const value of validValues) {
    if (typeof value === 'number' || !isNaN(parseFloat(String(value)))) {
      numberCount++;
    } else if (value instanceof Date || !isNaN(Date.parse(String(value)))) {
      dateCount++;
    } else if (typeof value === 'boolean' || ['true', 'false', 'yes', 'no', '1', '0'].includes(String(value).toLowerCase())) {
      booleanCount++;
    } else {
      stringCount++;
    }
  }

  const total = validValues.length;
  let likelyType: 'date' | 'number' | 'string' | 'boolean' | 'unknown';

  // Determine most likely type (need >70% confidence)
  if (dateCount / total > 0.7) {
    likelyType = 'date';
  } else if (numberCount / total > 0.7) {
    likelyType = 'number';
  } else if (booleanCount / total > 0.7) {
    likelyType = 'boolean';
  } else if (stringCount / total > 0.7) {
    likelyType = 'string';
  } else {
    likelyType = 'unknown';
  }

  // Get base field suggestion
  const { field: suggestedField, confidence } = findBestFieldMatch(fileColumn);

  // Boost confidence if data type matches expected field type
  let adjustedConfidence = confidence;
  if (suggestedField) {
    const expectedTypes: Record<TradeField, Array<'date' | 'number' | 'string' | 'boolean'>> = {
      trade_date: ['date'],
      amount: ['number'],
      trade_type: ['string'],
      name: ['string'],
      entry_price: ['number'],
      exit_price: ['number'],
      stop_loss: ['number'],
      take_profit: ['number'],
      risk_to_reward: ['number'],
      partials_taken: ['boolean'],
      session: ['string'],
      notes: ['string'],
      tags: ['string'],
      images: ['string']
    };

    const expectedType = expectedTypes[suggestedField];
    if (expectedType && likelyType !== 'unknown' && expectedType.includes(likelyType)) {
      adjustedConfidence = Math.min(100, adjustedConfidence + 20);
    }
  }

  return {
    likelyType,
    suggestedField,
    confidence: adjustedConfidence
  };
}

/**
 * Get confidence level as a label
 */
export function getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' | 'none' {
  if (confidence >= 80) return 'high';
  if (confidence >= 60) return 'medium';
  if (confidence >= 40) return 'low';
  return 'none';
}

/**
 * Validate that required fields are mapped
 */
export function validateRequiredFieldsMapped(mappings: ColumnMapping[]): {
  isValid: boolean;
  missingFields: TradeField[];
} {
  const requiredFields: TradeField[] = ['amount', 'trade_date'];
  const mappedFields = mappings
    .filter(m => m.target !== 'ignore' && m.target !== 'create_tag')
    .map(m => m.target as TradeField);

  const missingFields = requiredFields.filter(field => !mappedFields.includes(field));

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Check if a column's data is compatible with a target field type
 * Returns true if the mapping is valid, false if it would cause invalid conversions
 */
export function isColumnCompatibleWithField(
  sampleValues: any[],
  targetField: TradeField
): {
  isCompatible: boolean;
  reason?: string;
  validPercentage: number;
} {
  // Filter out null/undefined/empty values
  const validValues = sampleValues.filter(v => v !== null && v !== undefined && v !== '');

  if (validValues.length === 0) {
    return { isCompatible: true, validPercentage: 100 }; // Empty column is always compatible
  }

  // Define expected types for number fields
  const numberFields: TradeField[] = ['amount', 'entry_price', 'exit_price', 'stop_loss', 'take_profit', 'risk_to_reward'];
  const dateFields: TradeField[] = ['trade_date'];
  const booleanFields: TradeField[] = ['partials_taken'];

  // Check compatibility for number fields
  if (numberFields.includes(targetField)) {
    let validCount = 0;

    for (const value of validValues) {
      const str = String(value).trim();

      // Check if it's a valid number
      // Allow formats: "123", "123.45", "-123", "$123.45", "1,234.56"
      const cleanedStr = str.replace(/[$,]/g, ''); // Remove dollar signs and commas
      const num = parseFloat(cleanedStr);

      if (!isNaN(num) && isFinite(num)) {
        validCount++;
      }
    }

    const validPercentage = Math.round((validCount / validValues.length) * 100);

    // Require at least 70% of values to be convertible to valid numbers
    if (validPercentage < 70) {
      return {
        isCompatible: false,
        reason: `Only ${validPercentage}% of values are valid numbers. Column contains non-numeric values like text.`,
        validPercentage
      };
    }

    return { isCompatible: true, validPercentage };
  }

  // Check compatibility for date fields
  if (dateFields.includes(targetField)) {
    let validCount = 0;

    for (const value of validValues) {
      if (value instanceof Date || !isNaN(Date.parse(String(value)))) {
        validCount++;
      }
    }

    const validPercentage = Math.round((validCount / validValues.length) * 100);

    if (validPercentage < 70) {
      return {
        isCompatible: false,
        reason: `Only ${validPercentage}% of values are valid dates.`,
        validPercentage
      };
    }

    return { isCompatible: true, validPercentage };
  }

  // Check compatibility for boolean fields
  if (booleanFields.includes(targetField)) {
    let validCount = 0;
    const validBooleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];

    for (const value of validValues) {
      const str = String(value).toLowerCase().trim();
      if (typeof value === 'boolean' || validBooleanValues.includes(str)) {
        validCount++;
      }
    }

    const validPercentage = Math.round((validCount / validValues.length) * 100);

    if (validPercentage < 70) {
      return {
        isCompatible: false,
        reason: `Only ${validPercentage}% of values are valid boolean values.`,
        validPercentage
      };
    }

    return { isCompatible: true, validPercentage };
  }

  // String fields (name, session, notes, tags, etc.) are always compatible
  return { isCompatible: true, validPercentage: 100 };
}

/**
 * Validate and auto-correct column mappings based on data compatibility
 * Returns updated mappings with incompatible mappings set to 'ignore'
 */
export function validateAndCorrectMappings(
  mappings: ColumnMapping[],
  fileData: { columns: string[]; rows: Array<Record<string, any>> }
): {
  correctedMappings: ColumnMapping[];
  corrections: Array<{ column: string; originalTarget: string; reason: string }>;
} {
  const corrections: Array<{ column: string; originalTarget: string; reason: string }> = [];
  const correctedMappings = mappings.map(mapping => {
    // Skip if already ignored or if it's a special action
    if (mapping.target === 'ignore' || mapping.target === 'create_tag') {
      return mapping;
    }

    // Get sample values for this column
    const sampleValues = fileData.rows.slice(0, 100).map(row => row[mapping.fileColumn]);

    // Check compatibility
    const compatibility = isColumnCompatibleWithField(sampleValues, mapping.target as TradeField);

    if (!compatibility.isCompatible) {
      // Auto-correct to 'ignore'
      corrections.push({
        column: mapping.fileColumn,
        originalTarget: mapping.target,
        reason: compatibility.reason || 'Incompatible data type'
      });

      return {
        ...mapping,
        target: 'ignore' as const,
        autoDetected: false
      };
    }

    return mapping;
  });

  return { correctedMappings, corrections };
}
