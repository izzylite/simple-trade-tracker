import { TradeRepository } from 'services/repositories/TradeRepository';
import { supabase } from 'config/supabase';
import { queryResolving } from 'test-utils/mockSupabase';

// Mock the module that throws at import when env vars are missing, plus the
// heavy sibling imports TradeRepository pulls in at module load.
jest.mock('config/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
  supabaseUrl: 'http://test.local',
}));
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('services/supabaseStorageService', () => ({ uploadTradeImage: jest.fn() }));
jest.mock('features/events/services/tradeEconomicEventService', () => ({
  tradeEconomicEventService: {},
  getRelevantCurrenciesFromTags: jest.fn(() => []),
}));

const mockFrom = supabase.from as jest.Mock;

const rawTrade = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  calendar_id: 'c1',
  user_id: 'u1',
  amount: 100,
  trade_type: 'win',
  trade_date: '2026-01-15T10:00:00.000Z',
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
  tags: ['zebra', 'alpha'], // intentionally unsorted
  ...overrides,
});

beforeEach(() => mockFrom.mockReset());

describe('findById', () => {
  it('transforms a row into a Trade with Date objects and sorted tags', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: rawTrade(), error: null }));
    const trade = await new TradeRepository().findById('t1');
    expect(trade).not.toBeNull();
    expect(trade!.trade_date).toBeInstanceOf(Date);
    expect(trade!.created_at).toBeInstanceOf(Date);
    expect(trade!.tags).toEqual(['alpha', 'zebra']); // sorted
    expect(mockFrom).toHaveBeenCalledWith('trades');
  });

  it('returns null when no row is found', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: null }));
    expect(await new TradeRepository().findById('missing')).toBeNull();
  });

  it('returns null (not throw) on a query error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'boom' } }));
    expect(await new TradeRepository().findById('t1')).toBeNull();
  });
});

describe('findByUserId', () => {
  it('maps every row and applies the user filter and ordering', async () => {
    const builder = queryResolving({
      data: [rawTrade(), rawTrade({ id: 't2' })],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const trades = await new TradeRepository().findByUserId('u1');
    expect(trades).toHaveLength(2);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('applies a limit when provided', async () => {
    const builder = queryResolving({ data: [rawTrade()], error: null });
    mockFrom.mockReturnValue(builder);
    await new TradeRepository().findByUserId('u1', { limit: 5 });
    expect(builder.limit).toHaveBeenCalledWith(5);
  });

  it('returns [] on a query error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'nope' } }));
    expect(await new TradeRepository().findByUserId('u1')).toEqual([]);
  });
});

describe('findByCalendarId (pagination)', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => rawTrade({ id: `t${i}` }));

  it('returns a single short page without requesting a second', async () => {
    mockFrom.mockReturnValueOnce(queryResolving({ data: rows(3), error: null }));
    const trades = await new TradeRepository().findByCalendarId('c1');
    expect(trades).toHaveLength(3);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('pages through a full page then stops on a short page', async () => {
    mockFrom
      .mockReturnValueOnce(queryResolving({ data: rows(1000), error: null }))
      .mockReturnValueOnce(queryResolving({ data: rows(2), error: null }));
    const trades = await new TradeRepository().findByCalendarId('c1');
    expect(trades).toHaveLength(1002);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('returns what it has so far if a page errors', async () => {
    mockFrom.mockReturnValueOnce(queryResolving({ data: null, error: { message: 'rls' } }));
    const trades = await new TradeRepository().findByCalendarId('c1');
    expect(trades).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
