/**
 * Shared test helper for mocking the Supabase PostgREST query builder.
 *
 * Usage (a concrete repo test):
 *   jest.mock('config/supabase', () => ({
 *     supabase: { from: jest.fn(), rpc: jest.fn() },
 *     supabaseUrl: 'http://test.local',
 *   }));
 *   const mockFrom = (supabase.from as jest.Mock);
 *   mockFrom.mockReturnValue(queryResolving({ data: row, error: null }));
 *
 * `config/supabase` throws at import without env vars, so it must always be
 * mocked (along with heavy sibling imports the repo pulls in at module load).
 */

export type QueryResult = { data?: unknown; error?: unknown; count?: number };

/**
 * Build a chainable + awaitable query-builder mock. Every filter/modifier
 * returns the same builder; the chain resolves to `result` whether it is
 * awaited directly or terminated with `.maybeSingle()` / `.single()`.
 */
export const queryResolving = (result: QueryResult) => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const methods = [
    'select', 'eq', 'neq', 'in', 'gte', 'lte', 'lt', 'gt',
    'order', 'limit', 'range', 'contains', 'match', 'is', 'filter', 'or', 'overlaps', 'not',
  ];
  for (const m of methods) {
    builder[m] = jest.fn(chain);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (res: (v: QueryResult) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return builder as Record<string, jest.Mock> & { then: unknown };
};
