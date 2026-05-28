import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Menu,
  MenuItem,
  Stack,
  Button,
  Divider,
  ButtonBase,
  alpha,
  useTheme,
} from '@mui/material';
import {
  KeyboardArrowDown as ChevronDownIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { getShadow } from 'styles/designTokens';

export interface CalendarSelectorItem {
  id: string;
  name: string;
  totalTrades?: number;
  pnl?: number;
  hero_image_url?: string;
  active?: boolean;
}

interface CalendarSelectorBarProps {
  /** The currently active calendar — surfaces its name + avatar in the trigger. */
  active: CalendarSelectorItem;
  /** Recent (and active) calendars rendered in the dropdown. Cap at 3 + the active one. */
  recent: CalendarSelectorItem[];
  /** Selecting an item from the dropdown. */
  onSelect: (id: string) => void;
  /** Optional "View all" link in the dropdown footer — opens the full
   *  CalendarsList drawer at the app level. Hidden when omitted. */
  onViewAll?: () => void;
}

const formatPnl = (pnl: number | undefined): string => {
  if (pnl === undefined) return '';
  const sign = pnl >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(pnl).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Calendar selector trigger + recent-calendars dropdown. Renders inline with
 * no outer bar chrome so it can be embedded in the AppHeader's Toolbar
 * without a competing border/background.
 */
const CalendarSelectorBar: React.FC<CalendarSelectorBarProps> = ({
  active,
  recent,
  onSelect,
  onViewAll,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelect = (id: string) => {
    handleClose();
    if (id === active.id) return;
    onSelect(id);
  };

  const handleViewAll = () => {
    handleClose();
    onViewAll?.();
  };

  return (
    <>
      <ButtonBase
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        focusRipple
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          pl: 0.5,
          pr: 1,
          py: 0.5,
          borderRadius: 1,
          transition: 'background 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            bgcolor: theme.palette.action.hover,
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: theme.palette.custom.focusRingStrong,
          },
        }}
      >
        <Avatar
          src={active.hero_image_url || undefined}
          variant="circular"
          sx={{
            width: 28,
            height: 28,
            bgcolor: alpha(theme.palette.primary.main, 0.18),
            '& img': { objectFit: 'cover' },
          }}
        >
          <CalendarIcon
            sx={{ fontSize: 14, color: theme.palette.primary.main }}
          />
        </Avatar>

        <Typography
          sx={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            maxWidth: { xs: 140, sm: 240 },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'text.primary',
          }}
        >
          {active.name}
        </Typography>

        <ChevronDownIcon
          sx={{
            fontSize: 18,
            color: 'text.secondary',
            transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </ButtonBase>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 280,
              maxWidth: 380,
              maxHeight: 420,
              borderRadius: 1.5,
              boxShadow: getShadow(theme, 'lg'),
            },
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography
            variant="overline"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'text.secondary',
              lineHeight: 1.1,
            }}
          >
            Calendars
          </Typography>
        </Box>

        <Divider sx={{ my: 0 }} />

        <Box sx={{ py: 0.5 }}>
          {recent.map((item) => {
            const isActive = item.active ?? item.id === active.id;
            const hasPnl = item.pnl !== undefined;
            const isPositive = (item.pnl ?? 0) >= 0;

            return (
              <MenuItem
                key={item.id}
                onClick={() => handleSelect(item.id)}
                sx={{
                  position: 'relative',
                  px: 2,
                  py: 1,
                  mx: 0.75,
                  my: 0.25,
                  borderRadius: 1,
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, 0.12)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: isActive
                      ? alpha(theme.palette.primary.main, 0.16)
                      : theme.palette.action.hover,
                  },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{ width: '100%' }}
                >
                  <Avatar
                    src={item.hero_image_url || undefined}
                    variant="circular"
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      '& img': { objectFit: 'cover' },
                    }}
                  >
                    <CalendarIcon
                      sx={{ fontSize: 14, color: theme.palette.primary.main }}
                    />
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500,
                        color: 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.name}
                    </Typography>
                    {item.totalTrades !== undefined && (
                      <Typography
                        sx={{
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          color: 'text.secondary',
                          letterSpacing: '0.02em',
                          mt: 0.25,
                        }}
                      >
                        {item.totalTrades.toLocaleString()} trades
                      </Typography>
                    )}
                  </Box>

                  {hasPnl && (
                    <Stack
                      direction="row"
                      spacing={0.25}
                      alignItems="center"
                      sx={{ flexShrink: 0 }}
                    >
                      {isPositive ? (
                        <TrendingUpIcon
                          sx={{ fontSize: 14, color: 'success.main' }}
                        />
                      ) : (
                        <TrendingDownIcon
                          sx={{ fontSize: 14, color: 'error.main' }}
                        />
                      )}
                      <Typography
                        sx={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: isPositive ? 'success.main' : 'error.main',
                          fontFeatureSettings: "'tnum' on, 'lnum' on",
                        }}
                      >
                        {formatPnl(item.pnl)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </MenuItem>
            );
          })}
        </Box>

        {onViewAll && (
          <>
            <Divider sx={{ my: 0 }} />
            <Box sx={{ px: 1.25, py: 0.5 }}>
              <Button
                fullWidth
                size="small"
                variant="text"
                onClick={handleViewAll}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  py: 0.75,
                  borderRadius: 1,
                  color: 'primary.main',
                  justifyContent: 'center',
                }}
              >
                View all calendars
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

export default CalendarSelectorBar;
