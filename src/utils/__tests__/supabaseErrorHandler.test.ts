import {
  parseSupabaseError,
  getErrorRecoveryStrategy,
  handleSupabaseError,
  SupabaseErrorCategory,
  SupabaseErrorSeverity,
} from 'utils/supabaseErrorHandler';

// Silence the logger so error-path tests don't spam the console.
jest.mock('utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('parseSupabaseError', () => {
  it('treats a null error as an unknown, retryable error', () => {
    const result = parseSupabaseError(null);
    expect(result.category).toBe(SupabaseErrorCategory.UNKNOWN);
    expect(result.code).toBe('unknown_error');
    expect(result.retryable).toBe(true);
  });

  it('maps a known unique-violation code (23505) to a non-retryable DB error', () => {
    const result = parseSupabaseError({ code: '23505', message: 'duplicate key' });
    expect(result.category).toBe(SupabaseErrorCategory.DATABASE);
    expect(result.severity).toBe(SupabaseErrorSeverity.MEDIUM);
    expect(result.retryable).toBe(false);
    expect(result.userMessage).toMatch(/already exists/i);
  });

  it('maps PGRST116 to a non-retryable permission error', () => {
    const result = parseSupabaseError({ code: 'PGRST116' });
    expect(result.category).toBe(SupabaseErrorCategory.PERMISSION);
    expect(result.retryable).toBe(false);
  });

  it.each([
    ['network_error', SupabaseErrorCategory.NETWORK],
    ['timeout', SupabaseErrorCategory.NETWORK],
    ['rate_limit_exceeded', SupabaseErrorCategory.RATE_LIMIT],
  ])('maps known retryable code %s', (code, category) => {
    const result = parseSupabaseError({ code });
    expect(result.category).toBe(category);
    expect(result.retryable).toBe(true);
  });

  it('categorizes unknown codes by message content', () => {
    expect(parseSupabaseError({ message: 'Network connection lost' }).category).toBe(
      SupabaseErrorCategory.NETWORK
    );
    expect(parseSupabaseError({ message: 'permission denied for table' }).category).toBe(
      SupabaseErrorCategory.PERMISSION
    );
    expect(parseSupabaseError({ message: 'invalid input syntax' }).category).toBe(
      SupabaseErrorCategory.VALIDATION
    );
  });

  it('defaults unrecognized messages to a non-retryable DATABASE error', () => {
    const result = parseSupabaseError({ code: 'weird', message: 'something happened' });
    expect(result.category).toBe(SupabaseErrorCategory.DATABASE);
    expect(result.retryable).toBe(false);
  });

  it('treats a DATABASE error whose code mentions timeout as retryable', () => {
    const result = parseSupabaseError({ code: 'statement_timeout', message: 'query aborted' });
    expect(result.category).toBe(SupabaseErrorCategory.DATABASE);
    expect(result.retryable).toBe(true);
  });

  it('preserves the original error and context', () => {
    const original = { code: '23505', message: 'dup' };
    const result = parseSupabaseError(original, 'Creating trade');
    expect(result.context).toBe('Creating trade');
    expect(result.originalError).toBe(original);
  });
});

describe('getErrorRecoveryStrategy', () => {
  it('does not retry a non-retryable error', () => {
    const err = parseSupabaseError({ code: '23505' });
    expect(getErrorRecoveryStrategy(err)).toEqual({ shouldRetry: false });
  });

  it('uses a 1s/3-retry strategy for network errors', () => {
    const err = parseSupabaseError({ code: 'network_error' });
    expect(getErrorRecoveryStrategy(err)).toEqual({
      shouldRetry: true,
      retryDelay: 1000,
      maxRetries: 3,
    });
  });

  it('uses a longer 5s/2-retry strategy for rate limits', () => {
    const err = parseSupabaseError({ code: 'rate_limit_exceeded' });
    expect(getErrorRecoveryStrategy(err)).toEqual({
      shouldRetry: true,
      retryDelay: 5000,
      maxRetries: 2,
    });
  });

  it('uses a fast 500ms/2-retry strategy for retryable DB errors', () => {
    const err = parseSupabaseError({ code: 'statement_timeout', message: 'aborted' });
    expect(getErrorRecoveryStrategy(err)).toEqual({
      shouldRetry: true,
      retryDelay: 500,
      maxRetries: 2,
    });
  });

  it('falls back to a default strategy for other retryable categories', () => {
    // STORAGE error whose code mentions timeout is retryable -> default branch.
    const err = parseSupabaseError({ code: 'timeout_x', message: 'file upload failed' });
    expect(err.category).toBe(SupabaseErrorCategory.STORAGE);
    expect(getErrorRecoveryStrategy(err)).toEqual({
      shouldRetry: true,
      retryDelay: 1000,
      maxRetries: 1,
    });
  });
});

describe('handleSupabaseError', () => {
  it('returns the parsed error (and logs as a side effect)', () => {
    const result = handleSupabaseError({ code: 'network_error' }, 'ctx', 'op');
    expect(result.category).toBe(SupabaseErrorCategory.NETWORK);
    expect(result.context).toBe('ctx');
  });
});
