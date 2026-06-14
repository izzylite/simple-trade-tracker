// One tool's row in the settings list. Renders the card header (name,
// chips, action buttons), the body (description + success/failure
// counters + last-fired summary + flash result of the last Test click),
// and the inline-expanded edit panel when this tool is the current
// expandedId.

import React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ErrorOutline as ErrorIcon,
  CheckCircleOutline as SuccessIcon,
  HighlightOff as FailIcon,
  PlayArrow as TestIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import CardShell from 'components/common/CardShell';
import { MONO_FONT } from 'styles/designTokens';
import { AnimatedDropdown } from 'features/calendar/components/Animations';
import type {
  CustomToolListEntry,
  TestToolResult,
} from 'features/orion/types/customTool';
import CustomToolFormPanel from './CustomToolFormPanel';

interface Props {
  tool: CustomToolListEntry;
  expanded: boolean;
  isTogglePending: boolean;
  isTesting: boolean;
  flash: TestToolResult | undefined;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (tool: CustomToolListEntry) => void;
  onToggleExpanded: (id: string) => void;
  onDelete: (tool: CustomToolListEntry) => void;
  onPanelClose: () => void;
  onPanelSaved: () => void;
}

function lastFiredSummary(tool: CustomToolListEntry): string | null {
  const successAt = tool.last_success_at ? new Date(tool.last_success_at).getTime() : 0;
  const failureAt = tool.last_failure_at ? new Date(tool.last_failure_at).getTime() : 0;
  if (!successAt && !failureAt) return null;
  const latest = Math.max(successAt, failureAt);
  return `Last fired ${formatDistanceToNow(new Date(latest), { addSuffix: true })}`;
}

const FLASH_COPY: Record<TestToolResult['status'], (err?: string | null) => string> = {
  success: () => '✓ Webhook responded successfully',
  failed: (err) => `✕ Test failed${err ? ` — ${err}` : ''}`,
  rate_limited: () => 'Rate-limited — try again in a moment',
  disabled: () => 'Tool is disabled — enable it before testing',
};

const CustomToolCard: React.FC<Props> = ({
  tool,
  expanded,
  isTogglePending,
  isTesting,
  flash,
  onToggle,
  onTest,
  onToggleExpanded,
  onDelete,
  onPanelClose,
  onPanelSaved,
}) => {
  const theme = useTheme();
  const lastFired = lastFiredSummary(tool);

  const flashTone = flash?.status === 'success'
    ? theme.palette.success.main
    : flash?.status === 'failed'
      ? theme.palette.error.main
      : theme.palette.warning.main;

  return (
    <CardShell
      radius="lg"
      sx={{
        opacity: tool.is_enabled ? 1 : 0.65,
        transition: 'opacity 150ms ease-out',
      }}
      head={{
        title: (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              component="span"
              sx={{
                fontFamily: MONO_FONT,
                fontWeight: 600,
                fontSize: '0.9375rem',
                letterSpacing: '-0.005em',
                color: 'text.primary',
              }}
            >
              {tool.name}
            </Typography>
            {tool.is_read_only && (
              <Chip
                label="read-only"
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            )}
            {tool.disabled_at && (
              <Tooltip title={tool.disabled_reason ?? 'auto-disabled'}>
                <Chip
                  icon={<ErrorIcon sx={{ fontSize: 12 }} />}
                  label="auto-disabled"
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Tooltip>
            )}
          </Box>
        ),
        right: (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.25,
              // On phones the title + this 4-control cluster can't share one
              // row at 360px; let the cluster wrap under the title.
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <Switch
              checked={tool.is_enabled}
              onChange={(e) => onToggle(tool.id, e.target.checked)}
              disabled={isTogglePending}
              size="small"
              inputProps={{ 'aria-label': `Enable ${tool.name}` }}
            />
            <Tooltip title={tool.is_enabled ? 'Test this tool' : 'Enable to test'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => onTest(tool)}
                  disabled={!tool.is_enabled || isTesting}
                  aria-label={`Test ${tool.name}`}
                  sx={{ color: theme.palette.text.secondary, p: { xs: 1 } }}
                >
                  {isTesting
                    ? <CircularProgress size={14} thickness={5} />
                    : <TestIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={expanded ? 'Hide settings' : 'Edit settings'}>
              <IconButton
                size="small"
                onClick={() => onToggleExpanded(tool.id)}
                aria-label={expanded ? `Collapse ${tool.name}` : `Expand ${tool.name}`}
                aria-expanded={expanded}
                sx={{ color: theme.palette.text.secondary, p: { xs: 1 } }}
              >
                {expanded
                  ? <ExpandLessIcon fontSize="small" />
                  : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete tool">
              <IconButton
                size="small"
                onClick={() => onDelete(tool)}
                aria-label={`Delete ${tool.name}`}
                sx={{ color: theme.palette.text.secondary, p: { xs: 1 } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      }}
    >
      <Box sx={{ px: 2.25, py: 1.5 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
          }}
        >
          {tool.description}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
            mt: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SuccessIcon sx={{ fontSize: 14, color: 'success.main' }} />
            <Typography variant="caption" sx={{ fontFamily: MONO_FONT, color: 'text.secondary' }}>
              {tool.success_count}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FailIcon
              sx={{
                fontSize: 14,
                color: tool.failure_count > 0 ? 'error.main' : 'text.tertiary',
              }}
            />
            <Typography variant="caption" sx={{ fontFamily: MONO_FONT, color: 'text.secondary' }}>
              {tool.failure_count}
            </Typography>
          </Box>
          {lastFired && (
            <Typography variant="caption" color="text.tertiary">
              {lastFired}
            </Typography>
          )}
          {tool.consecutive_failures > 0 && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              {tool.consecutive_failures} failure
              {tool.consecutive_failures !== 1 ? 's' : ''} in a row
            </Typography>
          )}
        </Box>

        {flash && (
          <Box
            sx={{
              mt: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              backgroundColor: `${flashTone}14`,
              border: `1px solid ${flashTone}55`,
            }}
          >
            <Typography variant="caption" sx={{ color: flashTone, fontWeight: 600 }}>
              {FLASH_COPY[flash.status](flash.error)}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Inline edit panel — slides down below the description */}
      {expanded && (
        <Box
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.action.hover,
          }}
        >
          <AnimatedDropdown>
            <CustomToolFormPanel
              existingTool={tool}
              onClose={onPanelClose}
              onSaved={onPanelSaved}
            />
          </AnimatedDropdown>
        </Box>
      )}
    </CardShell>
  );
};

export default CustomToolCard;
