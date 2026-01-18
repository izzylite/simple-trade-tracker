import React, { useState } from 'react';
import { Box, Breadcrumbs as MuiBreadcrumbs, Link, Typography, useTheme, alpha, IconButton, Tooltip, Menu, MenuItem, Stack } from '@mui/material';
import { NavigateNext as NavigateNextIcon, KeyboardArrowDown as ArrowDownIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export interface DropdownItem {
  label: string;
  path: string;
  active?: boolean;
  totalTrades?: number;
  pnl?: number;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
  dropdown?: DropdownItem[]; // Optional dropdown items for this breadcrumb
}

export interface BreadcrumbButton {
  key: string;
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  buttons?: BreadcrumbButton[]; // up to 5 buttons rendered on the right
  rightContent?: React.ReactNode; // optional custom content rendered at the far right
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, buttons, rightContent }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dropdownItemIndex, setDropdownItemIndex] = useState<number | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, path?: string) => {
    event.preventDefault();
    if (path) {
      navigate(path);
    }
  };

  const handleDropdownClick = (event: React.MouseEvent<HTMLElement>, index: number) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setDropdownItemIndex(index);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setDropdownItemIndex(null);
  };

  const handleDropdownItemClick = (path: string) => {
    navigate(path);
    handleMenuClose();
  };

  // Hide breadcrumbs if there's only one item (main page)
  if (items.length <= 1) {
    return null;
  }

  const safeButtons = (buttons || []).slice(0, 5);

  return (
    <Box
      sx={{
        px: 3,
        py: 1.5,
        bgcolor: alpha(theme.palette.divider, 0.03),
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        backdropFilter: 'blur(8px)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <MuiBreadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
          aria-label="breadcrumb"
          sx={{
            '& .MuiBreadcrumbs-separator': {
              mx: 0.5
            }
          }}
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isFirst = index === 0;

            if (isLast) {
              const hasDropdown = Boolean(item.dropdown && item.dropdown.length > 0);

              return (
                <Box
                  key={item.label}
                  onClick={hasDropdown ? (e) => handleDropdownClick(e, index) : undefined}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: hasDropdown ? 'pointer' : 'default',
                    position: 'relative',
                    '&:hover': hasDropdown ? {
                      '& .dropdown-arrow': {
                        color: theme.palette.primary.main
                      }
                    } : {}
                  }}
                >
                  {item.icon}
                  <Typography
                    color="text.primary"
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      maxWidth: { xs: 150, sm: 300 },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.label}
                  </Typography>
                  {hasDropdown && (
                    <ArrowDownIcon
                      className="dropdown-arrow"
                      sx={{
                        fontSize: 16,
                        color: 'text.secondary',
                        transition: 'color 0.2s'
                      }}
                    />
                  )}
                </Box>
              );
            }

            return (
              <Link
                key={item.label}
                underline="hover"
                color="text.secondary"
                href={item.path || '#'}
                onClick={(e) => handleClick(e, item.path)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'color 0.2s',
                  '&:hover': {
                    color: theme.palette.primary.main
                  }
                }}
              >
                {isFirst && item.icon ? item.icon : null}
                {item.label}
              </Link>
            );
          })}
        </MuiBreadcrumbs>

        {(safeButtons.length > 0 || rightContent) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {safeButtons.map(btn => (
              <Tooltip key={btn.key} title={btn.tooltip || ''}>
                <span>
                  <IconButton
                    size="small"
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    {btn.icon}
                  </IconButton>
                </span>
              </Tooltip>
            ))}
            {rightContent && (
              <Box sx={{ ml: 0.5, display: 'flex', alignItems: 'center' }}>
                {rightContent}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Dropdown Menu */}
      {dropdownItemIndex !== null && items[dropdownItemIndex]?.dropdown && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                minWidth: 200,
                maxWidth: 350,
                maxHeight: 400,
                bgcolor: alpha(theme.palette.background.paper, 0.95),
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: theme.shadows[8]
              }
            }
          }}
          transformOrigin={{ horizontal: 'left', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        >
          {items[dropdownItemIndex].dropdown!.map((dropdownItem) => {
            const hasPnl = dropdownItem.pnl !== undefined;
            const isPositive = (dropdownItem.pnl ?? 0) >= 0;
            const formattedPnl = hasPnl
              ? `${isPositive ? '+' : ''}$${Math.abs(dropdownItem.pnl!).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : null;

            return (
              <MenuItem
                key={dropdownItem.path}
                onClick={() => handleDropdownItemClick(dropdownItem.path)}
                selected={dropdownItem.active}
                sx={{
                  py: 1,
                  px: 2,
                  fontSize: '0.875rem',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.15)
                    }
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: dropdownItem.active ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    {dropdownItem.label}
                  </Typography>
                  {(dropdownItem.totalTrades !== undefined || hasPnl) && (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                      {dropdownItem.totalTrades !== undefined && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem'
                          }}
                        >
                          {dropdownItem.totalTrades} trades
                        </Typography>
                      )}
                      {hasPnl && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            color: isPositive ? 'success.main' : 'error.main'
                          }}
                        >
                          {formattedPnl}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Box>
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </Box>
  );
};

export default Breadcrumbs;

