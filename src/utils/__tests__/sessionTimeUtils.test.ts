import { deriveTradeDateForSession, getSessionForTimestamp } from 'utils/sessionTimeUtils';

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

describe('deriveTradeDateForSession', () => {
  // Round-trip property: every value the deriver returns must classify as
  // the same session via getSessionForTimestamp. If this ever fails, the
  // trade_date / session column will diverge and Orion will see ghost
  // discrepancies again.
  const roundTrip = (selectedDate: Date, session: string) => {
    const derived = deriveTradeDateForSession(selectedDate, session);
    return getSessionForTimestamp(derived.toISOString());
  };

  describe('during DST (summer)', () => {
    const day = new Date(2026, 6, 15); // July 15 in local TZ

    it('London → 07:00 UTC and round-trips to London', () => {
      const d = deriveTradeDateForSession(day, 'London');
      expect(d.toISOString()).toBe('2026-07-15T07:00:00.000Z');
      expect(roundTrip(day, 'London')).toBe('London');
    });

    it('NY AM → 12:00 UTC and round-trips to NY AM', () => {
      const d = deriveTradeDateForSession(day, 'NY AM');
      expect(d.toISOString()).toBe('2026-07-15T12:00:00.000Z');
      expect(roundTrip(day, 'NY AM')).toBe('NY AM');
    });

    it('NY PM → 17:00 UTC and round-trips to NY PM', () => {
      const d = deriveTradeDateForSession(day, 'NY PM');
      expect(d.toISOString()).toBe('2026-07-15T17:00:00.000Z');
      expect(roundTrip(day, 'NY PM')).toBe('NY PM');
    });

    it('Asia → 00:00 UTC of selected day (stays on user-picked calendar day)', () => {
      const d = deriveTradeDateForSession(day, 'Asia');
      expect(d.toISOString()).toBe('2026-07-15T00:00:00.000Z');
      expect(roundTrip(day, 'Asia')).toBe('Asia');
    });
  });

  describe('during non-DST (winter)', () => {
    const day = new Date(2026, 0, 15); // January 15 in local TZ

    it('London → 08:00 UTC (GMT, no BST)', () => {
      expect(deriveTradeDateForSession(day, 'London').toISOString())
        .toBe('2026-01-15T08:00:00.000Z');
      expect(roundTrip(day, 'London')).toBe('London');
    });

    it('NY AM → 13:00 UTC (EST, no EDT)', () => {
      expect(deriveTradeDateForSession(day, 'NY AM').toISOString())
        .toBe('2026-01-15T13:00:00.000Z');
      expect(roundTrip(day, 'NY AM')).toBe('NY AM');
    });

    it('Asia → 00:00 UTC even in winter (still inside Asia 23:00→08:00 window)', () => {
      expect(deriveTradeDateForSession(day, 'Asia').toISOString())
        .toBe('2026-01-15T00:00:00.000Z');
      expect(roundTrip(day, 'Asia')).toBe('Asia');
    });
  });

  describe('legacy session names', () => {
    const day = new Date(2026, 6, 15);

    it('lowercase "london" normalises to London', () => {
      expect(deriveTradeDateForSession(day, 'london').toISOString())
        .toBe('2026-07-15T07:00:00.000Z');
    });

    it('"new-york" normalises to NY AM', () => {
      expect(deriveTradeDateForSession(day, 'new-york').toISOString())
        .toBe('2026-07-15T12:00:00.000Z');
    });

    it('"tokyo" / "sydney" normalise to Asia', () => {
      expect(deriveTradeDateForSession(day, 'tokyo').toISOString())
        .toBe('2026-07-15T00:00:00.000Z');
      expect(deriveTradeDateForSession(day, 'sydney').toISOString())
        .toBe('2026-07-15T00:00:00.000Z');
    });
  });

  describe('empty / unrecognised session', () => {
    const day = new Date(2026, 6, 15);

    it('empty string falls back to 00:00 UTC of selected day', () => {
      expect(deriveTradeDateForSession(day, '').toISOString())
        .toBe('2026-07-15T00:00:00.000Z');
    });

    it('null falls back to 00:00 UTC of selected day', () => {
      expect(deriveTradeDateForSession(day, null).toISOString())
        .toBe('2026-07-15T00:00:00.000Z');
    });

    it('undefined falls back to 00:00 UTC of selected day', () => {
      expect(deriveTradeDateForSession(day, undefined).toISOString())
        .toBe('2026-07-15T00:00:00.000Z');
    });
  });
});
