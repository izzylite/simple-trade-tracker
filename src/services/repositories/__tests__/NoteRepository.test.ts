import { NoteRepository } from 'services/repositories/NoteRepository';
import { AGENT_MEMORY_TAG } from 'features/notes/types/note';
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

const rawNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
  user_id: 'u1',
  title: 'Note',
  content: 'body',
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => mockFrom.mockReset());

describe('findById', () => {
  it('transforms a row, parsing archived_at when present', async () => {
    mockFrom.mockReturnValue(
      queryResolving({ data: rawNote({ archived_at: '2026-03-01T00:00:00.000Z' }), error: null })
    );
    const note = await new NoteRepository().findById('n1');
    expect(note!.created_at).toBeInstanceOf(Date);
    expect(note!.archived_at).toBeInstanceOf(Date);
  });

  it('maps a missing archived_at to null (not a fallback date)', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: rawNote(), error: null }));
    const note = await new NoteRepository().findById('n1');
    expect(note!.archived_at).toBeNull();
  });

  it('returns null on error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'x' } }));
    expect(await new NoteRepository().findById('n1')).toBeNull();
  });
});

describe('findByUserId', () => {
  it('excludes the agent-memory note from user-facing results', async () => {
    const builder = queryResolving({ data: [rawNote()], error: null });
    mockFrom.mockReturnValue(builder);
    await new NoteRepository().findByUserId('u1');
    expect(builder.not).toHaveBeenCalledWith('tags', 'cs', `{${AGENT_MEMORY_TAG}}`);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('returns [] on error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'x' } }));
    expect(await new NoteRepository().findByUserId('u1')).toEqual([]);
  });
});

describe('findByTag', () => {
  it('uses a contains filter on the tags array', async () => {
    const builder = queryResolving({ data: [rawNote({ tags: ['setup'] })], error: null });
    mockFrom.mockReturnValue(builder);
    const notes = await new NoteRepository().findByTag('u1', 'setup');
    expect(notes).toHaveLength(1);
    expect(builder.contains).toHaveBeenCalledWith('tags', ['setup']);
  });
});

describe('queryByUserId (pagination)', () => {
  it('computes hasMore=true when more rows remain beyond the page', async () => {
    mockFrom.mockReturnValue(
      queryResolving({ data: [rawNote()], error: null, count: 50 })
    );
    const result = await new NoteRepository().queryByUserId('u1', { limit: 20, offset: 0 });
    expect(result.total).toBe(50);
    expect(result.hasMore).toBe(true); // 0 + 20 < 50
  });

  it('computes hasMore=false on the last page', async () => {
    mockFrom.mockReturnValue(
      queryResolving({ data: [rawNote()], error: null, count: 15 })
    );
    const result = await new NoteRepository().queryByUserId('u1', { limit: 20, offset: 0 });
    expect(result.hasMore).toBe(false); // 0 + 20 >= 15
  });

  it('applies the isPinned filter and search clause when provided', async () => {
    const builder = queryResolving({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);
    await new NoteRepository().queryByUserId('u1', { isPinned: true, searchQuery: 'plan' });
    expect(builder.eq).toHaveBeenCalledWith('is_pinned', true);
    expect(builder.or).toHaveBeenCalledWith(
      'title.ilike.%plan%,content.ilike.%plan%'
    );
  });

  it('returns an empty result on error', async () => {
    mockFrom.mockReturnValue(queryResolving({ data: null, error: { message: 'x' }, count: 0 }));
    const result = await new NoteRepository().queryByUserId('u1');
    expect(result).toEqual({ notes: [], total: 0, hasMore: false });
  });
});
