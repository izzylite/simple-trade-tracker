import { CalendarRepository } from 'services/repositories/CalendarRepository';
import { Calendar } from 'features/calendar/types/dualWrite';
import { supabase } from 'config/supabase';
import { queryResolving } from 'test-utils/mockSupabase';

jest.mock('config/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
  supabaseUrl: 'http://test.local',
}));
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

const rawCalendar = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  user_id: 'u1',
  name: 'My Calendar',
  account_balance: 10000,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => mockFrom.mockReset());

describe('findById', () => {
  it('transforms a row into a Calendar with Date objects', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: rawCalendar(), error: null }));
    const cal = await new CalendarRepository().findById('c1');
    expect(cal).not.toBeNull();
    expect(cal!.created_at).toBeInstanceOf(Date);
    expect(cal!.updated_at).toBeInstanceOf(Date);
    expect(mockFrom).toHaveBeenCalledWith('calendars');
  });

  it('leaves optional dates undefined when absent', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: rawCalendar(), error: null }));
    const cal = await new CalendarRepository().findById('c1');
    expect(cal!.deleted_at).toBeUndefined();
    expect(cal!.drawdown_start_date).toBeUndefined();
  });

  it('returns null on error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'x' } }));
    expect(await new CalendarRepository().findById('c1')).toBeNull();
  });
});

describe('findByUserId', () => {
  it('filters out deleted/marked calendars and maps the rows', async () => {
    const builder = queryResolving({
      data: [rawCalendar(), rawCalendar({ id: 'c2' })],
      error: null,
    });
    mockFrom.mockReturnValue(builder);
    const cals = await new CalendarRepository().findByUserId('u1');
    expect(cals).toHaveLength(2);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(builder.neq).toHaveBeenCalledWith('mark_for_deletion', true);
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'x' } }));
    expect(await new CalendarRepository().findByUserId('u1')).toEqual([]);
  });
});

/**
 * Subclass that stubs the actual insert so we can drive the tier-gate branch in
 * the overridden `create` without mocking the full write chain.
 */
class TestCalendarRepository extends CalendarRepository {
  createSpy = jest.fn(async () => rawCalendar() as unknown as Calendar);
  protected createInSupabase(entity: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>) {
    return this.createSpy(entity);
  }
}

describe('create — free-tier calendar cap', () => {
  const entity = { user_id: 'u1', name: 'X', account_balance: 1000 } as never;

  it('allows a free user with no existing calendars', async () => {
    mockFrom
      .mockReturnValueOnce(queryResolving({ data: { tier: 'free' }, error: null })) // subscriptions
      .mockReturnValueOnce(queryResolving({ count: 0, error: null })); // calendar count
    const repo = new TestCalendarRepository();
    const result = await repo.create(entity);
    expect(result.success).toBe(true);
    expect(repo.createSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks a free user who already has a calendar', async () => {
    mockFrom
      .mockReturnValueOnce(queryResolving({ data: { tier: 'free' }, error: null }))
      .mockReturnValueOnce(queryResolving({ count: 1, error: null }));
    const repo = new TestCalendarRepository();
    const result = await repo.create(entity);
    expect(result.success).toBe(false);
    expect((result.error as { message: string }).message).toBe('tier_limit_calendars');
    expect(repo.createSpy).not.toHaveBeenCalled();
  });

  it('treats a missing subscription row as free tier', async () => {
    mockFrom
      .mockReturnValueOnce(queryResolving({ data: null, error: null }))
      .mockReturnValueOnce(queryResolving({ count: 1, error: null }));
    const repo = new TestCalendarRepository();
    const result = await repo.create(entity);
    expect(result.success).toBe(false);
    expect((result.error as { message: string }).message).toBe('tier_limit_calendars');
  });

  it('skips the cap entirely for a paid tier', async () => {
    // Only the subscription lookup runs; no calendar-count query.
    mockFrom.mockReturnValueOnce(queryResolving({ data: { tier: 'pro' }, error: null }));
    const repo = new TestCalendarRepository();
    const result = await repo.create(entity);
    expect(result.success).toBe(true);
    expect(repo.createSpy).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
