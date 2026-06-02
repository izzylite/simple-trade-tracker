import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyTradeDialog } from './CopyTradeDialog';
import { makeTrade } from 'test-utils/makeTrade';
import { Calendar } from 'features/calendar/types/dualWrite';
import type { CopyResult } from 'features/calendar/services/tradeCopyService';

const cal = (id: string, name: string, extra: Partial<Calendar> = {}): Calendar =>
  ({ id, name, user_id: 'user-1', account_balance: 1000, max_daily_drawdown: 0, ...extra } as Calendar);

// Mutable so individual tests can vary the calendar set the dialog sees.
let mockCalendars: Calendar[] = [];

jest.mock('features/calendar/hooks/useCalendars', () => ({
  useCalendars: () => ({ calendars: mockCalendars, isLoading: false, error: null, refresh: jest.fn() }),
}));

const mockCopy = jest.fn();
jest.mock('features/calendar/services/tradeCopyService', () => ({
  copyTradeToCalendars: (...args: unknown[]) => mockCopy(...args),
}));

beforeEach(() => {
  mockCopy.mockReset();
  mockCalendars = [cal('cur', 'Current'), cal('a', 'Alpha'), cal('b', 'Beta')];
});

describe('CopyTradeDialog', () => {
  it('lists other calendars and excludes the current one', () => {
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('excludes soft-deleted calendars', () => {
    mockCalendars = [cal('cur', 'Current'), cal('a', 'Alpha'), cal('del', 'Deleted', { deleted_at: new Date() })];
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no other calendars', () => {
    mockCalendars = [cal('cur', 'Current')];
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    expect(screen.getByText(/don't have any other calendars/i)).toBeInTheDocument();
  });

  it('disables Copy until a destination is selected, then runs the copy with the chosen targets', async () => {
    mockCopy.mockResolvedValue([{ calendarId: 'a', calendarName: 'Alpha', status: 'success' }]);
    const onCopied = jest.fn();
    render(
      <CopyTradeDialog
        open
        trade={makeTrade()}
        currentCalendarId="cur"
        userId="user-1"
        onClose={jest.fn()}
        onCopied={onCopied}
      />
    );
    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    expect(copyBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /copy to alpha/i }));
    expect(copyBtn).not.toBeDisabled();

    fireEvent.click(copyBtn);
    await waitFor(() => expect(mockCopy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onCopied).toHaveBeenCalled());
    const passedTargets = mockCopy.mock.calls[0][1] as Calendar[];
    expect(passedTargets.map((c) => c.id)).toEqual(['a']);
  });

  it('enters the done state after a copy: shows Close and a per-row success icon', async () => {
    mockCopy.mockImplementation(
      async (_trade: unknown, targets: Calendar[], onResult?: (r: CopyResult) => void) => {
        const results = targets.map((t) => ({ calendarId: t.id!, calendarName: t.name, status: 'success' as const }));
        results.forEach((r) => onResult?.(r));
        return results;
      }
    );
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /copy to alpha/i }));
    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^copy$/i })).not.toBeInTheDocument();
    expect(screen.getByTitle('Copied')).toBeInTheDocument();
  });
});
