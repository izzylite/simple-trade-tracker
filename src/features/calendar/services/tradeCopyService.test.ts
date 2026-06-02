import {
  computeCopyAmount,
  buildCopiedTradePayload,
  summarizeCopyResults,
  sourceObjectPath,
  freshImageId,
  copyTradeToCalendars,
  CopyResult,
} from './tradeCopyService';
import { makeTrade, win, loss, breakeven } from 'test-utils/makeTrade';
import { Calendar, Trade, TradeImageEntity, YearStats } from 'features/calendar/types/dualWrite';

// Mock infra modules that throw at import when env vars are missing, plus the
// heavy sibling imports pulled in transitively (supabaseStorageService imports
// the TradeForm component; dynamicRiskUtils imports TradeRepository). The pure
// PnL functions stay exercised against the REAL dynamicRiskUtils.
const mockStorageCopy = jest.fn();
const mockStorageRemove = jest.fn();
const mockGetUser = jest.fn();
jest.mock('config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    storage: {
      from: () => ({
        copy: (...a: unknown[]) => mockStorageCopy(...a),
        remove: (...a: unknown[]) => mockStorageRemove(...a),
      }),
    },
  },
  supabaseUrl: 'http://test.local',
}));
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() },
}));
jest.mock('services/supabaseStorageService', () => ({
  getPublicUrl: jest.fn((b: string, p: string) => `https://example.test/${b}/${p}`),
  uploadTradeImage: jest.fn(),
}));
const mockAddTrade = jest.fn();
const mockGetTradeById = jest.fn();
const mockGetAllTrades = jest.fn();
jest.mock('features/calendar/services/calendarService', () => ({
  addTrade: (...a: unknown[]) => mockAddTrade(...a),
  getTradeById: (...a: unknown[]) => mockGetTradeById(...a),
  getAllTrades: (...a: unknown[]) => mockGetAllTrades(...a),
}));
jest.mock('features/events/services/tradeEconomicEventService', () => ({
  tradeEconomicEventService: {},
}));
jest.mock('features/events/services/instrumentCatalog', () => ({
  getRelevantCurrenciesFromTags: jest.fn(() => []),
}));

// jsdom may not provide crypto.randomUUID, which freshImageId relies on.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...(globalThis.crypto || {}),
      randomUUID: () => 'test-' + Math.random().toString(36).slice(2),
    },
    configurable: true,
  });
}

const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar =>
  ({
    id: 'dest-cal',
    user_id: 'user-1',
    name: 'Dest',
    account_balance: 10000,
    max_daily_drawdown: 0,
    ...overrides,
  } as Calendar);

describe('computeCopyAmount', () => {
  it('carries the raw amount when the destination has no risk_per_trade', async () => {
    const t = win(210, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ risk_per_trade: undefined });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(210);
  });

  it('returns 0 for breakeven trades', async () => {
    const t = breakeven(0, new Date(2026, 0, 15));
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(0);
  });

  it('carries the raw amount when the trade has no risk_to_reward', async () => {
    const t = win(500, new Date(2026, 0, 15), { risk_to_reward: undefined });
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(500);
  });

  it('carries the raw amount when partials were taken', async () => {
    const t = win(777, new Date(2026, 0, 15), { risk_to_reward: 3, partials_taken: true });
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(777);
  });

  it('recalculates a win for the destination risk model', async () => {
    const t = win(210, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ account_balance: 50000, risk_per_trade: 2 });
    // riskAmount = 50000 * 2% = 1000; win => 1000 * 2 = 2000
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(2000);
  });

  it('recalculates a loss as a NEGATIVE amount', async () => {
    const t = loss(-105, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ account_balance: 50000, risk_per_trade: 2 });
    // riskAmount = 1000; loss => -1000
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(-1000);
  });

  it('honors destination dynamic risk when the profit threshold is crossed', async () => {
    const t = loss(-100, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({
      account_balance: 10000,
      risk_per_trade: 1,
      dynamic_risk_enabled: true,
      increased_risk_percentage: 2,
      profit_threshold_percentage: 5,
    });
    // prior same-month trade before the date: +600 => 6% > 5% threshold => effRisk 2%
    const prior = [win(600, new Date(2026, 0, 10))];
    // riskAmount = (10000 + 600) * 2% = 212; loss => -212
    await expect(computeCopyAmount(t, dest, prior)).resolves.toBe(-212);
  });

  it('uses base risk when the dynamic threshold is not crossed', async () => {
    const t = loss(-100, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({
      account_balance: 10000,
      risk_per_trade: 1,
      dynamic_risk_enabled: true,
      increased_risk_percentage: 2,
      profit_threshold_percentage: 5,
    });
    const prior = [win(400, new Date(2026, 0, 10))]; // 4% < 5%
    // riskAmount = (10000 + 400) * 1% = 104; loss => -104
    await expect(computeCopyAmount(t, dest, prior)).resolves.toBe(-104);
  });

  it('reflects a non-zero year_stats account_value_at_start baseline (at-scale case)', async () => {
    const t = win(0, new Date(2026, 0, 15), { risk_to_reward: 2 });
    // account_balance 10000 but the month already started at 13000 (+3000 carried).
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month_index: i,
      month_pnl: 0,
      trade_count: 0,
      win_count: 0,
      loss_count: 0,
      growth_percentage: 0,
      account_value_at_start: i === 0 ? 13000 : 10000,
    }));
    const yearStats: Record<string, YearStats> = {
      '2026': {
        year: 2026,
        yearly_pnl: 0,
        yearly_growth_percentage: 0,
        total_trades: 0,
        win_count: 0,
        loss_count: 0,
        win_rate: 0,
        best_month_index: 0,
        best_month_pnl: 0,
        monthly_stats: monthly,
      },
    };
    const dest = makeCalendar({ account_balance: 10000, risk_per_trade: 1, year_stats: yearStats });
    // cumulativePnLAtMonthStart = 13000 - 10000 = 3000; no prior in-month trades.
    // riskAmount = (10000 + 3000) * 1% = 130; win RR 2 => 260
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(260);
  });
});

describe('buildCopiedTradePayload', () => {
  it('strips source/sync/share fields and applies standalone overrides', () => {
    const img: TradeImageEntity = { id: 'old', url: 'u', calendar_id: 'src-cal' };
    const newImg: TradeImageEntity = { id: 'new', url: 'u2', calendar_id: 'dest-cal' };
    const src = makeTrade({
      id: 'src-trade',
      calendar_id: 'src-cal',
      trade_type: 'win',
      amount: 210,
      risk_to_reward: 2,
      tags: ['Asset:EURUSD', 'Counter Trend'],
      notes: 'keep me',
      session: 'London',
      is_pinned: true,
      is_temporary: true,
      source_trade_id: 'someone',
      is_synced_copy: true,
      share_link: 'x',
      is_shared: true,
      share_id: 'sid',
      images: [img],
    });

    const payload = buildCopiedTradePayload(src, 'dest-cal', 1999, [newImg]);

    expect(payload.calendar_id).toBe('dest-cal');
    expect(payload.amount).toBe(1999);
    expect(payload.images).toEqual([newImg]);
    expect(payload.source_trade_id).toBeUndefined();
    expect(payload.is_synced_copy).toBe(false);
    expect(payload.is_pinned).toBe(false);
    expect(payload.is_temporary).toBe(false);
    expect(payload.share_link).toBeUndefined();
    expect(payload.is_shared).toBe(false);
    expect(payload.share_id).toBeUndefined();
    // preserved fields
    expect(payload.tags).toEqual(['Asset:EURUSD', 'Counter Trend']);
    expect(payload.notes).toBe('keep me');
    expect(payload.session).toBe('London');
    expect(payload.risk_to_reward).toBe(2);
    expect(payload.trade_type).toBe('win');
    expect((payload as Record<string, unknown>).id).toBeUndefined();
    expect((payload as Record<string, unknown>).created_at).toBeUndefined();
    expect((payload as Record<string, unknown>).updated_at).toBeUndefined();
  });
});

describe('summarizeCopyResults', () => {
  const ok = (name: string): CopyResult => ({ calendarId: name, calendarName: name, status: 'success' });
  const bad = (name: string): CopyResult => ({ calendarId: name, calendarName: name, status: 'error', error: 'boom' });

  it('all success (single)', () => {
    expect(summarizeCopyResults([ok('A')])).toEqual({ kind: 'success', message: 'Copied trade to A.' });
  });
  it('all success (multiple)', () => {
    expect(summarizeCopyResults([ok('A'), ok('B'), ok('C')])).toEqual({
      kind: 'success',
      message: 'Copied trade to 3 calendars.',
    });
  });
  it('partial success is a warning, not an error', () => {
    const r = summarizeCopyResults([ok('A'), ok('B'), bad('C')]);
    expect(r.kind).toBe('warning');
    expect(r.message).toContain('2 of 3');
    expect(r.message).toContain('C');
  });
  it('all failed', () => {
    const r = summarizeCopyResults([bad('A'), bad('B')]);
    expect(r.kind).toBe('error');
    expect(r.message).toContain("Couldn't copy");
  });
  it('notes when images were omitted', () => {
    const r = summarizeCopyResults([{ calendarId: 'A', calendarName: 'A', status: 'success', imagesOmitted: true }]);
    expect(r.message).toContain('without images');
  });
});

describe('sourceObjectPath', () => {
  const img = (o: Partial<TradeImageEntity>): TradeImageEntity =>
    ({ id: 'i', url: '', calendar_id: 'c', ...o } as TradeImageEntity);

  it('prefers an explicit storage_path', () => {
    expect(sourceObjectPath(img({ storage_path: 'users/u/trade-images/a.png', url: 'whatever' }))).toBe(
      'users/u/trade-images/a.png'
    );
  });
  it('extracts the object path from a public URL', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/trade-images/users/u/trade-images/a.png';
    expect(sourceObjectPath(img({ url }))).toBe('users/u/trade-images/a.png');
  });
  it('decodes percent-encoded path segments', () => {
    const url = 'https://x/storage/v1/object/public/trade-images/users/u/trade-images/a%20b.png';
    expect(sourceObjectPath(img({ url }))).toBe('users/u/trade-images/a b.png');
  });
  it('returns null when neither storage_path nor a matching url marker is present', () => {
    expect(sourceObjectPath(img({ url: 'https://x/not-a-storage-url.png' }))).toBeNull();
  });
});

describe('freshImageId', () => {
  it('preserves the source extension', () => {
    expect(freshImageId('users/u/trade-images/photo.png')).toMatch(/\.png$/);
    expect(freshImageId('a/b/c.JPEG')).toMatch(/\.JPEG$/);
  });
  it('handles a path with no extension', () => {
    expect(freshImageId('users/u/trade-images/noext')).not.toMatch(/\./);
  });
});

describe('copyTradeToCalendars', () => {
  const srcTrade = (o: Partial<Trade> = {}): Trade =>
    makeTrade({ id: 'src', amount: 111, trade_type: 'win', risk_to_reward: 2, ...o });
  // destination with NO risk_per_trade so computeCopyAmount short-circuits (no DB).
  const dest = (id: string, name: string): Calendar => makeCalendar({ id, name });

  beforeEach(() => {
    mockStorageCopy.mockReset().mockResolvedValue({ error: null });
    mockStorageRemove.mockReset().mockResolvedValue({ error: null });
    mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockAddTrade.mockReset().mockResolvedValue({ id: 'new' });
    mockGetTradeById.mockReset().mockResolvedValue(null); // fall back to in-memory trade
  });

  it('re-fetches the source trade so the persisted amount is used, not the in-memory one', async () => {
    // in-memory trade carries a hypothetical amount (111); DB row carries 999.
    mockGetTradeById.mockResolvedValue(srcTrade({ amount: 999 }));
    const results = await copyTradeToCalendars(srcTrade({ amount: 111 }), [dest('a', 'Alpha')]);
    expect(results).toEqual([{ calendarId: 'a', calendarName: 'Alpha', status: 'success', imagesOmitted: false }]);
    expect(mockGetTradeById).toHaveBeenCalledWith('src');
    expect(mockAddTrade).toHaveBeenCalledTimes(1);
    expect(mockAddTrade.mock.calls[0][1].amount).toBe(999);
  });

  it('isolates failures per destination and fires onResult for each', async () => {
    mockAddTrade.mockRejectedValueOnce(new Error('insert A failed')).mockResolvedValueOnce({ id: 'b' });
    const seen: CopyResult[] = [];
    const results = await copyTradeToCalendars(
      srcTrade(),
      [dest('a', 'Alpha'), dest('b', 'Beta')],
      (r) => seen.push(r)
    );
    expect(results.map((r) => r.status)).toEqual(['error', 'success']);
    expect(results[0].calendarName).toBe('Alpha');
    expect(seen).toHaveLength(2);
  });

  it('flags imagesOmitted when an image copy fails but still creates the trade', async () => {
    mockStorageCopy.mockResolvedValue({ error: new Error('rls') });
    mockGetTradeById.mockResolvedValue(
      srcTrade({ images: [{ id: 'old', url: 'u', calendar_id: 'src', storage_path: 'users/u1/trade-images/old.png' }] })
    );
    const results = await copyTradeToCalendars(srcTrade(), [dest('a', 'Alpha')]);
    expect(results[0].status).toBe('success');
    expect(results[0].imagesOmitted).toBe(true);
    expect(mockAddTrade).toHaveBeenCalledTimes(1);
    expect(mockAddTrade.mock.calls[0][1].images).toEqual([]);
  });

  it('removes orphaned copied images when the insert fails after copy', async () => {
    mockStorageCopy.mockResolvedValue({ error: null });
    mockGetTradeById.mockResolvedValue(
      srcTrade({ images: [{ id: 'old', url: 'u', calendar_id: 'src', storage_path: 'users/u1/trade-images/old.png' }] })
    );
    mockAddTrade.mockRejectedValue(new Error('insert failed'));
    const results = await copyTradeToCalendars(srcTrade(), [dest('a', 'Alpha')]);
    expect(results[0].status).toBe('error');
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = mockStorageRemove.mock.calls[0][0] as string[];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toMatch(/^users\/u1\/trade-images\/.+\.png$/);
  });
});
