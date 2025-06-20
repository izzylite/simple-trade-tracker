import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Safely convert various date formats to Date object
 */
const safeParseDate = (date: Date | string | any): Date => {
  // If it's already a Date object
  if (date instanceof Date) {
    return date;
  }

  // If it's a string
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    // Try parsing as regular date string
    const fallback = new Date(date);
    if (!isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  // If it's a Firestore Timestamp object
  if (date && typeof date === 'object' && date.toDate) {
    return date.toDate();
  }

  // If it's a timestamp number
  if (typeof date === 'number') {
    return new Date(date);
  }

  // If it has seconds and nanoseconds (Firestore Timestamp format)
  if (date && typeof date === 'object' && date.seconds) {
    return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
  }

  // Fallback to current date if all else fails
  console.warn('Unable to parse date:', date);
  return new Date();
};

/**
 * Format date for blog posts with relative time
 */
export const formatBlogDate = (date: Date | string | any): string => {
  try {
    const dateObj = safeParseDate(date);

    if (isToday(dateObj)) {
      return `Today at ${format(dateObj, 'HH:mm')}`;
    }

    if (isYesterday(dateObj)) {
      return `Yesterday at ${format(dateObj, 'HH:mm')}`;
    }

    // For dates within the last week, show relative time
    const daysAgo = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 7) {
      return formatDistanceToNow(dateObj, { addSuffix: true });
    }

    // For older dates, show formatted date
    return format(dateObj, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting blog date:', error, date);
    return 'Unknown date';
  }
};

/**
 * Format date for blog post details
 */
export const formatDetailedBlogDate = (date: Date | string | any): string => {
  try {
    const dateObj = safeParseDate(date);
    return format(dateObj, 'MMMM dd, yyyy \'at\' HH:mm');
  } catch (error) {
    console.error('Error formatting detailed blog date:', error, date);
    return 'Unknown date';
  }
};

/**
 * Get reading time based on content length
 */
export const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

/**
 * Check if a date is within a specified range
 */
export const isDateInRange = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

/**
 * Get date range for common filters
 */
export const getDateRange = (period: 'today' | 'week' | 'month' | 'year'): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return { start, end: now };
};

/**
 * Format cache expiry time
 */
export const getCacheExpiryTime = (minutes: number): number => {
  return Date.now() + (minutes * 60 * 1000);
};

/**
 * Check if cache is expired
 */
export const isCacheExpired = (timestamp: number): boolean => {
  return Date.now() > timestamp;
};
