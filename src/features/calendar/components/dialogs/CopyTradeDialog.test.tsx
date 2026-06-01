import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyTradeDialog } from './CopyTradeDialog';
import { makeTrade } from 'test-utils/makeTrade';
import { Calendar } from 'features/calendar/types/dualWrite';

const cal = (id: string, name: string): Calendar =>
  ({ id, name, user_id: 'user-1', account_balance: 1000, max_daily_drawdown: 0 } as Calendar);

const mockCalendars = [cal('cur', 'Current'), cal('a', 'Alpha'), cal('b', 'Beta')];

jest.mock('features/calendar/hooks/useCalendars', () => ({
  useCalendars: () => ({ calendars: mockCalendars, isLoading: false, error: null, refresh: jest.fn() }),
}));

const mockCopy = jest.fn();
jest.mock('features/calendar/services/tradeCopyService', () => ({
  copyTradeToCalendars: (...args: unknown[]) => mockCopy(...args),
}));

describe('CopyTradeDialog', () => {
  beforeEach(() => mockCopy.mockReset());

  it('lists other calendars and excludes the current one', () => {
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('disables Copy until a destination is selected, then runs the copy', async () => {
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

    fireEvent.click(screen.getByText('Alpha'));
    expect(copyBtn).not.toBeDisabled();

    fireEvent.click(copyBtn);
    await waitFor(() => expect(mockCopy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onCopied).toHaveBeenCalled());
    const passedTargets = mockCopy.mock.calls[0][1] as Calendar[];
    expect(passedTargets.map((c) => c.id)).toEqual(['a']);
  });
});
