/**
 * Import Validation Utilities
 * Validates imported data and generates validation summaries
 */

import { Trade } from '../types/dualWrite';
import {
  ValidationError,
  ValidationSummary,
  ImportPreviewRow,
  ColumnMapping,
  FieldMetadata,
  TradeField,
  TypeConversion,
  ImportConfig
} from '../types/import';
import {
  convertToFieldType,
  validateFieldType,
  parseTradeType,
  ConversionResult
} from './typeConverters';
import { formatTagWithCapitalizedGroup } from './tagColors';

/**
 * Field metadata for all Trade fields
 */
export const TRADE_FIELD_METADATA: Record<TradeField, FieldMetadata> = {
  trade_date: {
    name: 'trade_date',
    displayName: 'Trade Date',
    type: 'date',
    required: true,
    description: 'Date when the trade was executed',
    examples: ['2025-01-15', '01/15/2025', 'January 15, 2025']
  },
  amount: {
    name: 'amount',
    displayName: 'Amount (P&L)',
    type: 'number',
    required: true,
    description: 'Profit or loss amount (positive for wins, negative for losses)',
    examples: ['100.50', '-50.25', '$1,234.56']
  },
  trade_type: {
    name: 'trade_type',
    displayName: 'Trade Type',
    type: 'string',
    required: false,
    description: 'Type of trade result (win/loss/breakeven). Auto-derived from amount if not provided.',
    examples: ['win', 'loss', 'breakeven']
  },
  name: {
    name: 'name',
    displayName: 'Name',
    type: 'string',
    required: false,
    description: 'Name or symbol of the trade',
    examples: ['AAPL', 'EUR/USD', 'Gold Futures']
  },
  entry_price: {
    name: 'entry_price',
    displayName: 'Entry Price',
    type: 'number',
    required: false,
    description: 'Price at which the trade was entered',
    examples: ['150.25', '1.2345']
  },
  exit_price: {
    name: 'exit_price',
    displayName: 'Exit Price',
    type: 'number',
    required: false,
    description: 'Price at which the trade was exited',
    examples: ['155.75', '1.2450']
  },
  stop_loss: {
    name: 'stop_loss',
    displayName: 'Stop Loss',
    type: 'number',
    required: false,
    description: 'Stop loss price level',
    examples: ['148.00', '1.2300']
  },
  take_profit: {
    name: 'take_profit',
    displayName: 'Take Profit',
    type: 'number',
    required: false,
    description: 'Take profit price level',
    examples: ['160.00', '1.2600']
  },
  risk_to_reward: {
    name: 'risk_to_reward',
    displayName: 'Risk to Reward',
    type: 'number',
    required: false,
    description: 'Risk to reward ratio',
    examples: ['2', '3.5', '1:2']
  },
  partials_taken: {
    name: 'partials_taken',
    displayName: 'Partials Taken',
    type: 'boolean',
    required: false,
    description: 'Whether partial profits were taken',
    examples: ['true', 'false', 'yes', 'no']
  },
  session: {
    name: 'session',
    displayName: 'Session',
    type: 'string',
    required: false,
    description: 'Trading session',
    examples: ['London', 'New York', 'Asian']
  },
  notes: {
    name: 'notes',
    displayName: 'Notes',
    type: 'string',
    required: false,
    description: 'Trade notes and comments',
    examples: ['Good entry', 'Breakout trade', 'Revenge trading - avoid']
  },
  tags: {
    name: 'tags',
    displayName: 'Tags',
    type: 'array',
    required: false,
    description: 'Tags for categorization',
    examples: ['Strategy:Breakout', 'Setup:Flag, Market:Bullish']
  },
  images: {
    name: 'images',
    displayName: 'Images',
    type: 'array',
    required: false,
    description: 'Image URLs (single URL or comma-separated list)',
    examples: ['https://example.com/image.jpg', 'https://example.com/img1.jpg, https://example.com/img2.jpg']
  }
};

/**
 * Validate and convert a single field value
 */
function validateField(
  field: TradeField,
  value: any,
  config: ImportConfig
): { isValid: boolean; convertedValue?: any; error?: ValidationError } {
  const metadata = TRADE_FIELD_METADATA[field];

  // Handle empty values
  if (value === null || value === undefined || value === '') {
    if (metadata.required) {
      return {
        isValid: false,
        error: {
          row: 0,
          column: field,
          field,
          severity: 'error',
          message: `Required field "${metadata.displayName}" is empty`
        }
      };
    }
    return { isValid: true, convertedValue: undefined };
  }

  // Convert to expected type
  const conversionOptions = {
    numberFormat: config.numberFormat,
    arrayDelimiter: ','
  };

  const conversionResult: ConversionResult = convertToFieldType(
    value,
    metadata.type,
    conversionOptions
  );

  if (!conversionResult.success) {
    return {
      isValid: false,
      error: {
        row: 0,
        column: field,
        field,
        severity: 'error',
        message: conversionResult.error || `Failed to convert ${field}`,
        value,
        suggestedFix: `Expected ${metadata.type}, got: ${typeof value}`
      }
    };
  }

  // Validate converted value
  if (!validateFieldType(conversionResult.value, metadata.type)) {
    return {
      isValid: false,
      error: {
        row: 0,
        column: field,
        field,
        severity: 'error',
        message: `Invalid ${field} value after conversion`,
        value: conversionResult.value
      }
    };
  }

  return {
    isValid: true,
    convertedValue: conversionResult.value
  };
}

/**
 * Convert a raw row to a mapped Trade object
 */
export function mapRowToTrade(
  row: Record<string, any>,
  mappings: ColumnMapping[],
  config: ImportConfig,
  rowIndex: number
): {
  trade: Partial<Trade>;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const trade: Partial<Trade> = {};
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Apply column mappings
  for (const mapping of mappings) {
    const { fileColumn, target } = mapping;
    const value = row[fileColumn];

    // Skip ignored columns
    if (target === 'ignore') continue;

    // Handle tag creation
    if (target === 'create_tag') {
      if (value && String(value).trim()) {
        if (!trade.tags) trade.tags = [];
        const tagValue = `${fileColumn}:${String(value).trim()}`;
        // Capitalize the group name
        const formattedTag = formatTagWithCapitalizedGroup(tagValue);
        trade.tags.push(formattedTag);
      }
      continue;
    }

    // Validate and convert field
    const field = target as TradeField;
    const validation = validateField(field, value, config);

    if (validation.isValid) {
      if (validation.convertedValue !== undefined) {
        // Special handling for images field - convert URL strings to TradeImageEntity array
        if (field === 'images' && Array.isArray(validation.convertedValue)) {
          const imageUrls = validation.convertedValue as string[];
          (trade as any)[field] = imageUrls.map((url, index) => ({
            id: crypto.randomUUID(),
            url: url.trim(),
            calendar_id: '' // Will be set when trade is saved
          }));
        } else {
          (trade as any)[field] = validation.convertedValue;
        }
      }
    } else if (validation.error) {
      validation.error.row = rowIndex;
      validation.error.column = fileColumn;
      errors.push(validation.error);
    }
  }

  // Auto-derive trade_type if not mapped
  if (!trade.trade_type && trade.amount !== undefined) {
    if (trade.amount > 0) {
      trade.trade_type = 'win';
    } else if (trade.amount < 0) {
      trade.trade_type = 'loss';
    } else {
      trade.trade_type = 'breakeven';
    }
  } else if (trade.trade_type && typeof trade.trade_type === 'string') {
    // Validate trade_type if provided
    const typeResult = parseTradeType(trade.trade_type);
    if (typeResult.success) {
      trade.trade_type = typeResult.value;
    } else {
      errors.push({
        row: rowIndex,
        column: 'trade_type',
        field: 'trade_type',
        severity: 'error',
        message: 'Invalid trade type',
        value: trade.trade_type,
        suggestedFix: 'Must be "win", "loss", or "breakeven"'
      });
    }
  }

  // Apply default values
  if (config.defaultValues) {
    for (const [key, value] of Object.entries(config.defaultValues)) {
      if ((trade as any)[key] === undefined) {
        (trade as any)[key] = value;
      }
    }
  }

  // Check required fields
  const requiredFields: TradeField[] = ['amount', 'trade_date'];
  for (const field of requiredFields) {
    if ((trade as any)[field] === undefined) {
      errors.push({
        row: rowIndex,
        column: field,
        field,
        severity: 'error',
        message: `Required field "${TRADE_FIELD_METADATA[field].displayName}" is missing`
      });
    }
  }

  // Add warnings for potentially missing important fields
  if (!trade.name) {
    warnings.push({
      row: rowIndex,
      column: 'name',
      field: 'name',
      severity: 'warning',
      message: 'Trade name is empty'
    });
  }

  return { trade, errors, warnings };
}

/**
 * Validate all rows and generate preview data
 */
export function validateImportData(
  rows: Array<Record<string, any>>,
  mappings: ColumnMapping[],
  config: ImportConfig
): {
  previewRows: ImportPreviewRow[];
  validationSummary: ValidationSummary;
} {
  const previewRows: ImportPreviewRow[] = [];
  const allErrors: ValidationError[] = [];
  const conversions = new Map<TradeField, TypeConversion>();

  let validRows = 0;
  let rowsWithWarnings = 0;
  let rowsWithErrors = 0;

  // Process each row
  rows.forEach((row, index) => {
    const { trade, errors, warnings } = mapRowToTrade(row, mappings, config, index);

    const isValid = errors.length === 0;
    if (isValid) validRows++;
    if (warnings.length > 0) rowsWithWarnings++;
    if (errors.length > 0) rowsWithErrors++;

    previewRows.push({
      rowIndex: index,
      data: row,
      mappedData: trade,
      errors,
      warnings,
      isValid
    });

    allErrors.push(...errors);

    // Track conversions
    for (const mapping of mappings) {
      if (mapping.target === 'ignore' || mapping.target === 'create_tag') continue;

      const field = mapping.target as TradeField;
      const metadata = TRADE_FIELD_METADATA[field];
      const originalValue = row[mapping.fileColumn];
      const convertedValue = (trade as any)[field];

      if (originalValue !== undefined && convertedValue !== undefined) {
        const originalType = typeof originalValue;
        const needsConversion = originalType !== metadata.type &&
          !(metadata.type === 'date' && originalValue instanceof Date) &&
          !(metadata.type === 'array' && Array.isArray(originalValue));

        if (needsConversion) {
          if (!conversions.has(field)) {
            conversions.set(field, {
              field,
              fromType: originalType,
              toType: metadata.type,
              affectedRows: 0,
              examples: [],
              warnings: 0
            });
          }

          const conversion = conversions.get(field)!;
          conversion.affectedRows++;

          if (conversion.examples.length < 3) {
            conversion.examples.push({
              original: originalValue,
              converted: convertedValue
            });
          }

          // Count conversion warnings
          const hasWarning = warnings.some(w => w.field === field);
          if (hasWarning) conversion.warnings++;
        }
      }
    }
  });

  // Generate validation summary
  const validationSummary: ValidationSummary = {
    totalRows: rows.length,
    validRows,
    rowsWithWarnings,
    rowsWithErrors,
    willImport: config.skipErrorRows ? validRows : rows.length,
    conversions: Array.from(conversions.values()),
    errors: allErrors
  };

  return { previewRows, validationSummary };
}

/**
 * Get field metadata by name
 */
export function getFieldMetadata(field: TradeField): FieldMetadata {
  return TRADE_FIELD_METADATA[field];
}

/**
 * Get all available trade fields
 */
export function getAllTradeFields(): TradeField[] {
  return Object.keys(TRADE_FIELD_METADATA) as TradeField[];
}

/**
 * Get required trade fields
 */
export function getRequiredFields(): TradeField[] {
  return Object.values(TRADE_FIELD_METADATA)
    .filter(m => m.required)
    .map(m => m.name);
}
