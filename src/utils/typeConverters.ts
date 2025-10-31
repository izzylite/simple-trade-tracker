/**
 * Type Conversion Utilities
 * Handles converting values from file formats to Trade field types
 */

import { parse } from 'date-fns';
import { FieldType } from '../types/import';
import { warn } from './logger';

/**
 * Common date formats to try when parsing
 */
const DATE_FORMATS = [
  'MM/dd/yyyy',    // 01/31/2023
  'M/d/yyyy',      // 1/31/2023
  'yyyy-MM-dd',    // 2023-01-31
  'yyyy/MM/dd',    // 2023/01/31
  'dd/MM/yyyy',    // 31/01/2023
  'dd-MM-yyyy',    // 31-01-2023
  'MM-dd-yyyy',    // 01-31-2023
  'M-d-yyyy',      // 1-31-2023
  'MMMM d, yyyy',  // March 7, 2025
  'MMM d, yyyy',   // Mar 7, 2025
  'MMMM dd, yyyy', // March 07, 2025
  'MMM dd, yyyy'   // Mar 07, 2025
];

/**
 * Result of a type conversion attempt
 */
export interface ConversionResult<T = any> {
  success: boolean;
  value?: T;
  error?: string;
  originalValue: any;
}

/**
 * Parse a flexible date string using multiple formats
 */
export function parseFlexibleDate(value: any): ConversionResult<Date> {
  const originalValue = value;

  // If already a Date object
  if (value instanceof Date) {
    return { success: true, value, originalValue };
  }

  // If null or undefined
  if (value === null || value === undefined || value === '') {
    return { success: false, error: 'Empty or null date', originalValue };
  }

  // Convert to string and normalize
  const dateStr = String(value).trim();

  // Try to parse with each format
  for (const format of DATE_FORMATS) {
    try {
      const parsedDate = parse(dateStr, format, new Date());
      // Check if the date is valid (not Invalid Date)
      if (!isNaN(parsedDate.getTime())) {
        return { success: true, value: parsedDate, originalValue };
      }
    } catch (error) {
      // Continue to the next format
    }
  }

  // Special handling for month name formats (e.g., "March 7, 2025")
  const monthNameRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/i;
  const monthNameMatch = dateStr.match(monthNameRegex);

  if (monthNameMatch) {
    const [, month, day, year] = monthNameMatch;
    const monthIndex = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ].indexOf(month.toLowerCase());

    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      if (!isNaN(date.getTime())) {
        return { success: true, value: date, originalValue };
      }
    }
  }

  // Try direct Date constructor as last resort
  const directDate = new Date(dateStr);
  if (!isNaN(directDate.getTime())) {
    return { success: true, value: directDate, originalValue };
  }

  return {
    success: false,
    error: `Could not parse date: "${dateStr}"`,
    originalValue
  };
}

/**
 * Parse a flexible number from various formats
 * Handles: $1,234.56, 1.234,56 (EU), (100), -100, +100
 */
export function parseFlexibleNumber(value: any, format: 'us' | 'eu' = 'us'): ConversionResult<number> {
  const originalValue = value;

  // If already a number
  if (typeof value === 'number') {
    return { success: true, value, originalValue };
  }

  // If null or undefined
  if (value === null || value === undefined || value === '') {
    return { success: false, error: 'Empty or null number', originalValue };
  }

  // Convert to string and normalize
  let numStr = String(value).trim();

  // Handle empty strings after trim
  if (numStr === '') {
    return { success: false, error: 'Empty string', originalValue };
  }

  // Handle parentheses notation for negative numbers: (100) -> -100
  const parenMatch = numStr.match(/^\(([0-9,.]+)\)$/);
  if (parenMatch) {
    numStr = `-${parenMatch[1]}`;
  }

  // Remove currency symbols
  numStr = numStr.replace(/[$€£¥₹]/g, '');

  // Handle percentages
  if (numStr.includes('%')) {
    numStr = numStr.replace('%', '');
    const percentResult = parseFlexibleNumber(numStr, format);
    if (percentResult.success && percentResult.value !== undefined) {
      return {
        success: true,
        value: percentResult.value / 100,
        originalValue
      };
    }
  }

  // Handle EU format (1.234,56) vs US format (1,234.56)
  if (format === 'eu') {
    // EU: thousands separator is dot, decimal separator is comma
    numStr = numStr.replace(/\./g, ''); // Remove thousands separator
    numStr = numStr.replace(/,/g, '.'); // Convert decimal comma to dot
  } else {
    // US: thousands separator is comma, decimal separator is dot
    numStr = numStr.replace(/,/g, ''); // Remove thousands separator
  }

  // Try to parse as float
  const parsed = parseFloat(numStr);

  if (isNaN(parsed)) {
    return {
      success: false,
      error: `Could not parse number: "${value}"`,
      originalValue
    };
  }

  return { success: true, value: parsed, originalValue };
}

/**
 * Parse a boolean value from various formats
 */
export function parseFlexibleBoolean(value: any): ConversionResult<boolean> {
  const originalValue = value;

  // If already a boolean
  if (typeof value === 'boolean') {
    return { success: true, value, originalValue };
  }

  // If null or undefined
  if (value === null || value === undefined) {
    return { success: false, error: 'Empty or null boolean', originalValue };
  }

  // Convert to string and normalize
  const strValue = String(value).trim().toLowerCase();

  // True values
  if (['true', '1', 'yes', 'y', 't', 'on', 'checked'].includes(strValue)) {
    return { success: true, value: true, originalValue };
  }

  // False values
  if (['false', '0', 'no', 'n', 'f', 'off', 'unchecked', ''].includes(strValue)) {
    return { success: true, value: false, originalValue };
  }

  return {
    success: false,
    error: `Could not parse boolean: "${value}"`,
    originalValue
  };
}

/**
 * Parse an array from various formats
 * Handles: "tag1, tag2, tag3" or ["tag1", "tag2"] or "tag1;tag2"
 */
export function parseFlexibleArray(value: any, delimiter: string = ','): ConversionResult<string[]> {
  const originalValue = value;

  // If already an array
  if (Array.isArray(value)) {
    return {
      success: true,
      value: value.map(v => String(v).trim()).filter(Boolean),
      originalValue
    };
  }

  // If null or undefined
  if (value === null || value === undefined || value === '') {
    return { success: true, value: [], originalValue };
  }

  // Convert to string and split
  const strValue = String(value);
  const items = strValue
    .split(delimiter)
    .map(item => item.trim())
    .filter(Boolean);

  return { success: true, value: items, originalValue };
}

/**
 * Parse trade type from various formats
 */
export function parseTradeType(value: any): ConversionResult<'win' | 'loss' | 'breakeven'> {
  const originalValue = value;

  // If null or undefined
  if (value === null || value === undefined || value === '') {
    return { success: false, error: 'Empty trade type', originalValue };
  }

  // Convert to string and normalize
  const strValue = String(value).trim().toLowerCase();

  // Win variants
  if (['win', 'profit', 'w', 'positive', '+', 'green'].includes(strValue)) {
    return { success: true, value: 'win', originalValue };
  }

  // Loss variants
  if (['loss', 'lose', 'l', 'negative', '-', 'red'].includes(strValue)) {
    return { success: true, value: 'loss', originalValue };
  }

  // Breakeven variants
  if (['breakeven', 'break-even', 'be', 'b', 'flat', 'zero', '0', 'neutral'].includes(strValue)) {
    return { success: true, value: 'breakeven', originalValue };
  }

  return {
    success: false,
    error: `Could not parse trade type: "${value}"`,
    originalValue
  };
}

/**
 * Convert a value to the expected field type
 */
export function convertToFieldType(
  value: any,
  targetType: FieldType,
  options: { numberFormat?: 'us' | 'eu'; arrayDelimiter?: string } = {}
): ConversionResult {
  switch (targetType) {
    case 'date':
      return parseFlexibleDate(value);

    case 'number':
      return parseFlexibleNumber(value, options.numberFormat);

    case 'boolean':
      return parseFlexibleBoolean(value);

    case 'array':
      return parseFlexibleArray(value, options.arrayDelimiter);

    case 'string':
      // String conversion always succeeds
      if (value === null || value === undefined) {
        return { success: true, value: '', originalValue: value };
      }
      return { success: true, value: String(value), originalValue: value };

    default:
      return {
        success: false,
        error: `Unknown field type: ${targetType}`,
        originalValue: value
      };
  }
}

/**
 * Validate that a value is of the expected type
 */
export function validateFieldType(value: any, expectedType: FieldType): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';

    case 'number':
      return typeof value === 'number' && !isNaN(value);

    case 'date':
      return value instanceof Date && !isNaN(value.getTime());

    case 'boolean':
      return typeof value === 'boolean';

    case 'array':
      return Array.isArray(value);

    default:
      warn(`Unknown field type for validation: ${expectedType}`);
      return false;
  }
}
