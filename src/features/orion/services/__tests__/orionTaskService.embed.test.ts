import { orionTaskService } from '../orionTaskService';
import { supabase } from 'config/supabase';
import { queryResolving } from 'test-utils/mockSupabase';

jest.mock('config/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => mockFrom.mockReset());

test('getResults selects the embedded briefing', async () => {
  const builder = queryResolving({ data: [], error: null });
  mockFrom.mockReturnValue(builder);

  await orionTaskService.getResults('u1');

  expect(builder.select).toHaveBeenCalledWith(
    expect.stringContaining('briefing:asset_research_briefings(')
  );
});
