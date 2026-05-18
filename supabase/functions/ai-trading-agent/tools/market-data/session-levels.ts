/**
 * get_market_data action="history" `include_session_summary` worker.
 *
 * Computes Asian/London/NY-AM/NY-PM H+L + sweep state for the given `ref`,
 * pulled from a single 15-min Twelve Data fetch covering earliestStart → ref.
 *
 * The breach for each completed session is scored against the IMMEDIATELY
 * FOLLOWING session in the FX cycle (Asia → London → NY AM → NY PM → next
 * Asia), clipped to ref. This cap prevents yesterday's NY PM from being
 * evaluated against the full 16+ hours that followed.
 */

import {
  type Candle,
  fetchTimeSeries,
} from "../../../_shared/twelvedata.ts";
import { fetchYahooTimeSeries } from "../../../_shared/prices.ts";
import {
  classifyForSessions,
  getNextSessionWindow,
  getSessionWindow,
  pipSize,
  pipUnit,
  SCOPED_SESSIONS,
  type ScopedSession,
  type SessionWindow,
  sweepThreshold,
  symbolSupportsSessionLevels,
} from "../../sessions.ts";

/** 15-min is the sweet spot: fine enough to locate the H/L candle, coarse
 *  enough that a full UTC day fits in ~96 bars (well under MAX_CANDLES). */
const SESSION_LEVELS_INTERVAL = "15min" as const;

interface SessionLevels {
  window: SessionWindow;
  high: number;
  low: number;
  highAt: string;
  lowAt: string;
  rangePrice: number;
  rangeUnits: number;
  candleCount: number;
}

type BreachState = "intact" | "swept" | "broken";

interface LevelBreach {
  level: "high" | "low";
  price: number;
  state: BreachState;
  extremePast: number | null;
  lastClose: number | null;
}

/**
 * Render numeric prices with a precision matched to the instrument.
 * Forex non-JPY = 5dp, JPY = 3dp, DXY = 3dp, everything else = 2dp.
 */
function priceFormatter(symbol: string): (n: number) => string {
  const s = symbol.trim().toUpperCase();
  if (s.endsWith("=X")) {
    const dp = /JPY/.test(s) ? 3 : 5;
    return (n) => n.toFixed(dp);
  }
  if (s === "DX-Y.NYB") return (n) => n.toFixed(3);
  return (n) => n.toFixed(2);
}

function formatUtcHm(dateStr: string): string {
  // Twelve Data returns "YYYY-MM-DD HH:mm:ss"; Yahoo normalizer matches.
  const t = dateStr.includes(" ") ? dateStr.split(" ")[1] : dateStr;
  return t.slice(0, 5);
}

function candleTimeMs(c: Candle): number {
  const iso = c.datetime.includes(" ")
    ? c.datetime.replace(" ", "T") + "Z"
    : c.datetime + "T00:00:00Z";
  return Date.parse(iso);
}

function sliceCandlesInWindow(
  candles: Candle[],
  start: Date,
  end: Date,
): Candle[] {
  const s = start.getTime();
  const e = end.getTime();
  return candles.filter((c) => {
    const t = candleTimeMs(c);
    return t >= s && t < e;
  });
}

function computeLevels(
  window: SessionWindow,
  candles: Candle[],
  symbol: string,
): SessionLevels | null {
  if (candles.length === 0) return null;
  let high = candles[0].high;
  let low = candles[0].low;
  let highAt = candles[0].datetime;
  let lowAt = candles[0].datetime;
  for (const c of candles) {
    if (c.high > high) {
      high = c.high;
      highAt = c.datetime;
    }
    if (c.low < low) {
      low = c.low;
      lowAt = c.datetime;
    }
  }
  const rangePrice = high - low;
  return {
    window,
    high,
    low,
    highAt,
    lowAt,
    rangePrice,
    rangeUnits: rangePrice / pipSize(symbol),
    candleCount: candles.length,
  };
}

/**
 * Classify breach state for one level against the post-session candles.
 *
 *  intact  — price never breached the level by ≥ `threshold`.
 *  swept   — price breached by ≥ `threshold` AND the last close is back
 *            inside the level (above for low, below for high).
 *  broken  — price breached and last close remains beyond the level.
 */
function classifyBreach(
  level: "high" | "low",
  price: number,
  postCandles: Candle[],
  threshold: number,
): LevelBreach {
  if (postCandles.length === 0) {
    return { level, price, state: "intact", extremePast: null, lastClose: null };
  }

  let extreme: number | null = null;
  for (const c of postCandles) {
    if (level === "high") {
      if (c.high > price + threshold) {
        extreme = extreme === null ? c.high : Math.max(extreme, c.high);
      }
    } else {
      if (c.low < price - threshold) {
        extreme = extreme === null ? c.low : Math.min(extreme, c.low);
      }
    }
  }

  const lastClose = postCandles[postCandles.length - 1].close;

  if (extreme === null) {
    return { level, price, state: "intact", extremePast: null, lastClose };
  }

  const reclaimed = level === "high" ? lastClose <= price : lastClose >= price;
  return {
    level,
    price,
    state: reclaimed ? "swept" : "broken",
    extremePast: extreme,
    lastClose,
  };
}

function formatLevelsLine(
  levels: SessionLevels,
  fmt: (n: number) => string,
  unit: "p" | "pt",
): string {
  const { window, high, low, highAt, lowAt, rangeUnits, candleCount } = levels;
  const startHm = window.start.toISOString().slice(11, 16);
  const endHm = window.end.toISOString().slice(11, 16);
  const progress = window.inProgress ? " (in progress)" : "";
  const range = unit === "p"
    ? `${rangeUnits.toFixed(1)}p`
    : `${rangeUnits.toFixed(2)}pt`;
  return (
    `${window.session.padEnd(7)} [${startHm}→${endHm}${progress}] ` +
    `H ${fmt(high)} @ ${formatUtcHm(highAt)}  ` +
    `L ${fmt(low)} @ ${formatUtcHm(lowAt)}  ` +
    `R ${range}  (${candleCount} bars)`
  );
}

function formatBreachLine(
  breach: LevelBreach,
  fmt: (n: number) => string,
  symbol: string,
): string {
  const arrow = breach.level === "high" ? "▲" : "▼";
  const label = breach.level === "high" ? "H" : "L";
  const unit = pipUnit(symbol);
  const pip = pipSize(symbol);

  if (breach.state === "intact") {
    return `  ${arrow} ${label} ${fmt(breach.price)}: intact`;
  }
  const extreme = breach.extremePast!;
  const dist = Math.abs(extreme - breach.price) / pip;
  const distStr = unit === "p" ? `${dist.toFixed(1)}p` : `${dist.toFixed(2)}pt`;
  if (breach.state === "swept") {
    return (
      `  ${arrow} ${label} ${fmt(breach.price)}: SWEPT — pierced to ${
        fmt(extreme)
      } (${distStr} past), closed back inside at ${fmt(breach.lastClose!)}`
    );
  }
  return (
    `  ${arrow} ${label} ${fmt(breach.price)}: BROKEN — through to ${
      fmt(extreme)
    } (${distStr} past), last close ${fmt(breach.lastClose!)}`
  );
}

/**
 * Scope for one completed session's breach evaluation: the candles inside
 * the immediately-following session's window (clipped to `ref`). Returns
 * null when the next session hasn't started yet, so callers skip the
 * breach line entirely rather than emit a misleading "intact".
 */
interface BreachScope {
  evaluatorSession: ScopedSession;
  windowStart: Date;
  windowEnd: Date;
  evaluatorInProgress: boolean;
}

function computeBreachScope(
  w: SessionWindow,
  ref: Date,
): BreachScope | null {
  const nextWindow = getNextSessionWindow(w.session, w.end);
  const refMs = ref.getTime();
  if (nextWindow.start.getTime() >= refMs) return null;
  const windowEndMs = Math.min(nextWindow.end.getTime(), refMs);
  return {
    evaluatorSession: nextWindow.session,
    windowStart: nextWindow.start,
    windowEnd: new Date(windowEndMs),
    evaluatorInProgress: windowEndMs < nextWindow.end.getTime(),
  };
}

export async function executeGetSessionLevels(args: {
  symbol: string;
  sessions?: string[];
  ref?: Date; // injectable for tests
}): Promise<string> {
  const symbol = (args.symbol || "").trim();
  if (!symbol) {
    return `get_market_data action="session_levels" requires \`symbol\`.`;
  }

  // Reject single stocks — RTH-only tape makes Asian/London highs meaningless.
  if (!symbolSupportsSessionLevels(symbol)) {
    return (
      `Session highs/lows don't apply to "${symbol}" — single-name stocks ` +
      `only trade during US RTH (14:30–21:00 UTC), so there's no Asian or ` +
      `London tape to slice. For overnight gap or pre-market range, call ` +
      `action="history" with a custom start_date / end_date instead.`
    );
  }

  const ref = args.ref ?? new Date();

  const requested = Array.isArray(args.sessions) && args.sessions.length > 0
    ? args.sessions
    : [...SCOPED_SESSIONS];
  const sessions: ScopedSession[] = [];
  for (const s of requested) {
    if ((SCOPED_SESSIONS as readonly string[]).includes(s)) {
      sessions.push(s as ScopedSession);
    } else {
      return (
        `get_market_data action="session_levels": invalid session "${s}". ` +
        `Valid: ${SCOPED_SESSIONS.join(", ")}.`
      );
    }
  }

  // Compute each session's UTC window relative to `ref`. We need candle data
  // covering [earliest session start] → `ref` so we can also evaluate the
  // breach state of each session against the activity that followed.
  const windows = sessions.map((s) => getSessionWindow(s, ref));
  const earliestStart = windows.reduce(
    (acc, w) => (w.start.getTime() < acc.getTime() ? w.start : acc),
    windows[0].start,
  );

  const toApiDate = (d: Date) =>
    d.toISOString().replace("T", " ").slice(0, 19);
  const start_date = toApiDate(earliestStart);
  const end_date = toApiDate(ref);

  // CRITICAL: pass timezone="UTC" so candle datetimes are UTC-stamped.
  // Without this Twelve Data defaults to the symbol's *exchange* timezone
  // (e.g. ^GSPC → America/New_York), and our UTC-window slicer would
  // assign every candle to the wrong session. Yahoo's fallback already
  // emits UTC via `new Date(ts*1000).toISOString()`.
  let candles: Candle[] | null = await fetchTimeSeries(symbol, {
    interval: SESSION_LEVELS_INTERVAL,
    startDate: start_date,
    endDate: end_date,
    timezone: "UTC",
  });
  let chronological = false;

  if (candles === null) {
    const period1 = Math.floor(earliestStart.getTime() / 1000);
    const period2 = Math.floor(ref.getTime() / 1000);
    candles = await fetchYahooTimeSeries(symbol, {
      interval: SESSION_LEVELS_INTERVAL,
      period1,
      period2,
    });
    chronological = true;
  }

  if (candles === null) {
    return (
      `Could not fetch ${SESSION_LEVELS_INTERVAL} candles for "${symbol}" — ` +
      `data source unavailable. Retry, or call action="quote" for current ` +
      `price only.`
    );
  }
  if (candles.length === 0) {
    return (
      `No ${SESSION_LEVELS_INTERVAL} data for ${symbol} from ${start_date} ` +
      `to ${end_date} (UTC). Market likely closed (weekend / holiday). ` +
      `Session levels need an open tape — try after the next session open.`
    );
  }

  const ordered = chronological ? candles : [...candles].reverse();

  // Compute each window's levels. Drop windows that yielded zero candles
  // (off-tape sessions like Asia on Saturday).
  const levelsBySession = new Map<ScopedSession, SessionLevels>();
  for (const w of windows) {
    const slice = sliceCandlesInWindow(ordered, w.start, w.end);
    const lvl = computeLevels(w, slice, symbol);
    if (lvl) levelsBySession.set(w.session, lvl);
  }

  if (levelsBySession.size === 0) {
    return (
      `No candles fell inside the requested session windows for ${symbol} ` +
      `(UTC ${start_date} → ${end_date}). Market likely closed.`
    );
  }

  // For each completed session, classify how the next-in-cycle session
  // treated its high/low. Scope is bounded by computeBreachScope below.
  const fmt = priceFormatter(symbol);
  const unit = pipUnit(symbol);
  const threshold = sweepThreshold(symbol);

  const levelLines: string[] = [];
  for (const w of windows) {
    const lvl = levelsBySession.get(w.session);
    if (lvl) levelLines.push(formatLevelsLine(lvl, fmt, unit));
  }

  // Breach scope = immediately-following session's window (clipped to ref).
  // Cap exists so yesterday's NY PM doesn't get evaluated against the entire
  // 16h that followed; it gets evaluated against last night's Asia only.
  const breachBlocks: string[] = [];
  for (const w of windows) {
    const lvl = levelsBySession.get(w.session);
    if (!lvl || w.inProgress) continue;
    const scope = computeBreachScope(w, ref);
    if (!scope) continue;
    const post = sliceCandlesInWindow(
      ordered,
      scope.windowStart,
      scope.windowEnd,
    );
    if (post.length === 0) continue;
    const highBreach = classifyBreach("high", lvl.high, post, threshold);
    const lowBreach = classifyBreach("low", lvl.low, post, threshold);
    const evalStartHm = scope.windowStart.toISOString().slice(11, 16);
    const evalEndHm = scope.windowEnd.toISOString().slice(11, 16);
    const progress = scope.evaluatorInProgress ? " (in progress)" : "";
    breachBlocks.push(
      `vs ${w.session} levels (during ${scope.evaluatorSession} ` +
        `[${evalStartHm}→${evalEndHm}${progress}], ${post.length} bars):\n` +
        `${formatBreachLine(highBreach, fmt, symbol)}\n` +
        `${formatBreachLine(lowBreach, fmt, symbol)}`,
    );
  }

  const lastClose = ordered[ordered.length - 1].close;
  const refIso = ref.toISOString().slice(0, 16) + "Z";
  const dayLine = `Reference: ${refIso}  |  Last close: ${fmt(lastClose)}`;
  const cls = classifyForSessions(symbol);
  const classNote = cls === "single_stock" ? "" : ` (${cls})`;

  return (
    `${symbol}${classNote} — Session Levels\n${dayLine}\n` +
    `${levelLines.join("\n")}\n\n${breachBlocks.join("\n\n")}`
  ).trimEnd();
}
