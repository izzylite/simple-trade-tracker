import { getSessionForTimestamp } from '../sessionTimeUtils';

describe('getSessionForTimestamp', () => {
  // DST active (July) — EU DST: Asia 22-07, London 07-12, NY AM 12-17, NY PM 17-21
  describe('during DST (summer)', () => {
    it('returns Asia for 03:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T03:00:00Z')).toBe('Asia');
    });

    it('returns London for 10:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T10:00:00Z')).toBe('London');
    });

    it('returns NY AM for 14:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T14:00:00Z')).toBe('NY AM');
    });

    it('returns NY PM for 19:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T19:00:00Z')).toBe('NY PM');
    });
  });

  // Non-DST (January) — Asia 23-08, London 08-13, NY AM 13-18, NY PM 18-22
  describe('during non-DST (winter)', () => {
    it('returns Asia for 02:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T02:00:00Z')).toBe('Asia');
    });

    it('returns London for 10:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T10:00:00Z')).toBe('London');
    });

    it('returns NY AM for 15:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T15:00:00Z')).toBe('NY AM');
    });

    it('returns NY PM for 20:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T20:00:00Z')).toBe('NY PM');
    });
  });

  // Asia near midnight
  describe('Asia session near midnight', () => {
    it('returns Asia for 22:30 UTC in summer (DST)', () => {
      expect(getSessionForTimestamp('2026-07-15T22:30:00Z')).toBe('Asia');
    });

    it('returns Asia for 23:30 UTC in winter (non-DST)', () => {
      expect(getSessionForTimestamp('2026-01-15T23:30:00Z')).toBe('Asia');
    });
  });

  // DST transition window (US switched, EU hasn't yet — mid-March)
  describe('DST transition mismatch window', () => {
    it('handles mid-March when US is DST but EU is not', () => {
      expect(getSessionForTimestamp('2026-03-12T14:00:00Z')).toBe('NY AM');
    });
  });

  // Boundary: later session wins
  describe('boundary behavior', () => {
    it('returns NY AM at exact London/NY AM boundary (12:00 UTC DST)', () => {
      expect(getSessionForTimestamp('2026-07-15T12:00:00Z')).toBe('NY AM');
    });

    it('returns London at exact Asia/London boundary (07:00 UTC DST)', () => {
      expect(getSessionForTimestamp('2026-07-15T07:00:00Z')).toBe('London');
    });
  });

  // Fallback
  describe('fallback to null', () => {
    it('returns null for invalid timestamp', () => {
      expect(getSessionForTimestamp('not-a-date')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getSessionForTimestamp('')).toBeNull();
    });

    it('returns null for time in gap (22:30 UTC non-DST winter)', () => {
      expect(getSessionForTimestamp('2026-01-15T22:30:00Z')).toBeNull();
    });
  });
});
