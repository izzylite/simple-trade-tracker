# Copy Trade to Another Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user copy a single trade into one or more of their other calendars as fully independent trades — PnL recomputed per destination, images duplicated into their own storage objects, no link/sync back to the source.

**Architecture:** Frontend orchestration. A new `tradeCopyService` recomputes `amount` with the existing `dynamicRiskUtils` helpers, duplicates images via Supabase Storage `.copy()`, strips source fields, and inserts via the existing `addTrade()` (which auto-recomputes destination `year_stats` through the trades webhook). UI is a new `CopyTradeDialog` driven by `TradeOperationsContext` (open/close + reused `OpNotification` snackbar), with a "Copy to calendar" item added to the `TradeList` 3-dot menu.

**Tech Stack:** React 19, TypeScript (strict), MUI v7, Supabase JS SDK, Jest + React Testing Library, SWR (`useCalendars`).

**Spec:** `.planning/architecture/copy-trade-to-calendar.md`

---

## Key facts locked during research (do not re-derive)

- **Loss sign:** losses are stored **negative**. Recalc returns `Math.round(riskAmount * RR)` for wins and `-Math.round(riskAmount)` for losses (mirrors `useCalendarTrades.ts:644-646` and `tradeSync.ts`'s `calculateSyncedAmount`). Breakeven = 0.
- **Carry raw `amount`** when: destination has no `risk_per_trade`, OR trade has no `risk_to_reward`, OR `partials_taken === true`.
- **Trade type:** `features/calendar/types/dualWrite.ts` (re-exported via `types/trade.ts`). Fields incl. `amount`, `trade_type`, `trade_date`, `risk_to_reward`, `partials_taken`, `images?: TradeImageEntity[]`, `source_trade_id?`, `is_synced_copy?`, `is_pinned?`, `is_temporary?`, share fields.
- **`addTrade(calendarId, Omit<Trade,'id'|'created_at'|'updated_at'>)`** and **`getAllTrades(calendarId)`** are exported from `features/calendar/services/calendarService.ts`.
- **dynamicRiskUtils** (`features/calendar/utils/dynamicRiskUtils.ts`) exports `DynamicRiskSettings`, `calculateCumulativePnLToDateAsync(date, calendar, providedTrades?)`, `calculateEffectiveRiskPercentageAsync(date, calendar, drs, providedTrades?)`, `calculateRiskAmount(effRiskPct, accountBalance, cumulativePnL=0)`. When `providedTrades` is passed, **no DB call happens** (pure → unit-testable).
- **Storage:** bucket `trade-images`, object path `users/{userId}/trade-images/{filename}`, public URLs. `getPublicUrl(bucket, path)` exported from `services/supabaseStorageService.ts`. `supabase` from `config/supabase`.
- **Host:** `TradeOperationsContext.tsx` owns dialog state + emits `OpNotification` (`{kind:'success'|'error'; message; retryIds?}`); `GlobalTradeOperations.tsx` renders the dialogs + a single `Snackbar`. `TradeList.tsx` receives `tradeOperations: TradeOperationsProps` and destructures callbacks; menu is `#trade-actions-menu` at lines ~590-618.
- **Fixtures:** `src/test-utils/makeTrade.ts` exports `makeTrade`, `win`, `loss`, `breakeven`.
- **Image copy is best-effort.** If all of a trade's images fail to copy, still create the trade without images and set `imagesOmitted: true`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/calendar/types/tradeOperations.ts` | modify | add `onCopyTrade?: (trade: Trade) => void` |
| `src/features/calendar/services/tradeCopyService.ts` | create | pure recalc + payload + summary; image copy; orchestrator |
| `src/features/calendar/services/tradeCopyService.test.ts` | create | unit tests for the pure functions |
| `src/features/calendar/components/dialogs/CopyTradeDialog.tsx` | create | destination multi-select + per-row progress |
| `src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx` | create | component test |
| `src/features/calendar/contexts/TradeOperationsContext.tsx` | modify | `copyDialog` state, `onCopyTrade`, `closeCopyDialog`, `pushNotification` |
| `src/features/calendar/components/trades/GlobalTradeOperations.tsx` | modify | render `<CopyTradeDialog/>` |
| `src/features/calendar/components/trades/TradeList.tsx` | modify | "Copy to calendar" menu item |

---

### Task 1: Add `onCopyTrade` to the shared operations interface

**Files:**
- Modify: `src/features/calendar/types/tradeOperations.ts`

- [ ] **Step 1: Add the callback to the interface**

In the `// ===== Core Trade Operations =====` block, immediately after the `onEditTrade` declaration, add:

```typescript
  /** Open the copy-to-calendar dialog for a trade */
  onCopyTrade?: (trade: Trade) => void;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/calendar/types/tradeOperations.ts
git commit -m "feat(calendar): add onCopyTrade to TradeOperationsProps"
```

---

### Task 2: Pure functions in `tradeCopyService` (TDD)

**Files:**
- Create: `src/features/calendar/services/tradeCopyService.ts`
- Test: `src/features/calendar/services/tradeCopyService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/calendar/services/tradeCopyService.test.ts`:

```typescript
import {
  computeCopyAmount,
  buildCopiedTradePayload,
  summarizeCopyResults,
  CopyResult,
} from './tradeCopyService';
import { makeTrade, win, loss, breakeven } from 'test-utils/makeTrade';
import { Calendar, TradeImageEntity } from 'features/calendar/types/dualWrite';

const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar =>
  ({
    id: 'dest-cal',
    user_id: 'user-1',
    name: 'Dest',
    account_balance: 10000,
    max_daily_drawdown: 0,
    ...overrides,
  } as Calendar);

describe('computeCopyAmount', () => {
  it('carries the raw amount when the destination has no risk_per_trade', async () => {
    const t = win(210, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ risk_per_trade: undefined });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(210);
  });

  it('returns 0 for breakeven trades', async () => {
    const t = breakeven(0, new Date(2026, 0, 15));
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(0);
  });

  it('carries the raw amount when the trade has no risk_to_reward', async () => {
    const t = win(500, new Date(2026, 0, 15), { risk_to_reward: undefined });
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(500);
  });

  it('carries the raw amount when partials were taken', async () => {
    const t = win(777, new Date(2026, 0, 15), { risk_to_reward: 3, partials_taken: true });
    const dest = makeCalendar({ risk_per_trade: 1 });
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(777);
  });

  it('recalculates a win for the destination risk model', async () => {
    const t = win(210, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ account_balance: 50000, risk_per_trade: 2 });
    // riskAmount = 50000 * 2% = 1000; win => 1000 * 2 = 2000
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(2000);
  });

  it('recalculates a loss as a NEGATIVE amount', async () => {
    const t = loss(-105, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({ account_balance: 50000, risk_per_trade: 2 });
    // riskAmount = 1000; loss => -1000
    await expect(computeCopyAmount(t, dest, [])).resolves.toBe(-1000);
  });

  it('honors destination dynamic risk when the profit threshold is crossed', async () => {
    const t = loss(-100, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({
      account_balance: 10000,
      risk_per_trade: 1,
      dynamic_risk_enabled: true,
      increased_risk_percentage: 2,
      profit_threshold_percentage: 5,
    });
    // prior same-month trade before the date: +600 => 6% > 5% threshold => effRisk 2%
    const prior = [win(600, new Date(2026, 0, 10))];
    // riskAmount = (10000 + 600) * 2% = 212; loss => -212
    await expect(computeCopyAmount(t, dest, prior)).resolves.toBe(-212);
  });

  it('uses base risk when the dynamic threshold is not crossed', async () => {
    const t = loss(-100, new Date(2026, 0, 15), { risk_to_reward: 2 });
    const dest = makeCalendar({
      account_balance: 10000,
      risk_per_trade: 1,
      dynamic_risk_enabled: true,
      increased_risk_percentage: 2,
      profit_threshold_percentage: 5,
    });
    const prior = [win(400, new Date(2026, 0, 10))]; // 4% < 5%
    // riskAmount = (10000 + 400) * 1% = 104; loss => -104
    await expect(computeCopyAmount(t, dest, prior)).resolves.toBe(-104);
  });
});

describe('buildCopiedTradePayload', () => {
  it('strips source/sync/share fields and applies standalone overrides', () => {
    const img: TradeImageEntity = { id: 'old', url: 'u', calendar_id: 'src-cal' };
    const newImg: TradeImageEntity = { id: 'new', url: 'u2', calendar_id: 'dest-cal' };
    const src = makeTrade({
      id: 'src-trade',
      calendar_id: 'src-cal',
      trade_type: 'win',
      amount: 210,
      risk_to_reward: 2,
      tags: ['Asset:EURUSD', 'Counter Trend'],
      notes: 'keep me',
      session: 'London',
      is_pinned: true,
      is_temporary: true,
      source_trade_id: 'someone',
      is_synced_copy: true,
      share_link: 'x',
      is_shared: true,
      share_id: 'sid',
      images: [img],
    });

    const payload = buildCopiedTradePayload(src, 'dest-cal', 1999, [newImg]);

    expect(payload.calendar_id).toBe('dest-cal');
    expect(payload.amount).toBe(1999);
    expect(payload.images).toEqual([newImg]);
    expect(payload.source_trade_id).toBeUndefined();
    expect(payload.is_synced_copy).toBe(false);
    expect(payload.is_pinned).toBe(false);
    expect(payload.is_temporary).toBe(false);
    expect(payload.share_link).toBeUndefined();
    expect(payload.is_shared).toBe(false);
    expect(payload.share_id).toBeUndefined();
    // preserved fields
    expect(payload.tags).toEqual(['Asset:EURUSD', 'Counter Trend']);
    expect(payload.notes).toBe('keep me');
    expect(payload.session).toBe('London');
    expect(payload.risk_to_reward).toBe(2);
    expect(payload.trade_type).toBe('win');
    expect((payload as any).id).toBeUndefined();
    expect((payload as any).created_at).toBeUndefined();
    expect((payload as any).updated_at).toBeUndefined();
  });
});

describe('summarizeCopyResults', () => {
  const ok = (name: string): CopyResult => ({ calendarId: name, calendarName: name, status: 'success' });
  const bad = (name: string): CopyResult => ({ calendarId: name, calendarName: name, status: 'error', error: 'boom' });

  it('all success (single)', () => {
    expect(summarizeCopyResults([ok('A')])).toEqual({ kind: 'success', message: 'Copied trade to A.' });
  });
  it('all success (multiple)', () => {
    expect(summarizeCopyResults([ok('A'), ok('B'), ok('C')])).toEqual({
      kind: 'success',
      message: 'Copied trade to 3 calendars.',
    });
  });
  it('partial success', () => {
    const r = summarizeCopyResults([ok('A'), ok('B'), bad('C')]);
    expect(r.kind).toBe('error');
    expect(r.message).toContain('2 of 3');
    expect(r.message).toContain('C');
  });
  it('all failed', () => {
    const r = summarizeCopyResults([bad('A'), bad('B')]);
    expect(r.kind).toBe('error');
    expect(r.message).toContain("Couldn't copy");
  });
  it('notes when images were omitted', () => {
    const r = summarizeCopyResults([{ calendarId: 'A', calendarName: 'A', status: 'success', imagesOmitted: true }]);
    expect(r.message).toContain('without images');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test src/features/calendar/services/tradeCopyService.test.ts --watchAll=false`
Expected: FAIL — `Cannot find module './tradeCopyService'`.

- [ ] **Step 3: Implement the pure functions**

Create `src/features/calendar/services/tradeCopyService.ts`:

```typescript
/**
 * Trade-copy service — copies a single trade into other calendars as fully
 * independent, standalone trades. PnL is recomputed per destination; images
 * are duplicated into their own storage objects; no link/sync to the source.
 */
import { supabase } from 'config/supabase';
import { logger } from 'utils/logger';
import { getPublicUrl } from 'services/supabaseStorageService';
import { Trade, Calendar, TradeImageEntity } from 'features/calendar/types/dualWrite';
import {
  DynamicRiskSettings,
  calculateCumulativePnLToDateAsync,
  calculateEffectiveRiskPercentageAsync,
  calculateRiskAmount,
} from '../utils/dynamicRiskUtils';
import { addTrade, getAllTrades } from './calendarService';

const TRADE_IMAGES_BUCKET = 'trade-images';

export interface CopyResult {
  calendarId: string;
  calendarName: string;
  status: 'success' | 'error';
  error?: string;
  /** true when the trade was created but its images could not be duplicated */
  imagesOmitted?: boolean;
}

/**
 * Recompute a copied trade's `amount` for the destination calendar's risk
 * model. Carries the raw amount when recalculation isn't possible.
 * Pure when `destTrades` is provided (no DB access).
 */
export async function computeCopyAmount(
  trade: Trade,
  destCalendar: Calendar,
  destTrades: Trade[]
): Promise<number> {
  if (trade.trade_type === 'breakeven') return 0;
  if (!destCalendar.risk_per_trade) return trade.amount;
  if (!trade.risk_to_reward || trade.partials_taken) return trade.amount;

  const drs: DynamicRiskSettings = {
    account_balance: destCalendar.account_balance,
    risk_per_trade: destCalendar.risk_per_trade,
    dynamic_risk_enabled: destCalendar.dynamic_risk_enabled,
    increased_risk_percentage: destCalendar.increased_risk_percentage,
    profit_threshold_percentage: destCalendar.profit_threshold_percentage,
  };

  const tradeDate = new Date(trade.trade_date);
  const cumulativePnL = await calculateCumulativePnLToDateAsync(tradeDate, destCalendar, destTrades);
  const effRisk = await calculateEffectiveRiskPercentageAsync(tradeDate, destCalendar, drs, destTrades);
  const riskAmount = calculateRiskAmount(effRisk, destCalendar.account_balance, cumulativePnL);

  return trade.trade_type === 'win'
    ? Math.round(riskAmount * trade.risk_to_reward)
    : -Math.round(riskAmount);
}

/**
 * Build the insert payload for a standalone copy: strip source/sync/share
 * fields and apply standalone overrides. `copiedImages` are already-duplicated
 * image entities owned by the destination.
 */
export function buildCopiedTradePayload(
  trade: Trade,
  destCalendarId: string,
  recomputedAmount: number,
  copiedImages: TradeImageEntity[]
): Omit<Trade, 'id' | 'created_at' | 'updated_at'> {
  const {
    id,
    created_at,
    updated_at,
    calendar_id,
    source_trade_id,
    is_synced_copy,
    is_pinned,
    is_temporary,
    share_link,
    is_shared,
    shared_at,
    share_id,
    images,
    ...rest
  } = trade;

  return {
    ...rest,
    calendar_id: destCalendarId,
    amount: recomputedAmount,
    images: copiedImages,
    source_trade_id: undefined,
    is_synced_copy: false,
    is_pinned: false,
    is_temporary: false,
    share_link: undefined,
    is_shared: false,
    shared_at: undefined,
    share_id: undefined,
  };
}

/** Build the aggregate snackbar notification for a finished copy run. */
export function summarizeCopyResults(
  results: CopyResult[]
): { kind: 'success' | 'error'; message: string } {
  const ok = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status === 'error');
  const omitted = ok.some((r) => r.imagesOmitted);
  const imgNote = omitted ? ' (some without images)' : '';

  if (failed.length === 0) {
    const msg =
      ok.length === 1
        ? `Copied trade to ${ok[0].calendarName}${omitted ? ' without images' : ''}.`
        : `Copied trade to ${ok.length} calendars${imgNote}.`;
    return { kind: 'success', message: msg };
  }

  if (ok.length === 0) {
    return { kind: 'error', message: "Couldn't copy the trade to any calendar." };
  }

  const failedNames = failed.map((r) => r.calendarName).join(', ');
  return {
    kind: 'error',
    message: `Copied to ${ok.length} of ${ok.length + failed.length} calendars${imgNote} · failed: ${failedNames}.`,
  };
}

/** Resolve the in-bucket object path for a source image. */
function sourceObjectPath(image: TradeImageEntity): string | null {
  if (image.storage_path) return image.storage_path;
  const marker = `/object/public/${TRADE_IMAGES_BUCKET}/`;
  const i = image.url?.indexOf(marker) ?? -1;
  return i >= 0 ? decodeURIComponent(image.url.slice(i + marker.length)) : null;
}

/**
 * Duplicate a trade's images into fresh storage objects owned by the
 * destination calendar. Best-effort per image. Returns the copied entities and
 * whether *all* non-pending images failed.
 */
async function copyTradeImages(
  images: TradeImageEntity[] | undefined,
  destCalendarId: string
): Promise<{ images: TradeImageEntity[]; allFailed: boolean }> {
  const real = (images ?? []).filter((img) => !img.pending);
  if (real.length === 0) return { images: [], allFailed: false };

  const copied: TradeImageEntity[] = [];
  for (const img of real) {
    try {
      const srcPath = sourceObjectPath(img);
      if (!srcPath) continue;
      const prefix = srcPath.slice(0, srcPath.lastIndexOf('/') + 1);
      const dot = srcPath.lastIndexOf('.');
      const ext = dot >= 0 ? srcPath.slice(dot) : '';
      const newId = `${crypto.randomUUID()}${ext}`;
      const destPath = `${prefix}${newId}`;

      const { error } = await supabase.storage
        .from(TRADE_IMAGES_BUCKET)
        .copy(srcPath, destPath);
      if (error) throw error;

      copied.push({
        ...img,
        id: newId,
        url: getPublicUrl(TRADE_IMAGES_BUCKET, destPath),
        storage_path: destPath,
        calendar_id: destCalendarId,
        pending: false,
      });
    } catch (e) {
      logger.error('copyTradeImages: failed to copy image', img.id, e);
    }
  }

  return { images: copied, allFailed: copied.length === 0 };
}

/**
 * Copy a trade into each destination calendar. Per-destination isolation:
 * one failure never aborts the rest. Calls `onResult` after each destination.
 */
export async function copyTradeToCalendars(
  trade: Trade,
  destCalendars: Calendar[],
  onResult?: (result: CopyResult) => void
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];

  for (const dest of destCalendars) {
    let result: CopyResult;
    try {
      const destTrades = await getAllTrades(dest.id!);
      const amount = await computeCopyAmount(trade, dest, destTrades);
      const { images: copiedImages, allFailed } = await copyTradeImages(trade.images, dest.id!);
      const payload = buildCopiedTradePayload(trade, dest.id!, amount, copiedImages);
      await addTrade(dest.id!, payload);
      result = {
        calendarId: dest.id!,
        calendarName: dest.name,
        status: 'success',
        imagesOmitted: allFailed,
      };
    } catch (e) {
      logger.error('copyTradeToCalendars: failed for calendar', dest.id, e);
      result = {
        calendarId: dest.id!,
        calendarName: dest.name,
        status: 'error',
        error: (e as Error)?.message ?? 'Copy failed',
      };
    }
    results.push(result);
    onResult?.(result);
  }

  return results;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx react-scripts test src/features/calendar/services/tradeCopyService.test.ts --watchAll=false`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar/services/tradeCopyService.ts src/features/calendar/services/tradeCopyService.test.ts
git commit -m "feat(calendar): tradeCopyService — recalc, payload, image copy, orchestration"
```

---

### Task 3: `CopyTradeDialog` component + test

**Files:**
- Create: `src/features/calendar/components/dialogs/CopyTradeDialog.tsx`
- Test: `src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx`:

```typescript
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

const copyMock = jest.fn();
jest.mock('features/calendar/services/tradeCopyService', () => ({
  copyTradeToCalendars: (...args: any[]) => copyMock(...args),
  summarizeCopyResults: () => ({ kind: 'success', message: 'done' }),
}));

describe('CopyTradeDialog', () => {
  beforeEach(() => copyMock.mockReset());

  it('lists other calendars and excludes the current one', () => {
    render(
      <CopyTradeDialog open trade={makeTrade()} currentCalendarId="cur" userId="user-1" onClose={jest.fn()} />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('disables Copy until a destination is selected, then runs the copy', async () => {
    copyMock.mockResolvedValue([{ calendarId: 'a', calendarName: 'Alpha', status: 'success' }]);
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
    await waitFor(() => expect(copyMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onCopied).toHaveBeenCalled());
    expect(copyMock.mock.calls[0][1].map((c: Calendar) => c.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx react-scripts test src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx --watchAll=false`
Expected: FAIL — `Cannot find module './CopyTradeDialog'`.

- [ ] **Step 3: Implement the dialog**

Create `src/features/calendar/components/dialogs/CopyTradeDialog.tsx`:

```typescript
import React, { useMemo, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  Checkbox,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens } from 'styles/dialogTokens';
import { Trade } from 'features/calendar/types/dualWrite';
import { useCalendars } from 'features/calendar/hooks/useCalendars';
import {
  copyTradeToCalendars,
  summarizeCopyResults,
  CopyResult,
} from 'features/calendar/services/tradeCopyService';

interface CopyTradeDialogProps {
  open: boolean;
  trade: Trade | null;
  currentCalendarId?: string;
  userId?: string;
  onClose: () => void;
  /** Fired with the aggregate results when a copy run finishes. */
  onCopied?: (results: CopyResult[]) => void;
}

type RowStatus = 'idle' | 'running' | 'success' | 'error';

export const CopyTradeDialog: React.FC<CopyTradeDialogProps> = ({
  open,
  trade,
  currentCalendarId,
  userId,
  onClose,
  onCopied,
}) => {
  const theme = useTheme();
  const {
    violet, violetSofter, violetBorder, surfaceInset, hairline,
    paperSx, headerSx, iconAvatarSx, footerSx, monoSectionLabelSx, ghostButtonSx,
  } = useDialogTokens();

  const { calendars, isLoading } = useCalendars(userId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isCopying, setIsCopying] = useState(false);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [done, setDone] = useState(false);

  const destinations = useMemo(
    () => (calendars ?? []).filter((c) => c.id !== currentCalendarId && !c.deleted_at),
    [calendars, currentCalendarId]
  );

  const reset = () => {
    setSelected(new Set());
    setRowStatus({});
    setDone(false);
    setIsCopying(false);
  };

  const handleClose = () => {
    if (isCopying) return;
    reset();
    onClose();
  };

  const toggle = (id: string) => {
    if (isCopying || done) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    if (!trade || selected.size === 0) return;
    const targets = destinations.filter((c) => selected.has(c.id!));
    setIsCopying(true);
    setRowStatus(Object.fromEntries(targets.map((c) => [c.id!, 'running' as RowStatus])));

    const results = await copyTradeToCalendars(trade, targets, (r) => {
      setRowStatus((prev) => ({ ...prev, [r.calendarId]: r.status }));
    });

    setIsCopying(false);
    setDone(true);
    onCopied?.(results);
  };

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.5,
    py: 1,
    borderRadius: 1.5,
    border: `1px solid ${hairline}`,
    backgroundColor: surfaceInset,
    cursor: isCopying || done ? 'default' : 'pointer',
    transition: 'all 120ms ease',
    '&:hover': isCopying || done ? {} : { borderColor: violetBorder, backgroundColor: violetSofter },
  };

  const statusIcon = (id: string) => {
    const s = rowStatus[id];
    if (s === 'running') return <CircularProgress size={16} sx={{ color: violet }} />;
    if (s === 'success') return <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />;
    if (s === 'error') return <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />;
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{ paper: { sx: paperSx } }}
    >
      <Box sx={headerSx}>
        <Box sx={iconAvatarSx}>
          <CopyIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Copy trade to…
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {trade?.name ? `Copying "${trade.name}"` : 'Choose one or more calendars'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={isCopying} size="small" sx={{ color: theme.palette.text.secondary }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography sx={monoSectionLabelSx}>Destination calendars</Typography>
        <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 320, overflowY: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} sx={{ color: violet }} />
            </Box>
          ) : destinations.length === 0 ? (
            <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary, py: 2, textAlign: 'center' }}>
              You don't have any other calendars to copy to.
            </Typography>
          ) : (
            destinations.map((c) => (
              <Box key={c.id} sx={rowSx} onClick={() => toggle(c.id!)}>
                <Checkbox
                  checked={selected.has(c.id!)}
                  disabled={isCopying || done}
                  size="small"
                  sx={{ p: 0.5, color: violetBorder, '&.Mui-checked': { color: violet } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: theme.palette.text.primary }}>
                    {c.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                    Balance ${Number(c.account_balance ?? 0).toLocaleString()}
                  </Typography>
                </Box>
                {statusIcon(c.id!)}
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box sx={footerSx}>
        <Button onClick={handleClose} disabled={isCopying} sx={ghostButtonSx}>
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && (
          <Button
            onClick={handleCopy}
            disabled={isCopying || selected.size === 0}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 1.5, backgroundColor: violet }}
            startIcon={isCopying ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
          >
            Copy
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default CopyTradeDialog;
```

> **Note for implementer:** `useDialogTokens()` returns the tokens used above (verified against `DuplicateCalendarDialog.tsx`). If any token name differs at implementation time, read `styles/dialogTokens.ts` and adjust — do not invent token names.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx react-scripts test src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar/components/dialogs/CopyTradeDialog.tsx src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx
git commit -m "feat(calendar): CopyTradeDialog — destination picker with per-row progress"
```

---

### Task 4: Wire the context (state + callbacks + notification passthrough)

**Files:**
- Modify: `src/features/calendar/contexts/TradeOperationsContext.tsx`

- [ ] **Step 1: Extend the context value interface**

In `interface TradeOperationsContextValue extends TradeOperationsProps { ... }`, add these members after `clearNotification`:

```typescript
  copyDialog: { open: boolean; trade: Trade | null };
  closeCopyDialog: () => void;
  pushNotification: (n: OpNotification) => void;
```

- [ ] **Step 2: Add state + callbacks in the provider**

After the `notification` state line (`const [notification, setNotification] = useState<OpNotification | null>(null);`), add:

```typescript
  const [copyDialog, setCopyDialog] = useState<{ open: boolean; trade: Trade | null }>({
    open: false,
    trade: null,
  });

  const onCopyTrade = useCallback((trade: Trade) => {
    setCopyDialog({ open: true, trade });
  }, []);

  const closeCopyDialog = useCallback(() => {
    setCopyDialog({ open: false, trade: null });
  }, []);

  const pushNotification = useCallback((n: OpNotification) => setNotification(n), []);
```

- [ ] **Step 3: Expose them in the memoized value**

In the `useMemo` returned object, add `onCopyTrade` to the gated callbacks (next to `onEditTrade`) and the three new members:

```typescript
      onCopyTrade: isReadOnly ? undefined : onCopyTrade,
```

and, near `clearNotification,`:

```typescript
      copyDialog,
      closeCopyDialog,
      pushNotification,
```

- [ ] **Step 4: Update the dependency array**

Add `onCopyTrade`, `copyDialog`, `closeCopyDialog`, `pushNotification` to the `useMemo` dependency array.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/calendar/contexts/TradeOperationsContext.tsx
git commit -m "feat(calendar): TradeOperationsContext copy-dialog state + onCopyTrade"
```

---

### Task 5: Render the dialog in `GlobalTradeOperations`

**Files:**
- Modify: `src/features/calendar/components/trades/GlobalTradeOperations.tsx`

- [ ] **Step 1: Import the dialog + summarizer**

Add imports near the top:

```typescript
import CopyTradeDialog from '../dialogs/CopyTradeDialog';
import { summarizeCopyResults } from '../../services/tradeCopyService';
```

- [ ] **Step 2: Destructure the new context members**

In the `useTradeOperations()` destructure, add `copyDialog`, `closeCopyDialog`, `pushNotification`.

- [ ] **Step 3: Render the dialog**

Immediately before the closing `</>` (after the `<Snackbar>` block), add:

```tsx
      <CopyTradeDialog
        open={copyDialog.open}
        trade={copyDialog.trade}
        currentCalendarId={calendar.id}
        userId={calendar.user_id}
        onClose={closeCopyDialog}
        onCopied={(results) => pushNotification(summarizeCopyResults(results))}
      />
```

> The `if (isReadOnly || !calendar) return null;` guard above guarantees `calendar` is defined here.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar/components/trades/GlobalTradeOperations.tsx
git commit -m "feat(calendar): mount CopyTradeDialog in GlobalTradeOperations"
```

---

### Task 6: Add the "Copy to calendar" menu item in `TradeList`

**Files:**
- Modify: `src/features/calendar/components/trades/TradeList.tsx`

- [ ] **Step 1: Import the copy icon**

Find the `@mui/icons-material` import group and add `ContentCopy as ContentCopyIcon` (use the existing alias style in that import block).

- [ ] **Step 2: Destructure `onCopyTrade`**

In the `tradeOperations` destructure (around line 193), add:

```typescript
    onCopyTrade,
```

- [ ] **Step 3: Add the handler**

After `handleDeleteSelected` (around line 236), add:

```typescript
  const handleCopySelected = useCallback(() => {
    if (menuTrade && onCopyTrade) onCopyTrade(menuTrade);
    handleCloseMenu();
  }, [menuTrade, onCopyTrade, handleCloseMenu]);
```

- [ ] **Step 4: Add the menu item between Edit and Delete**

In the `#trade-actions-menu` `<Menu>`, between the Edit `<MenuItem>` and the Delete `<MenuItem>`, insert (only when `onCopyTrade` is provided so read-only/unsupported surfaces hide it):

```tsx
                      {onCopyTrade && (
                        <MenuItem onClick={(e) => { e.stopPropagation(); handleCopySelected(); }}>
                          <ListItemIcon>
                            <ContentCopyIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary="Copy to calendar" />
                        </MenuItem>
                      )}
```

- [ ] **Step 5: Typecheck + full test run**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx react-scripts test src/features/calendar/services/tradeCopyService.test.ts src/features/calendar/components/dialogs/CopyTradeDialog.test.tsx --watchAll=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/calendar/components/trades/TradeList.tsx
git commit -m "feat(calendar): Copy to calendar item in trade actions menu"
```

---

### Task 7: Final verification

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite (or at least the new files)**

Run: `npm test -- --watchAll=false`
Expected: green (or no new failures vs. baseline).

- [ ] **Step 3: Production build sanity**

Run: `npm run build`
Expected: build succeeds (catches circular-import / webpack issues that `tsc` misses — see memory `feedback_extraction_circular_deps`).

- [ ] **Step 4: Dedup audit**

Invoke the `dedup-audit` skill against the new code to confirm no recalc/image/payload logic duplicates existing helpers.

- [ ] **Step 5: Manual checklist (document for the user; not blocking the overnight run)**

  - Open a calendar with ≥1 trade; 3-dot menu shows **Copy to calendar** between Edit and Delete.
  - Copy a trade (with an image) to 2 calendars with *different* risk settings → both copies appear with PnL recomputed; image visible in each.
  - Delete the **source** trade → the copies' images still resolve (independence).
  - Copy a loss trade → destination shows a negative amount consistent with a manually-entered loss.
  - Read-only (shared) calendar → no Copy item.

---

## Spec coverage self-check

- Standalone copy, no link/sync → Task 2 `buildCopiedTradePayload` (`source_trade_id` undefined, `is_synced_copy` false). ✅
- Multiple destinations in one action → Task 2 `copyTradeToCalendars` loop + Task 3 multi-select. ✅
- PnL recalc + fallbacks → Task 2 `computeCopyAmount`. ✅
- Independent images via `.copy()` + best-effort + all-fail-still-create → Task 2 `copyTradeImages` + `imagesOmitted`. ✅
- Menu entry in `TradeList` only; shared callback for future surfaces → Tasks 1, 4, 6. ✅
- Reused snackbar feedback → Tasks 4, 5 (`pushNotification` + `summarizeCopyResults`). ✅
- Destination `year_stats` recompute → free via `addTrade()` webhook (no code). ✅
- Loss-sign verification → Task 2 test "recalculates a loss as a NEGATIVE amount". ✅
