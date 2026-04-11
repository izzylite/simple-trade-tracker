/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis.
 * Manages backdrop, positioning, animation, and close button.
 * Delegates all chat content to AIChatContent.
 */

import React, { useEffect } from 'react';
import OrionIcon from './OrionIcon';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import AIChatContent from '../sidePanel/content/AIChatContent';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;
  tradeOperations: TradeOperationsProps;
}

// Bottom sheet heights
const BOTTOM_SHEET_HEIGHTS = {
  default: 780
} as const;

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar,
  isReadOnly = false,
  tradeOperations
}) => {
  const theme = useTheme();

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop - Click to close */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(0,0,0,0.6)'
            : 'rgba(0,0,0,0.3)',
          zIndex: Z_INDEX.AI_DRAWER_BACKDROP,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition:
            'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
          cursor: 'pointer'
        }}
      />

      {/* Bottom Sheet Drawer */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          right: { xs: 0, sm: 20 },
          left: { xs: 0, sm: 'auto' },
          zIndex: Z_INDEX.AI_DRAWER,
          height: open ? BOTTOM_SHEET_HEIGHTS.default : 0,
          maxHeight: '85vh',
          width: '100%',
          maxWidth: {
            xs: '100%', sm: '420px', md: '460px', lg: '500px'
          },
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: 'background.paper',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 -8px 24px rgba(0,0,0,0.5)'
            : '0 -8px 24px rgba(0,0,0,0.1)',
          border: `1px solid ${theme.palette.divider}`,
          borderBottom: 'none',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), '
            + 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none'
        }}
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header — logo, title, close button */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.palette.divider}`
          }}>
            {/* Left side - Logo and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <OrionIcon size={36} />
              <Box>
                <Typography variant="h6" sx={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  lineHeight: 1.2
                }}>
                  Orion
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem'
                }}>
                  {calendar
                    ? (() => {
                        const totalTrades = calendar.year_stats
                          ? Object.values(calendar.year_stats).reduce(
                              (sum, ys) =>
                                sum + (ys.total_trades || 0),
                              0
                            )
                          : 0;
                        return totalTrades > 0
                          ? `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} in ${calendar.name}`
                          : `${calendar.name} - Ready for analysis`;
                      })()
                    : 'Ready for trading analysis across all calendars'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Right side - Close button */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Close">
                <IconButton
                  size="small"
                  onClick={onClose}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: alpha(
                        theme.palette.action.hover, 0.5
                      )
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Delegated chat content */}
          <AIChatContent
            trades={trades}
            calendar={calendar}
            isReadOnly={isReadOnly}
            tradeOperations={tradeOperations}
            isActive={open}
          />
        </Box>
      </Box>
    </>
  );
};

export default AIChatDrawer;
