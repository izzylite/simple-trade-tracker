import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CallMadeIcon from '@mui/icons-material/CallMadeOutlined';
import CallReceivedIcon from '@mui/icons-material/CallReceivedOutlined';
import { ContentState } from 'draft-js';
import type { TradeChipData } from 'components/common/RichTextEditor/utils/tradeEntityUtils';

interface TradeLinkProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
  /**
   * Shared-trade click handler. Wired through from the host (NoteEditorBody)
   * so a TRADE_LINK chip click opens the same gallery preview that a raw
   * /shared/{shareId} link would.
   */
  onSharedTradeClick?: (shareId: string, tradeId: string) => void;
}

/**
 * Inline trade-reference chip. Color is tied to win/loss semantics
 * (green for ≥0, red for <0). Click routes through onSharedTradeClick so
 * the chip and a plain shared-trade link share one navigation path.
 */
const TradeLinkComponent: React.FC<TradeLinkProps> = ({
  contentState,
  entityKey,
  children,
  onSharedTradeClick,
}) => {
  const theme = useTheme();
  const data = contentState
    .getEntity(entityKey)
    .getData() as TradeChipData;
  const { shareId, tradeId, pnl, direction } = data;
  const isWin = pnl >= 0;
  const color = isWin
    ? theme.palette.success.main
    : theme.palette.error.main;
  const Arrow = direction === 'short'
    ? CallReceivedIcon
    : CallMadeIcon;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSharedTradeClick && shareId) {
      onSharedTradeClick(shareId, tradeId);
    }
  };

  return (
    <span
      contentEditable={false}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        backgroundColor: alpha(color, 0.12),
        color,
        border: `1px solid ${alpha(color, 0.28)}`,
        borderRadius: 12,
        padding: '1px 8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.6,
        verticalAlign: 'baseline',
        userSelect: 'none',
        cursor: onSharedTradeClick && shareId ? 'pointer' : 'default',
        letterSpacing: '0.02em',
        textDecoration: 'none',
        opacity: onSharedTradeClick && shareId ? 1 : 0.7,
        fontFeatureSettings: '"tnum" on, "lnum" on',
      }}
      title={
        onSharedTradeClick && shareId
          ? `Open shared trade`
          : `Shared trade`
      }
    >
      <Arrow
        style={{ fontSize: '0.85rem', flexShrink: 0 }}
      />
      {children}
    </span>
  );
};

export default TradeLinkComponent;
