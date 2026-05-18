/**
 * DST-aware FX/global-market trading session helpers.
 *
 * Two callers:
 *   - systemPrompt.buildTemporalContext — reports the *current* session
 *     name in the prompt header.
 *   - tools.executeGetSessionLevels — needs full UTC windows for Asia /
 *     London / NY AM / NY PM on a given reference date so we can slice
 *     candles and compute high/low + sweep state server-side.
 *
 * Boundaries match the FX market convention used by the rest of the codebase
 * (the `session` enum on trades, the briefing schedule, etc.):
 *
 *   Winter (UTC, EU DST off)         Summer (UTC, EU DST on)
 *   Asia    23:00 → 08:00 (next day)  Asia    22:00 → 07:00 (next day)
 *   London  08:00 → 13:00              London  07:00 → 12:00
 *   NY AM   13:00 → 18:00              NY AM   12:00 → 17:00
 *   NY PM   18:00 → 22:00              NY PM   17:00 → 21:00
 *
 * Asia wraps midnight (start > end) — `getSessionWindow` produces a
 * concrete [start, end] Date pair that already resolves the wrap.
 */

export type TradingSession = "Asia" | "London" | "NY AM" | "NY PM" | "After Hours";

export type ScopedSession = Exclude<TradingSession, "After Hours">;

export const SCOPED_SESSIONS: readonly ScopedSession[] = [
  "Asia",
  "London",
  "NY AM",
  "NY PM",
] as const;

export function isDaylightSavingTime(
  date: Date,
  region: "EU" | "US" = "EU",
): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (region === "EU") {
    if (month < 2 || month > 9) return false;
    if (month > 2 && month < 9) return true;
    if (month === 2) return day >= getLastSundayOfMonth(year, 2);
    if (month === 9) return day < getLastSundayOfMonth(year, 9);
  } else {
    if (month < 2 || month > 10) return false;
    if (month > 2 && month < 10) return true;
    if (month === 2) return day >= getNthSundayOfMonth(year, 2, 2);
    if (month === 10) return day < getNthSundayOfMonth(year, 10, 1);
  }
  return false;
}

function getLastSundayOfMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

function getNthSundayOfMonth(year: number, month: number, n: number): number {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysToFirstSunday = (7 - firstDay.getUTCDay()) % 7;
  return 1 + daysToFirstSunday + (n - 1) * 7;
}

interface SessionBounds {
  /** UTC hour the session opens. */
  startHour: number;
  /** UTC hour the session closes. For Asia this is on the *next* UTC day. */
  endHour: number;
  /** True for Asia — start > end on the same calendar day. */
  crossesMidnight: boolean;
}

function sessionBoundsForDate(
  session: ScopedSession,
  ref: Date,
): SessionBounds {
  const isDST = isDaylightSavingTime(ref, "EU");
  switch (session) {
    case "London":
      return {
        startHour: isDST ? 7 : 8,
        endHour: isDST ? 12 : 13,
        crossesMidnight: false,
      };
    case "NY AM":
      return {
        startHour: isDST ? 12 : 13,
        endHour: isDST ? 17 : 18,
        crossesMidnight: false,
      };
    case "NY PM":
      return {
        startHour: isDST ? 17 : 18,
        endHour: isDST ? 21 : 22,
        crossesMidnight: false,
      };
    case "Asia":
      return {
        startHour: isDST ? 22 : 23,
        endHour: isDST ? 7 : 8,
        crossesMidnight: true,
      };
  }
}

export function getCurrentTradingSession(
  now: Date = new Date(),
): TradingSession {
  const hour = now.getUTCHours();
  for (const session of SCOPED_SESSIONS) {
    const { startHour, endHour, crossesMidnight } = sessionBoundsForDate(
      session,
      now,
    );
    if (crossesMidnight) {
      if (hour >= startHour || hour < endHour) return session;
    } else if (hour >= startHour && hour < endHour) {
      return session;
    }
  }
  return "After Hours";
}

export interface SessionWindow {
  session: ScopedSession;
  /** UTC instant of the session open used for slicing. */
  start: Date;
  /** UTC instant of the session close (exclusive). For an in-progress
   * session this equals `ref` so callers can compute a partial H/L. */
  end: Date;
  /** True if `ref` falls inside the [start, end) interval — partial H/L. */
  inProgress: boolean;
}

/**
 * Resolve the most recent window for a named session relative to `ref`.
 *
 * - If the session is currently active, returns [open, ref] with
 *   `inProgress: true` so callers can compute the partial high/low.
 * - Otherwise returns the most recently *completed* [open, close] window
 *   prior to `ref`. For Asia near the day boundary this often crosses
 *   into the previous UTC date.
 *
 * DST is evaluated using the date of the session open, not `ref` — so a
 * London window on a DST transition Sunday still uses the right boundary.
 */
export function getSessionWindow(
  session: ScopedSession,
  ref: Date = new Date(),
): SessionWindow {
  const refMs = ref.getTime();
  const dayMs = 86_400_000;

  // Try the window anchored on each of: today, yesterday, two-days-ago.
  // Whichever yields an end > ref (in progress) or end ≤ ref (most recently
  // completed) wins. We iterate yesterday→today→tomorrow to cover Asia's
  // midnight-wrap and to be robust around DST transition days.
  let bestCompleted: SessionWindow | null = null;
  let inProgress: SessionWindow | null = null;

  for (let offsetDays = -1; offsetDays <= 1 && !inProgress; offsetDays++) {
    const anchor = new Date(refMs + offsetDays * dayMs);
    const bounds = sessionBoundsForDate(session, anchor);

    const start = new Date(
      Date.UTC(
        anchor.getUTCFullYear(),
        anchor.getUTCMonth(),
        anchor.getUTCDate(),
        bounds.startHour,
        0,
        0,
        0,
      ),
    );
    const endAnchor = bounds.crossesMidnight
      ? new Date(start.getTime() + dayMs)
      : start;
    const end = new Date(
      Date.UTC(
        endAnchor.getUTCFullYear(),
        endAnchor.getUTCMonth(),
        endAnchor.getUTCDate(),
        bounds.endHour,
        0,
        0,
        0,
      ),
    );

    if (refMs >= start.getTime() && refMs < end.getTime()) {
      inProgress = { session, start, end: ref, inProgress: true };
    } else if (end.getTime() <= refMs) {
      if (
        !bestCompleted ||
        end.getTime() > bestCompleted.end.getTime()
      ) {
        bestCompleted = { session, start, end, inProgress: false };
      }
    }
  }

  if (inProgress) return inProgress;
  // Fallback shouldn't fire in practice, but keep types total.
  if (bestCompleted) return bestCompleted;
  return {
    session,
    start: new Date(refMs - dayMs),
    end: ref,
    inProgress: false,
  };
}

/**
 * The session that follows `prev` in the FX cycle. Used to scope "did
 * session X get swept" questions to the immediately-following session's
 * activity rather than every candle since.
 *
 *   Asia → London → NY AM → NY PM → Asia (next day)
 */
export function nextInCycle(prev: ScopedSession): ScopedSession {
  const i = SCOPED_SESSIONS.indexOf(prev);
  return SCOPED_SESSIONS[(i + 1) % SCOPED_SESSIONS.length];
}

/**
 * Window of the session that follows `prev` in the FX cycle, anchored on
 * `prevEnd`'s UTC date. For the three contiguous transitions
 * (Asia→London, London→NY AM, NY AM→NY PM) the returned window's `start`
 * equals `prevEnd`. For NY PM→Asia there is a 1-hour gap (NY PM closes
 * 21/22 UTC, Asia opens 22/23 UTC), so `start` is strictly later.
 *
 * Note: this returns the *theoretical* window based on session bounds.
 * It does not check whether the window has elapsed relative to a current
 * clock — callers wanting to cap at "now" should `min(window.end, now)`.
 */
export function getNextSessionWindow(
  prev: ScopedSession,
  prevEnd: Date,
): SessionWindow {
  const next = nextInCycle(prev);
  const bounds = sessionBoundsForDate(next, prevEnd);
  const dayMs = 86_400_000;
  const rawStart = new Date(
    Date.UTC(
      prevEnd.getUTCFullYear(),
      prevEnd.getUTCMonth(),
      prevEnd.getUTCDate(),
      bounds.startHour,
      0,
      0,
      0,
    ),
  );
  const endAnchor = bounds.crossesMidnight
    ? new Date(rawStart.getTime() + dayMs)
    : rawStart;
  const end = new Date(
    Date.UTC(
      endAnchor.getUTCFullYear(),
      endAnchor.getUTCMonth(),
      endAnchor.getUTCDate(),
      bounds.endHour,
      0,
      0,
      0,
    ),
  );
  // Clamp start to `prevEnd` so DST-transition anchor mismatches can't
  // produce a "next" window that begins BEFORE the previous session
  // ended. Concrete case: Mar 29 (EU DST starts at 01:00 UTC). Asia
  // anchored on Mar 28 (winter) ends Mar 29 08:00. Next London anchored
  // on Mar 29 (summer) opens Mar 29 07:00. Without clamping the breach
  // scope would overlap Asia's last hour.
  const start = rawStart.getTime() < prevEnd.getTime() ? prevEnd : rawStart;
  return { session: next, start, end, inProgress: false };
}

// =============================================================================
// Asset class gating — sessions are only meaningful for 24h markets.
// =============================================================================

export type SessionAssetClass =
  | "fx" // forex pairs
  | "metal_energy_future" // GC=F, CL=F, etc. — 24h CME / ICE
  | "grain_future" // ZC=F, ZS=F, ZW=F — CBOT grains, also 24h via Globex
  | "index_or_etf" // ^GSPC, SPY — RTH primary but pre/post + futures track 24h
  | "crypto" // BTC-USD — true 24/7
  | "bond_yield_future" // ^TNX, ZB=F, ZN=F, ZF=F
  | "single_stock"; // AAPL, TSLA — RTH only; sessions don't apply

/**
 * Classify a Yahoo-format symbol for session purposes.
 *
 * Returns `single_stock` for symbols where the Asia/London/NY-AM session
 * concept is meaningless (the venue is closed outside RTH). Caller should
 * reject those before computing session H/L to avoid garbage output.
 */
export function classifyForSessions(symbol: string): SessionAssetClass {
  const s = symbol.trim().toUpperCase();

  // Forex: "EURUSD=X", "GBPJPY=X", "DX-Y.NYB" (DXY)
  if (s.endsWith("=X") || s === "DX-Y.NYB") return "fx";

  // Crypto: "-USD" suffix
  if (s.endsWith("-USD")) return "crypto";

  // CME / ICE / CBOT futures — disambiguate Z-prefix tickers since both
  // bonds (ZB/ZN/ZF) and grains (ZC/ZS/ZW) share it.
  if (s.endsWith("=F")) {
    if (/^Z[BNF]=F$/.test(s)) return "bond_yield_future";
    if (/^Z[CSW]=F$/.test(s)) return "grain_future";
    return "metal_energy_future";
  }

  // Bond yield indices on Yahoo (^TNX/^FVX/^TYX/^IRX)
  if (/^\^(TNX|FVX|TYX|IRX)$/.test(s)) return "bond_yield_future";

  // Index symbols (^GSPC, ^IXIC, ^DJI, ^RUT, ^VIX, ^FTSE, ^GDAXI, ^N225, ...)
  if (s.startsWith("^")) return "index_or_etf";

  // Common ETF tickers we treat as indices for session purposes
  if (/^(SPY|QQQ|IWM|DIA|TLT)$/.test(s)) return "index_or_etf";

  return "single_stock";
}

/**
 * True when computing Asian/London/NY-AM session levels is meaningful for
 * the symbol. False for single stocks (no overnight tape) — caller should
 * return an error pointing them at RTH-aware alternatives.
 */
export function symbolSupportsSessionLevels(symbol: string): boolean {
  return classifyForSessions(symbol) !== "single_stock";
}

// =============================================================================
// Pip / point sizing — for human-readable range + breach deltas.
// =============================================================================

/**
 * Smallest meaningful price move for the symbol, used to render "range" and
 * "breach distance" in a unit the trader expects.
 *
 * Forex non-JPY pip = 0.0001. Forex JPY pip = 0.01. DXY = 0.001 (3dp index).
 * Everything else: point = 1.0 unit (gold $1, ES 1 index pt, BTC $1).
 */
export function pipSize(symbol: string): number {
  const s = symbol.trim().toUpperCase();
  if (s.endsWith("=X")) {
    // JPY crosses quote 3dp, pip is 0.01. Non-JPY quote 5dp, pip is 0.0001.
    return /JPY/.test(s) ? 0.01 : 0.0001;
  }
  if (s === "DX-Y.NYB") return 0.001;
  return 1; // points for indices, futures, crypto
}

/** Unit label that pairs with `pipSize` for display. */
export function pipUnit(symbol: string): "p" | "pt" {
  const cls = classifyForSessions(symbol);
  return cls === "fx" ? "p" : "pt";
}

/**
 * Sweep threshold — minimum breach (in price units, not pips) above/below a
 * session level for the breach to count as a "sweep" rather than noise.
 *
 * 1 pip for forex (0.0001 non-JPY, 0.01 JPY) — anything smaller is broker
 * spread noise. Indices/futures/crypto: 0 (any breach + close back inside).
 */
export function sweepThreshold(symbol: string): number {
  const cls = classifyForSessions(symbol);
  return cls === "fx" ? pipSize(symbol) : 0;
}
