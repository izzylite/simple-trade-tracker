/**
 * Session time utilities with daylight saving time support
 * Provides consistent session time calculations across the application
 */

export type TradingSession = 'Asia' | 'London' | 'NY AM' | 'NY PM';
export type LegacySession = 'london' | 'new-york' | 'tokyo' | 'sydney';

export interface SessionTimeRange {
  start: Date;
  end: Date;
}

/**
 * Determine if a given date falls within daylight saving time
 * Uses actual DST transition rules for better accuracy
 * Supports both EU/UK and US DST rules
 */
export function isDaylightSavingTime(date: Date, region: 'EU' | 'US' = 'EU'): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (region === 'EU') {
    // EU/UK DST: Last Sunday in March to last Sunday in October

    // Before March or after October - definitely not DST
    if (month < 2 || month > 9) {
      return false;
    }

    // April through September - definitely DST
    if (month > 2 && month < 9) {
      return true;
    }

    // March - check if on or after last Sunday
    if (month === 2) {
      const lastSunday = getLastSundayOfMonth(year, 2); // March is month 2
      return day >= lastSunday;
    }

    // October - check if before last Sunday
    if (month === 9) {
      const lastSunday = getLastSundayOfMonth(year, 9); // October is month 9
      return day < lastSunday;
    }
  } else {
    // US DST: Second Sunday in March to first Sunday in November

    // Before March or after November - definitely not DST
    if (month < 2 || month > 10) {
      return false;
    }

    // April through October - definitely DST
    if (month > 2 && month < 10) {
      return true;
    }

    // March - check if on or after second Sunday
    if (month === 2) {
      const secondSunday = getNthSundayOfMonth(year, 2, 2); // Second Sunday of March
      return day >= secondSunday;
    }

    // November - check if before first Sunday
    if (month === 10) {
      const firstSunday = getNthSundayOfMonth(year, 10, 1); // First Sunday of November
      return day < firstSunday;
    }
  }

  return false;
}

/**
 * Get the last Sunday of a given month
 */
function getLastSundayOfMonth(year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0); // Last day of the month
  const lastSunday = new Date(lastDay);
  lastSunday.setDate(lastDay.getDate() - lastDay.getDay());
  return lastSunday.getDate();
}

/**
 * Get the nth Sunday of a given month (1-based)
 */
function getNthSundayOfMonth(year: number, month: number, n: number): number {
  const firstDay = new Date(year, month, 1);
  const firstSunday = new Date(firstDay);

  // Find first Sunday
  const daysToFirstSunday = (7 - firstDay.getDay()) % 7;
  firstSunday.setDate(1 + daysToFirstSunday);

  // Add (n-1) weeks to get nth Sunday
  const nthSunday = new Date(firstSunday);
  nthSunday.setDate(firstSunday.getDate() + (n - 1) * 7);

  return nthSunday.getDate();
}

/**
 * Get session time range in UTC for a given date and session
 * Accounts for daylight saving time adjustments
 */
export function getSessionTimeRange(session: TradingSession | LegacySession, tradeDate: Date): SessionTimeRange {
  const year = tradeDate.getFullYear();
  const month = tradeDate.getMonth();
  const day = tradeDate.getDate();
  
  // Use EU DST rules as default since London session is a key reference
  const isDST = isDaylightSavingTime(tradeDate, 'EU');
  
  let startHour: number, endHour: number;
  
  // Normalize session names
  const normalizedSession = normalizeSessionName(session);
  
  switch (normalizedSession) {
    case 'London':
      startHour = isDST ? 7 : 8;   // 8:00 AM GMT / 9:00 AM BST -> 7:00/8:00 UTC
      endHour = isDST ? 12 : 13;   // 1:00 PM GMT / 2:00 PM BST -> 12:00/13:00 UTC
      break;
    case 'NY AM':
      startHour = isDST ? 12 : 13; // 8:00 AM EST / 9:00 AM EDT -> 12:00/13:00 UTC
      endHour = isDST ? 17 : 18;   // 1:00 PM EST / 2:00 PM EDT -> 17:00/18:00 UTC
      break;
    case 'NY PM':
      startHour = isDST ? 17 : 18; // 1:00 PM EST / 2:00 PM EDT -> 17:00/18:00 UTC
      endHour = isDST ? 21 : 22;   // 5:00 PM EST / 6:00 PM EDT -> 21:00/22:00 UTC
      break;
    case 'Asia':
      // Asia session spans midnight, so we need to handle day boundaries
      const asiaStartHour = isDST ? 22 : 23; // 10:00 PM UTC (summer) / 11:00 PM UTC (winter)
      const asiaEndHour = isDST ? 7 : 8;     // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)

      // Start time is on the previous day - use Date.UTC for proper UTC dates
      const startDate = new Date(Date.UTC(year, month, day - 1, asiaStartHour, 0, 0));
      const endDate = new Date(Date.UTC(year, month, day, asiaEndHour, 0, 0));
      return { start: startDate, end: endDate };
    default:
      // Default to full day range if session is unknown
      startHour = 0;
      endHour = 23;
  }

  // Use Date.UTC to create proper UTC dates (session hours are defined in UTC)
  const start = new Date(Date.UTC(year, month, day, startHour, 0, 0));
  const end = new Date(Date.UTC(year, month, day, endHour, 59, 59));

  return { start, end };
}

/**
 * Normalize legacy session names to current session names
 */
export function normalizeSessionName(session: TradingSession | LegacySession): TradingSession {
  const sessionMappings: { [key: string]: TradingSession } = {
    'london': 'London',
    'new-york': 'NY AM', // Default to NY AM for legacy new-york
    'tokyo': 'Asia',
    'sydney': 'Asia',
    'Asia': 'Asia',
    'London': 'London',
    'NY AM': 'NY AM',
    'NY PM': 'NY PM'
  };
  
  return sessionMappings[session] || 'London'; // Default fallback
}

/**
 * Check if a trade time falls within a specific session
 * Uses DST-aware session time ranges
 */
export function isTradeInSession(tradeDate: Date, session: TradingSession | LegacySession): boolean {
  const sessionRange = getSessionTimeRange(session, tradeDate);
  
  // Handle Asia session that spans midnight
  if (normalizeSessionName(session) === 'Asia') {
    return tradeDate >= sessionRange.start || tradeDate <= sessionRange.end;
  }
  
  return tradeDate >= sessionRange.start && tradeDate <= sessionRange.end;
}

/**
 * Get all possible session mappings for a given session name
 * Used for backward compatibility with legacy session filtering
 */
export function getSessionMappings(session: string): string[] {
  const sessionMappings: { [key: string]: string[] } = {
    'london': ['London'],
    'new-york': ['NY AM', 'NY PM'],
    'tokyo': ['Asia'],
    'sydney': ['Asia'],
    'Asia': ['Asia'],
    'London': ['London'],
    'NY AM': ['NY AM'],
    'NY PM': ['NY PM']
  };
  
  return sessionMappings[session] || [];
}
