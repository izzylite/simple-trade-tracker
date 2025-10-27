/**
 * Format a numeric value as currency
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export const formatValue = (amount: number | undefined | null): string => {
  // Handle undefined, null, or NaN values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }

  const absAmount = Math.abs(amount);
  if (absAmount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
};

/**
 * Format a numeric value as currency with full precision
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  // Handle undefined, null, or NaN values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }

  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format a percentage value
 * @param value The percentage value to format
 * @param decimals Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number | undefined | null, decimals: number = 1): string => {
  // Handle undefined, null, or NaN values
  if (value === undefined || value === null || isNaN(value)) {
    return '0.0%';
  }

  return `${value.toFixed(decimals)}%`;
};

/**
 * Format a date in a consistent way
 * @param date The date to format
 * @param format The format to use (short, medium, long)
 * @returns Formatted date string
 */
export const formatDate = (date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string => {
  switch (format) {
    case 'short':
      return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    case 'medium':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    case 'long':
      return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    default:
      return date.toLocaleDateString();
  }
};
