import { AbstractBaseRepository } from 'services/repositories/BaseRepository';
import { BaseEntity } from 'features/calendar/types/dualWrite';

jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

interface Thing extends BaseEntity {
  value: number;
}

/**
 * Concrete subclass exposing controllable Supabase stubs so we can exercise the
 * base class's retry / batch / config orchestration without a real client.
 */
class ThingRepository extends AbstractBaseRepository<Thing> {
  createStub = jest.fn<Promise<Thing>, [Omit<Thing, 'id' | 'created_at' | 'updated_at'>]>();
  updateStub = jest.fn<Promise<Thing>, [string, Partial<Thing>]>();
  deleteStub = jest.fn<Promise<boolean>, [string]>();

  findById() { return Promise.resolve(null); }
  findByUserId() { return Promise.resolve([]); }
  findAll() { return Promise.resolve([]); }

  protected createInSupabase(entity: Omit<Thing, 'id' | 'created_at' | 'updated_at'>) {
    return this.createStub(entity);
  }
  protected updateInSupabase(id: string, updates: Partial<Thing>) {
    return this.updateStub(id, updates);
  }
  protected deleteInSupabase(id: string) {
    return this.deleteStub(id);
  }
}

const thing = (value: number): Thing => ({
  id: 't1',
  value,
  created_at: new Date(),
  updated_at: new Date(),
});

describe('config', () => {
  it('exposes sane defaults', () => {
    expect(new ThingRepository().getConfig()).toEqual({
      retryAttempts: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
    });
  });

  it('merges constructor overrides and setConfig updates', () => {
    const repo = new ThingRepository({ retryAttempts: 1 });
    expect(repo.getConfig().retryAttempts).toBe(1);
    repo.setConfig({ timeoutMs: 5000 });
    expect(repo.getConfig()).toMatchObject({ retryAttempts: 1, timeoutMs: 5000 });
  });

  it('returns a copy of config, not the internal reference', () => {
    const repo = new ThingRepository();
    repo.getConfig().retryAttempts = 99;
    expect(repo.getConfig().retryAttempts).toBe(3);
  });
});

describe('create / update / delete', () => {
  it('wraps a successful create in a RepositoryResult', async () => {
    const repo = new ThingRepository();
    const created = thing(5);
    repo.createStub.mockResolvedValue(created);
    const result = await repo.create({ value: 5 } as never);
    expect(result.success).toBe(true);
    expect(result.data).toBe(created); // passed through unchanged
    expect(result.operation).toBe('create');
    expect(repo.createStub).toHaveBeenCalledTimes(1);
  });

  it('returns a failure result (no retry) for a non-retryable error', async () => {
    const repo = new ThingRepository();
    repo.createStub.mockRejectedValue({ code: '23505', message: 'duplicate' });
    const result = await repo.create({ value: 1 } as never);
    expect(result.success).toBe(false);
    expect(result.error?.retryable).toBe(false);
    expect(repo.createStub).toHaveBeenCalledTimes(1); // not retried
  });

  it('surfaces update failures without throwing', async () => {
    const repo = new ThingRepository();
    repo.updateStub.mockRejectedValue({ code: '23502', message: 'not null violation' });
    const result = await repo.update('t1', { value: 2 });
    expect(result.success).toBe(false);
    expect(repo.updateStub).toHaveBeenCalledTimes(1);
  });
});

describe('retry behaviour', () => {
  it('retries a retryable error and succeeds on a later attempt', async () => {
    const repo = new ThingRepository();
    repo.createStub
      .mockRejectedValueOnce({ code: 'network_error', message: 'connection reset' })
      .mockResolvedValueOnce(thing(7));
    const result = await repo.create({ value: 7 } as never);
    expect(result.success).toBe(true);
    expect(repo.createStub).toHaveBeenCalledTimes(2);
  }, 10000);

  it('gives up after exhausting the retry budget', async () => {
    const repo = new ThingRepository({ retryAttempts: 2 });
    repo.createStub.mockRejectedValue({ code: 'network_error', message: 'down' });
    const result = await repo.create({ value: 9 } as never);
    expect(result.success).toBe(false);
    expect(repo.createStub).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('batch operations', () => {
  it('reports success only when every create succeeds', async () => {
    const repo = new ThingRepository();
    repo.createStub.mockResolvedValue(thing(1));
    const result = await repo.createMany([{ value: 1 }, { value: 2 }] as never);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('reports partial failure but still returns the successful rows', async () => {
    const repo = new ThingRepository();
    repo.createStub
      .mockResolvedValueOnce(thing(1))
      .mockResolvedValueOnce(thing(2))
      .mockRejectedValueOnce({ code: '23505', message: 'dup' });
    const result = await repo.createMany([{ value: 1 }, { value: 2 }, { value: 3 }] as never);
    expect(result.success).toBe(false);
    expect(result.data).toHaveLength(2);
    expect(result.error).toBeUndefined(); // some succeeded
  });

  it('surfaces an aggregate error when every create fails', async () => {
    const repo = new ThingRepository();
    repo.createStub.mockRejectedValue({ code: '23505', message: 'dup' });
    const result = await repo.createMany([{ value: 1 }, { value: 2 }] as never);
    expect(result.success).toBe(false);
    expect(result.data).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it('deleteMany succeeds when at least one delete works', async () => {
    const repo = new ThingRepository();
    repo.deleteStub.mockResolvedValue(true);
    const result = await repo.deleteMany(['a', 'b']);
    expect(result.success).toBe(true);
    expect(repo.deleteStub).toHaveBeenCalledTimes(2);
  });
});
