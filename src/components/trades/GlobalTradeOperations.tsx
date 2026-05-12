import React, { useMemo } from 'react';
import TradeFormDialog from './TradeFormDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { useTradeOperations } from '../../contexts/TradeOperationsContext';
import { useTradesContext } from '../../contexts/TradesContext';
import { formatCount } from '../../utils/formatters';
import { DynamicRiskSettings } from '../../utils/dynamicRiskUtils';

/**
 * App-level mount for the trade form + delete-confirm dialogs. State lives
 * in TradeOperationsContext; this component owns only the JSX so any route
 * can fire edit / add / delete actions and have the dialog render once.
 *
 * Read-only calendars (shared) suppress rendering — the provider already
 * suppresses the trigger callbacks, but we belt-and-brace here so a stale
 * formDialog.open state from a calendar switch never paints anything.
 */
const GlobalTradeOperations: React.FC = () => {
  const { calendar, hook } = useTradesContext();
  const {
    formDialog,
    deleteDialog,
    newTrade,
    setNewTrade,
    closeFormDialog,
    confirmDelete,
    cancelDelete,
    isReadOnly,
    deletingTradeIdsList,
  } = useTradeOperations();

  const dynamicRiskSettings: DynamicRiskSettings = useMemo(
    () => ({
      account_balance: calendar?.account_balance ?? 0,
      risk_per_trade: calendar?.risk_per_trade,
      dynamic_risk_enabled: calendar?.dynamic_risk_enabled,
      increased_risk_percentage: calendar?.increased_risk_percentage,
      profit_threshold_percentage: calendar?.profit_threshold_percentage,
    }),
    [
      calendar?.account_balance,
      calendar?.risk_per_trade,
      calendar?.dynamic_risk_enabled,
      calendar?.increased_risk_percentage,
      calendar?.profit_threshold_percentage,
    ]
  );

  const allTags = useMemo(() => calendar?.tags ?? [], [calendar?.tags]);

  const handleClose = () => closeFormDialog();
  const handleCancel = () => {
    formDialog.onAfterCancel?.();
    closeFormDialog();
  };

  if (isReadOnly || !calendar) return null;

  return (
    <>
      <TradeFormDialog
        open={formDialog.open}
        onClose={handleClose}
        onCancel={handleCancel}
        showForm={{
          open: formDialog.open,
          editTrade: formDialog.editTrade,
          createTempTrade: formDialog.createTempTrade,
        }}
        trade_date={formDialog.trade_date}
        onAddTrade={hook.addTrade}
        newMainTrade={newTrade}
        setNewMainTrade={(prev) => setNewTrade(prev(newTrade!))}
        onTagUpdated={hook.onTagUpdated}
        onUpdateTradeProperty={hook.handleUpdateTradeProperty}
        onDeleteTrades={hook.deleteTrades}
        setZoomedImage={() => {
          /* Image zoom handled by GlobalTradeViewer / page-local zoom */
        }}
        account_balance={calendar.account_balance}
        onAccountBalanceChange={hook.handleAccountBalanceChange}
        calendar={calendar}
        tags={allTags}
        dynamicRiskSettings={dynamicRiskSettings}
        requiredTagGroups={calendar.required_tag_groups}
        onOpenGalleryMode={undefined}
      />

      <ConfirmationDialog
        open={deleteDialog.open}
        title={
          deleteDialog.tradeIds.length === 1
            ? 'Delete Trade'
            : `Delete ${formatCount(deleteDialog.tradeIds.length)} Trades`
        }
        message={
          deleteDialog.tradeIds.length === 1
            ? 'Are you sure you want to delete this trade? This action cannot be undone.'
            : `Are you sure you want to delete ${formatCount(
                deleteDialog.tradeIds.length
              )} trades? This action cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmColor="error"
        isSubmitting={deletingTradeIdsList.some((id) =>
          deleteDialog.tradeIds.includes(id)
        )}
      />
    </>
  );
};

export default GlobalTradeOperations;
