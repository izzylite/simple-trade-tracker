import React from 'react';
import { Box, Breadcrumbs as MuiBreadcrumbs, Link, Typography, useTheme, alpha, IconButton, Tooltip } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
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

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, path?: string) => {
    event.preventDefault();
    if (path) {
      navigate(path);
    }
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
              return (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
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
    </Box>
  );
};

export default Breadcrumbs;

