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
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  KeyboardArrowDown as ChevronDownIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
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
  /** Click on "View all" — opens the calendars-list panel/drawer. */
  onViewAll?: () => void;
  /** Selecting an item from the dropdown. */
  onSelect: (id: string) => void;
  /** Right-aligned content (edit, share, FAQ buttons, etc.) */
  rightContent?: React.ReactNode;
  /** Inline content rendered immediately to the right of the trigger.
   *  Use this for actions that read as part of the calendar context (Stats,
   *  share-link toggles, etc.). Use `rightContent` for page-level chrome. */
  inlineActions?: React.ReactNode;
  /** Optional small icon buttons rendered between trigger and rightContent. */
  buttons?: Array<{
    key: string;
    icon: React.ReactNode;
    onClick: () => void;
    tooltip?: string;
    disabled?: boolean;
  }>;
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
 * Header bar that replaces the old Breadcrumbs strip on TradeCalendarPage.
 * The active calendar name (with hero avatar + chevron) is the trigger;
 * clicking it opens a recent-calendars menu with a "View all" link to the
 * full panel/drawer. Selected item carries a left accent bar via ::before
 * (no side-stripe border — see DESIGN.md "The One Purple Rule").
 *
 * Right side hosts page-level actions (edit, share, FAQ) plus optional
 * inline icon buttons.
 */
const CalendarSelectorBar: React.FC<CalendarSelectorBarProps> = ({
  active,
  recent,
  onViewAll,
  onSelect,
  rightContent,
  inlineActions,
  buttons,
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

  const safeButtons = (buttons || []).slice(0, 5);

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 1.25,
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          minHeight: 40,
        }}
      >
        {/* Trigger */}
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
              bgcolor: alpha(theme.palette.action.hover, 1),
            },
            '&:focus-visible': {
              outline: 'none',
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
            },
          }}
        >
          <Avatar
            src={active.hero_image_url || undefined}
            variant="rounded"
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(theme.palette.primary.main, 0.18),
              '& img': { objectFit: 'cover' },
            }}
          >
            <CalendarIcon
              sx={{ fontSize: 16, color: theme.palette.primary.main }}
            />
          </Avatar>

          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              letterSpacing: '-0.015em',
              maxWidth: { xs: 180, sm: 320 },
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

        {/* Inline actions next to the trigger */}
        {inlineActions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 'auto', ml: 1 }}>
            {inlineActions}
          </Box>
        )}

        {/* Right actions */}
        {(safeButtons.length > 0 || rightContent) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {safeButtons.map((btn) => (
              <Tooltip key={btn.key} title={btn.tooltip || ''}>
                <span>
                  <IconButton
                    size="small"
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    {btn.icon}
                  </IconButton>
                </span>
              </Tooltip>
            ))}
            {rightContent}
          </Box>
        )}
      </Box>

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
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 4px 16px rgba(0,0,0,0.4)'
                  : '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
            },
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
          }}
        >
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
          {onViewAll && (
            <Button
              size="small"
              variant="text"
              onClick={handleViewAll}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                minWidth: 0,
                px: 1,
                py: 0.25,
                color: 'primary.main',
              }}
            >
              View all
            </Button>
          )}
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
                      : alpha(theme.palette.action.hover, 1),
                  },
                  '&::before': isActive
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: '0 2px 2px 0',
                        bgcolor: 'primary.main',
                      }
                    : undefined,
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
                    variant="rounded"
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
      </Menu>
    </Box>
  );
};

export default CalendarSelectorBar;
