import {
  computeCopyAmount,
  buildCopiedTradePayload,
  summarizeCopyResults,
  CopyResult,
} from './tradeCopyService';
import { makeTrade, win, loss, breakeven } from 'test-utils/makeTrade';
import { Calendar, TradeImageEntity } from 'features/calendar/types/dualWrite';

// Mock infra modules that throw at import when env vars are missing, plus the
// heavy sibling imports pulled in transitively (supabaseStorageService imports
// the TradeForm component; dynamicRiskUtils imports TradeRepository). The pure
// functions under test don't touch any of these at runtime — dynamicRiskUtils
// itself stays REAL so the recalc is exercised for real.
jest.mock('config/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), storage: { from: jest.fn() } },
  supabaseUrl: 'http://test.local',
}));
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() },
}));
jest.mock('services/supabaseStorageService', () => ({
  getPublicUrl: jest.fn(() => 'https://example.test/img'),
  uploadTradeImage: jest.fn(),
}));
jest.mock('features/calendar/services/calendarService', () => ({
  addTrade: jest.fn(),
  getAllTrades: jest.fn(),
}));
jest.mock('features/events/services/tradeEconomicEventService', () => ({
  tradeEconomicEventService: {},
}));
jest.mock('features/events/services/instrumentCatalog', () => ({
  getRelevantCurrenciesFromTags: jest.fn(() => []),
}));

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
  it('partial success', () => {
    const r = summarizeCopyResults([ok('A'), ok('B'), bad('C')]);
    expect(r.kind).toBe('error');
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
