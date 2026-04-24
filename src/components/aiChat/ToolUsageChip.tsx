/**
 * Collapsed "N tools used" chip with an expandable list of per-tool chips.
 *
 * Shared by ChatMessage (chat) and TaskResultCard (Orion tasks) so both
 * surfaces render tool-usage identically — same icon, same color tokens,
 * same expand/collapse behavior.
 *
 * variant="inline" (default): expands below the chip in-flow.
 * variant="popover": opens a floating popover anchored to the chip — used by
 *   Orion task cards so the expanded list matches the Sources dropdown and
 *   doesn't push content down inside the card.
 */
import React, { useState, useRef } from 'react';
import { Box, Chip, Popover, Typography, useTheme, alpha } from '@mui/material';
import {
  BuildCircleOutlined as ToolsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

export interface ToolUsageEntry {
  name: string;
  label: string;
}

interface ToolUsageChipProps {
  toolCalls: ToolUsageEntry[];
  /** Start expanded. Inline mode only. */
  defaultExpanded?: boolean;
  /** How the expanded list is rendered. Defaults to "inline". */
  variant?: 'inline' | 'popover';
}

const ToolUsageChip: React.FC<ToolUsageChipProps> = ({
  toolCalls,
  defaultExpanded = false,
  variant = 'inline',
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);

  if (!toolCalls || toolCalls.length === 0) return null;

  // Group duplicates by label, preserving first-occurrence order. One chip per
  // distinct tool with a "×N" suffix when count > 1 — keeps the expanded list
  // readable when a sweep fires the same tool dozens of times.
  const grouped: { label: string; count: number }[] = [];
  for (const tc of toolCalls) {
    const existing = grouped.find((g) => g.label === tc.label);
    if (existing) existing.count += 1;
    else grouped.push({ label: tc.label, count: 1 });
  }

  const isPopover = variant === 'popover';
  const popoverOpen = Boolean(anchorEl);
  const isOpen = isPopover ? popoverOpen : expanded;

  const handleClick = () => {
    if (isPopover) {
      setAnchorEl(popoverOpen ? null : chipRef.current);
    } else {
      setExpanded((v) => !v);
    }
  };

  const toolListContent = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {grouped.map((g, idx) => (
        <Chip
          key={`${g.label}-${idx}`}
          label={g.count > 1 ? `${g.label} ×${g.count}` : g.label}
          size="small"
          variant="outlined"
          sx={{
            height: 24,
            fontSize: '0.72rem',
            borderColor: alpha(theme.palette.divider, 0.8),
            color: 'text.secondary',
          }}
        />
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Box
        ref={chipRef}
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          height: 28,
          px: 1,
          borderRadius: 999,
          cursor: 'pointer',
          color: 'text.secondary',
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.6),
            borderColor: alpha(theme.palette.primary.main, 0.4),
          },
        }}
      >
        <ToolsIcon sx={{ fontSize: 16 }} />
        <Typography
          variant="caption"
          sx={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1 }}
        >
          {toolCalls.length} tool{toolCalls.length === 1 ? '' : 's'} used
        </Typography>
        {isOpen ? (
          <ExpandLessIcon sx={{ fontSize: 16 }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 16 }} />
        )}
      </Box>

      {!isPopover && expanded && (
        <Box sx={{ mt: 1 }}>{toolListContent}</Box>
      )}

      {isPopover && (
        <Popover
          open={popoverOpen}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          sx={{ zIndex: (t) => t.zIndex.modal + 100 }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                p: 1.25,
                maxWidth: 380,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                backgroundColor: theme.palette.background.paper,
              },
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.75,
              fontWeight: 700,
              fontSize: '0.7rem',
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Tools used
          </Typography>
          {toolListContent}
        </Popover>
      )}
    </Box>
  );
};

export default ToolUsageChip;
