/**
 * Tests for session time utilities
 * Verifies DST handling and session time calculations
 */

import {
  isDaylightSavingTime,
  getSessionTimeRange,
  isTradeInSession,
  normalizeSessionName,
  getSessionMappings
} from '../sessionTimeUtils';

describe('sessionTimeUtils', () => {
  describe('isDaylightSavingTime', () => {
    it('should correctly identify DST dates in EU', () => {
      // Winter time (before last Sunday in March)
      expect(isDaylightSavingTime(new Date(2024, 2, 20), 'EU')).toBe(false); // March 20, 2024
      
      // Summer time (after last Sunday in March)
      expect(isDaylightSavingTime(new Date(2024, 2, 31), 'EU')).toBe(true); // March 31, 2024 (last Sunday was March 31)
      
      // Definitely summer time
      expect(isDaylightSavingTime(new Date(2024, 5, 15), 'EU')).toBe(true); // June 15, 2024
      
      // Before last Sunday in October (still DST)
      expect(isDaylightSavingTime(new Date(2024, 9, 20), 'EU')).toBe(true); // October 20, 2024
      
      // After last Sunday in October (winter time)
      expect(isDaylightSavingTime(new Date(2024, 9, 28), 'EU')).toBe(false); // October 28, 2024 (last Sunday was October 27)
      
      // Definitely winter time
      expect(isDaylightSavingTime(new Date(2024, 11, 15), 'EU')).toBe(false); // December 15, 2024
    });

    it('should correctly identify DST dates in US', () => {
      // Before second Sunday in March
      expect(isDaylightSavingTime(new Date(2024, 2, 5), 'US')).toBe(false); // March 5, 2024
      
      // After second Sunday in March (March 10, 2024)
      expect(isDaylightSavingTime(new Date(2024, 2, 15), 'US')).toBe(true); // March 15, 2024
      
      // Before first Sunday in November (November 3, 2024)
      expect(isDaylightSavingTime(new Date(2024, 10, 1), 'US')).toBe(true); // November 1, 2024
      
      // After first Sunday in November
      expect(isDaylightSavingTime(new Date(2024, 10, 5), 'US')).toBe(false); // November 5, 2024
    });
  });

  describe('getSessionTimeRange', () => {
    it('should return correct London session times with DST', () => {
      // Summer time (DST active)
      const summerDate = new Date(2024, 5, 15); // June 15, 2024
      const summerRange = getSessionTimeRange('London', summerDate);
      
      expect(summerRange.start.getUTCHours()).toBe(7); // 7:00 UTC in summer
      expect(summerRange.end.getUTCHours()).toBe(12); // 12:00 UTC in summer
      
      // Winter time (DST not active)
      const winterDate = new Date(2024, 11, 15); // December 15, 2024
      const winterRange = getSessionTimeRange('London', winterDate);
      
      expect(winterRange.start.getUTCHours()).toBe(8); // 8:00 UTC in winter
      expect(winterRange.end.getUTCHours()).toBe(13); // 13:00 UTC in winter
    });

    it('should return correct NY AM session times with DST', () => {
      // Summer time
      const summerDate = new Date(2024, 5, 15);
      const summerRange = getSessionTimeRange('NY AM', summerDate);
      
      expect(summerRange.start.getUTCHours()).toBe(12); // 12:00 UTC in summer
      expect(summerRange.end.getUTCHours()).toBe(17); // 17:00 UTC in summer
      
      // Winter time
      const winterDate = new Date(2024, 11, 15);
      const winterRange = getSessionTimeRange('NY AM', winterDate);
      
      expect(winterRange.start.getUTCHours()).toBe(13); // 13:00 UTC in winter
      expect(winterRange.end.getUTCHours()).toBe(18); // 18:00 UTC in winter
    });

    it('should handle Asia session spanning midnight', () => {
      const testDate = new Date(2024, 5, 15); // June 15, 2024
      const asiaRange = getSessionTimeRange('Asia', testDate);
      
      // Asia session starts on previous day
      expect(asiaRange.start.getDate()).toBe(testDate.getDate() - 1);
      expect(asiaRange.start.getUTCHours()).toBe(22); // 22:00 UTC (summer)
      
      // Asia session ends on the trade date
      expect(asiaRange.end.getDate()).toBe(testDate.getDate());
      expect(asiaRange.end.getUTCHours()).toBe(7); // 7:00 UTC (summer)
    });
  });

  describe('isTradeInSession', () => {
    it('should correctly identify trades in London session', () => {
      // Summer time - London session is 7:00-12:00 UTC
      const summerDate = new Date(2024, 5, 15, 9, 30); // June 15, 2024, 9:30 UTC
      expect(isTradeInSession(summerDate, 'London')).toBe(true);
      
      const outsideSummer = new Date(2024, 5, 15, 14, 30); // June 15, 2024, 14:30 UTC
      expect(isTradeInSession(outsideSummer, 'London')).toBe(false);
      
      // Winter time - London session is 8:00-13:00 UTC
      const winterDate = new Date(2024, 11, 15, 10, 30); // December 15, 2024, 10:30 UTC
      expect(isTradeInSession(winterDate, 'London')).toBe(true);
      
      const outsideWinter = new Date(2024, 11, 15, 15, 30); // December 15, 2024, 15:30 UTC
      expect(isTradeInSession(outsideWinter, 'London')).toBe(false);
    });

    it('should handle legacy session names', () => {
      const testDate = new Date(2024, 5, 15, 9, 30); // June 15, 2024, 9:30 UTC (London session)
      
      expect(isTradeInSession(testDate, 'london')).toBe(true);
      expect(isTradeInSession(testDate, 'London')).toBe(true);
    });
  });

  describe('normalizeSessionName', () => {
    it('should normalize legacy session names', () => {
      expect(normalizeSessionName('london')).toBe('London');
      expect(normalizeSessionName('new-york')).toBe('NY AM');
      expect(normalizeSessionName('tokyo')).toBe('Asia');
      expect(normalizeSessionName('sydney')).toBe('Asia');
      expect(normalizeSessionName('London')).toBe('London');
      expect(normalizeSessionName('NY AM')).toBe('NY AM');
    });
  });

  describe('getSessionMappings', () => {
    it('should return correct session mappings', () => {
      expect(getSessionMappings('london')).toEqual(['London']);
      expect(getSessionMappings('new-york')).toEqual(['NY AM', 'NY PM']);
      expect(getSessionMappings('tokyo')).toEqual(['Asia']);
      expect(getSessionMappings('sydney')).toEqual(['Asia']);
      expect(getSessionMappings('unknown')).toEqual([]);
    });
  });
});
