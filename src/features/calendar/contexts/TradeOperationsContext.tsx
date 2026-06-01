import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trade, Calendar } from '../types/dualWrite';
import { useTradesContext } from './TradesContext';
import { TradeOperationsProps } from '../types/tradeOperations';
import {
  createNewTradeData,
  createEditTradeData,
} from '../components/trades/tradeFormHelpers';
import type { NewTradeForm } from '../components/trades/TradeForm';
import { DEFAULT_FILTER_SETTINGS } from 'features/events/hooks/useEconomicCalendarFilters';

/**
 * App-level controller for trade mutating operations. Owns the edit/add
 * dialog state and the delete-confirm dialog state; routes the actual
 * mutations through TradesContext.hook so a single useCalendarTrades
 * instance backs every caller.
 *
 * Read-only calendars (shared) suppress mutating ops — every callback in
 * the returned TradeOperationsProps stays `undefined` so panel buttons
 * gracefully disable.
 */
export interface FormDialogState {
  open: boolean;
  trade_date: Date;
  editTrade: Trade | null;
  createTempTrade: boolean;
  showDayDialogWhenDone: boolean;
  onAfterCancel?: () => void;
}

const EMPTY_FORM: FormDialogState = {
  open: false,
  trade_date: new Date(),
  editTrade: null,
  createTempTrade: false,
  showDayDialogWhenDone: false,
};

export interface DeleteDialogState {
  open: boolean;
  tradeIds: string[];
  error: string | null;
}

const EMPTY_DELETE: DeleteDialogState = {
  open: false,
  tradeIds: [],
  error: null,
};

export interface OpenAddDialogArgs {
  trade_date: Date;
  showDayDialogWhenDone?: boolean;
  onAfterCancel?: () => void;
}

/**
 * Snackbar-style notification emitted after a delete attempt. `error` variants
 * carry the failed `retryIds` so the consumer (GlobalTradeOperations) can
 * surface a Retry action that re-runs the deletion without re-prompting.
 */
export interface OpNotification {
  kind: 'success' | 'error';
  message: string;
  retryIds?: string[];
}

interface TradeOperationsContextValue extends TradeOperationsProps {
  openAddDialog: (args: OpenAddDialogArgs) => void;
  closeFormDialog: () => void;
  newTrade: NewTradeForm | null;
  setNewTrade: React.Dispatch<React.SetStateAction<NewTradeForm | null>>;
  formDialog: FormDialogState;
  deleteDialog: DeleteDialogState;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  retryDelete: () => Promise<void>;
  deletingTradeIdsList: string[];
  notification: OpNotification | null;
  clearNotification: () => void;
  copyDialog: { open: boolean; trade: Trade | null };
  closeCopyDialog: () => void;
  pushNotification: (n: OpNotification) => void;
}

const TradeOperationsContext =
  createContext<TradeOperationsContextValue | null>(null);

export const TradeOperationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { calendar, calendarId, hook, isReadOnly } = useTradesContext();

  const [formDialog, setFormDialog] = useState<FormDialogState>(EMPTY_FORM);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [deleteDialog, setDeleteDialog] =
    useState<DeleteDialogState>(EMPTY_DELETE);
  const [deletingTradeIdsList, setDeletingTradeIdsList] = useState<string[]>(
    []
  );
  const [notification, setNotification] = useState<OpNotification | null>(null);

  const clearNotification = useCallback(() => setNotification(null), []);

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

  const formatCountFor = (n: number): string =>
    n === 1 ? '1 trade' : `${n} trades`;

  const runDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setDeletingTradeIdsList((prev) => [...prev, ...ids]);
      try {
        await hook.deleteTrades(ids);
        setNotification({
          kind: 'success',
          message:
            ids.length === 1
              ? 'Trade deleted.'
              : `${formatCountFor(ids.length)} deleted.`,
        });
      } catch (err) {
        setNotification({
          kind: 'error',
          message:
            ids.length === 1
              ? 'Failed to delete trade.'
              : `Failed to delete ${formatCountFor(ids.length)}.`,
          retryIds: ids,
        });
      } finally {
        setDeletingTradeIdsList((prev) =>
          prev.filter((id) => !ids.includes(id))
        );
      }
    },
    [hook]
  );

  const openAddDialog = useCallback((args: OpenAddDialogArgs) => {
    setNewTrade(createNewTradeData());
    setFormDialog({
      open: true,
      trade_date: args.trade_date,
      editTrade: null,
      createTempTrade: false,
      showDayDialogWhenDone: args.showDayDialogWhenDone ?? false,
      onAfterCancel: args.onAfterCancel,
    });
  }, []);

  const onEditTrade = useCallback((trade: Trade) => {
    setNewTrade(createEditTradeData(trade));
    setFormDialog({
      open: true,
      trade_date:
        trade.trade_date instanceof Date
          ? trade.trade_date
          : new Date(trade.trade_date),
      editTrade: trade,
      createTempTrade: false,
      showDayDialogWhenDone: false,
    });
  }, []);

  const closeFormDialog = useCallback(() => {
    setFormDialog(EMPTY_FORM);
    setNewTrade((prev) => {
      if (prev?.pending_images) {
        prev.pending_images.forEach((image) =>
          URL.revokeObjectURL(image.preview)
        );
      }
      return null;
    });
  }, []);

  const onDeleteTrade = useCallback((tradeId: string) => {
    setDeleteDialog({ open: true, tradeIds: [tradeId], error: null });
  }, []);

  const onDeleteMultipleTrades = useCallback((tradeIds: string[]) => {
    setDeleteDialog({ open: true, tradeIds, error: null });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteDialog(EMPTY_DELETE);
  }, []);

  const confirmDelete = useCallback(async () => {
    const ids = deleteDialog.tradeIds;
    if (ids.length === 0) return;
    setDeleteDialog(EMPTY_DELETE);
    await runDelete(ids);
  }, [deleteDialog.tradeIds, runDelete]);

  const retryDelete = useCallback(async () => {
    const ids = notification?.retryIds;
    if (!ids || ids.length === 0) return;
    setNotification(null);
    await runDelete(ids);
  }, [notification, runDelete]);

  const onUpdateCalendarProperty = useCallback(
    async (
      _calendarId: string,
      updateCallback: (calendar: Calendar) => Calendar
    ) => {
      return hook.handleUpdateCalendarProperty(updateCallback);
    },
    [hook]
  );

  const value = useMemo<TradeOperationsContextValue>(
    () => ({
      onUpdateTradeProperty: isReadOnly
        ? undefined
        : hook.handleUpdateTradeProperty,
      onEditTrade: isReadOnly ? undefined : onEditTrade,
      onCopyTrade: isReadOnly ? undefined : onCopyTrade,
      onDeleteTrade: isReadOnly ? undefined : onDeleteTrade,
      onDeleteMultipleTrades: isReadOnly ? undefined : onDeleteMultipleTrades,
      onZoomImage: undefined,
      onOpenGalleryMode: undefined,
      onUpdateCalendarProperty: isReadOnly
        ? undefined
        : onUpdateCalendarProperty,
      isTradeUpdating: hook.isTradeUpdating,
      deletingTradeIds: deletingTradeIdsList,
      calendarId: calendarId || undefined,
      calendar: calendar || undefined,
      isReadOnly,
      economicFilter: (_calendarId: string) =>
        calendar?.economic_calendar_filters ?? DEFAULT_FILTER_SETTINGS,
      openAddDialog,
      closeFormDialog,
      newTrade,
      setNewTrade,
      formDialog,
      deleteDialog,
      confirmDelete,
      cancelDelete,
      retryDelete,
      deletingTradeIdsList,
      notification,
      clearNotification,
      copyDialog,
      closeCopyDialog,
      pushNotification,
    }),
    [
      isReadOnly,
      hook,
      onEditTrade,
      onDeleteTrade,
      onDeleteMultipleTrades,
      onUpdateCalendarProperty,
      deletingTradeIdsList,
      calendarId,
      calendar,
      openAddDialog,
      closeFormDialog,
      newTrade,
      formDialog,
      deleteDialog,
      confirmDelete,
      cancelDelete,
      retryDelete,
      notification,
      clearNotification,
      onCopyTrade,
      copyDialog,
      closeCopyDialog,
      pushNotification,
    ]
  );

  return (
    <TradeOperationsContext.Provider value={value}>
      {children}
    </TradeOperationsContext.Provider>
  );
};

export const useTradeOperations = (): TradeOperationsContextValue => {
  const ctx = useContext(TradeOperationsContext);
  if (!ctx)
    throw new Error(
      'useTradeOperations must be used within TradeOperationsProvider'
    );
  return ctx;
};
