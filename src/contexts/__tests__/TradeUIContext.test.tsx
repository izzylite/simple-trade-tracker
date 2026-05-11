import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  TradeUIProvider,
  useTradeUI,
  usePublishTradeUI,
} from '../TradeUIContext';
import { Trade } from '../../types/dualWrite';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TradeUIProvider>{children}</TradeUIProvider>
);

const makeTrade = (id: string): Trade => ({
  id,
  user_id: 'u1',
  trade_date: new Date(),
  amount: 0,
  trade_type: 'win',
  name: id,
} as Trade);

describe('TradeUIContext', () => {
  it('returns empty ops when no page has published', () => {
    const { result } = renderHook(() => useTradeUI(), { wrapper });
    expect(result.current.onEditTrade).toBeUndefined();
    expect(result.current.onZoomImage).toBeUndefined();
    expect(result.current.onOpenGalleryMode).toBeUndefined();
    expect(result.current.onOpenAIChat).toBeUndefined();
  });

  it('reads ops published by usePublishTradeUI', () => {
    const onEditTrade = jest.fn();
    const { result } = renderHook(
      () => {
        usePublishTradeUI({ onEditTrade });
        return useTradeUI();
      },
      { wrapper }
    );
    expect(result.current.onEditTrade).toBe(onEditTrade);

    const trade = makeTrade('t1');
    act(() => result.current.onEditTrade?.(trade));
    expect(onEditTrade).toHaveBeenCalledWith(trade);
  });

  it('clears ops on publisher unmount', () => {
    const onEditTrade = jest.fn();
    const { result, unmount } = renderHook(
      () => {
        usePublishTradeUI({ onEditTrade });
        return useTradeUI();
      },
      { wrapper }
    );
    expect(result.current.onEditTrade).toBe(onEditTrade);
    unmount();
    // After unmount, a fresh consumer in the same provider sees empty ops.
    const { result: result2 } = renderHook(() => useTradeUI(), { wrapper });
    expect(result2.current.onEditTrade).toBeUndefined();
  });

  it('falls back to empty ops outside the provider (no throw)', () => {
    const { result } = renderHook(() => useTradeUI());
    expect(result.current).toEqual({});
  });
});
