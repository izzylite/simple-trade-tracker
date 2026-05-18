// TradesContext imports `useCalendarTrades`, which transitively loads
// calendarService → economic-calendar UI → ESM `react-markdown`. The test
// supplies its own context value via <TradesContext.Provider>, so the real
// hook never runs — we just need module load to succeed under jest.
jest.mock('../../hooks/useCalendarTrades', () => ({
  useCalendarTrades: () => ({}),
}));

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  TradeOperationsProvider,
  useTradeOperations,
} from '../TradeOperationsContext';
import { TradesContext } from '../TradesContext';
import { Trade, Calendar } from '../../types/dualWrite';

const makeTrade = (id: string): Trade =>
  ({
    id,
    user_id: 'u1',
    trade_date: new Date(),
    amount: 0,
    trade_type: 'win',
    name: id,
  }) as Trade;

const makeCalendar = (id: string): Calendar =>
  ({
    id,
    user_id: 'u1',
    name: 'Cal',
    account_balance: 1000,
  }) as Calendar;

function makeWrapper(hookOverrides: Record<string, unknown> = {}) {
  const hook = {
    trades: [],
    calendar: makeCalendar('c1'),
    isLoading: false,
    error: null,
    addTrade: jest.fn(),
    deleteTrades: jest.fn().mockResolvedValue(undefined),
    handleUpdateTradeProperty: jest.fn(),
    onTagUpdated: jest.fn(),
    handleToggleDynamicRisk: jest.fn(),
    handleImportTrades: jest.fn(),
    handleAccountBalanceChange: jest.fn(),
    handleUpdateCalendarProperty: jest.fn(),
    notification: null,
    clearNotification: jest.fn(),
    isTradeUpdating: jest.fn(() => false),
    loadMonthTrades: jest.fn(),
    loadVisibleRangeTrades: jest.fn(),
    ...hookOverrides,
  };
  const ctxValue = {
    calendarId: 'c1',
    calendar: hook.calendar,
    trades: hook.trades,
    isLoading: hook.isLoading,
    hook,
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TradesContext.Provider value={ctxValue as never}>
      <TradeOperationsProvider>{children}</TradeOperationsProvider>
    </TradesContext.Provider>
  );
  return { wrapper, hook };
}

describe('TradeOperationsContext', () => {
  it('exposes onEditTrade that opens the add/edit form with the trade', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTradeOperations(), { wrapper });

    const trade = makeTrade('t1');
    act(() => result.current.onEditTrade?.(trade));

    expect(result.current.formDialog.open).toBe(true);
    expect(result.current.formDialog.editTrade).toEqual(trade);
  });

  it('onDeleteTrade opens the confirm dialog with one id', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTradeOperations(), { wrapper });

    act(() => result.current.onDeleteTrade?.('t1'));

    expect(result.current.deleteDialog.open).toBe(true);
    expect(result.current.deleteDialog.tradeIds).toEqual(['t1']);
  });

  it('onDeleteMultipleTrades opens the confirm dialog with all ids', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTradeOperations(), { wrapper });

    act(() => result.current.onDeleteMultipleTrades?.(['t1', 't2']));

    expect(result.current.deleteDialog.open).toBe(true);
    expect(result.current.deleteDialog.tradeIds).toEqual(['t1', 't2']);
  });

  it('confirmDelete calls hook.deleteTrades with the staged ids', async () => {
    const { wrapper, hook } = makeWrapper();
    const { result } = renderHook(() => useTradeOperations(), { wrapper });

    act(() => result.current.onDeleteMultipleTrades?.(['t1', 't2']));
    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(hook.deleteTrades).toHaveBeenCalledWith(['t1', 't2']);
    expect(result.current.deleteDialog.open).toBe(false);
  });

  it('cancelDelete closes the dialog without calling deleteTrades', () => {
    const { wrapper, hook } = makeWrapper();
    const { result } = renderHook(() => useTradeOperations(), { wrapper });

    act(() => result.current.onDeleteTrade?.('t1'));
    act(() => result.current.cancelDelete());

    expect(result.current.deleteDialog.open).toBe(false);
    expect(hook.deleteTrades).not.toHaveBeenCalled();
  });
});
