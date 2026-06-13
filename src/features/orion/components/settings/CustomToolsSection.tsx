import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  ExtensionOutlined as ExtensionIcon,
} from '@mui/icons-material';
import CardShell from 'components/common/CardShell';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import { AnimatedDropdown } from 'features/calendar/components/Animations';
import {
  deleteTool,
  listTools,
  setToolEnabled,
  testTool,
} from 'features/orion/services/customToolsService';
import type {
  CustomToolListEntry,
  TestToolResult,
} from 'features/orion/types/customTool';
import { TOOL_CAP_PER_USER } from 'features/orion/types/customTool';
import CustomToolCard from './CustomToolCard';
import CustomToolFormPanel from './CustomToolFormPanel';

/** Sentinel for the "new tool" inline placeholder. Real tool ids are
 *  UUIDs so this can never collide. */
const NEW_TOOL_KEY = '__new__';

/**
 * Module-level cache of the most recent listTools() response. Survives
 * unmount/remount of the settings dialog so reopening it shows the list
 * INSTANTLY from cache while we re-fetch in the background to catch
 * server-side changes (auto-disable, counter bumps from Orion firing the
 * tools mid-session). First-ever open still shows the spinner.
 *
 * Single-user surface so a plain module-level let is enough — no need
 * for a context or query cache here.
 */
let toolsCache: CustomToolListEntry[] | null = null;

const CustomToolsSection: React.FC = () => {
  const theme = useTheme();
  const [tools, setTools] = useState<CustomToolListEntry[]>(toolsCache ?? []);
  // Only show the spinner if we have NOTHING to render. With a cache the
  // background re-fetch happens behind the already-rendered list.
  const [loading, setLoading] = useState(toolsCache === null);
  const [error, setError] = useState<string | null>(null);
  /** id of the currently-expanded tool, or NEW_TOOL_KEY for the create
   *  placeholder, or null when nothing is expanded. Single-expand keeps
   *  the wizard's step rail from getting confused across cards. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<CustomToolListEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testFlash, setTestFlash] = useState<Map<string, TestToolResult>>(new Map());

  const refresh = useCallback(async () => {
    // Spinner only when we have no cached data to fall back on. Background
    // refreshes (cache hit on mount) re-fetch silently.
    if (toolsCache === null) setLoading(true);
    setError(null);
    try {
      const list = await listTools();
      toolsCache = list;
      setTools(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mirror local mutations (toggle / test / delete) into the module-level
  // cache so a quick close+reopen doesn't briefly render the stale list
  // before the background re-fetch resolves. We only mirror after the
  // cache has been seeded by the first refresh — before that, an empty
  // `tools` would clobber the null sentinel and skip the first-ever spinner.
  useEffect(() => {
    if (toolsCache !== null) toolsCache = tools;
  }, [tools]);

  const handleToggle = async (id: string, enabled: boolean) => {
    if (pendingToggleIds.has(id)) return;
    setPendingToggleIds((prev) => new Set(prev).add(id));
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_enabled: enabled } : t)),
    );
    try {
      await setToolEnabled(id, enabled);
    } catch (err) {
      setError((err as Error).message);
      refresh();
    } finally {
      setPendingToggleIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleTest = async (tool: CustomToolListEntry) => {
    if (testingIds.has(tool.id)) return;
    setTestingIds((prev) => new Set(prev).add(tool.id));
    setError(null);
    try {
      const result = await testTool(tool.id);
      setTools((prev) =>
        prev.map((t) =>
          t.id === tool.id
            ? {
              ...t,
              success_count: result.success_count,
              failure_count: result.failure_count,
              last_success_at: result.last_success_at,
              last_failure_at: result.last_failure_at,
              is_enabled: result.is_enabled,
            }
            : t,
        ),
      );
      setTestFlash((prev) => new Map(prev).set(tool.id, result));
      // Auto-clear the flash after 6s so the card returns to its
      // normal state. Re-firing overwrites the flash entry.
      setTimeout(() => {
        setTestFlash((prev) => {
          const next = new Map(prev);
          next.delete(tool.id);
          return next;
        });
      }, 6000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  const confirmDeleteTool = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTool(pendingDelete.id);
      setTools((prev) => prev.filter((t) => t.id !== pendingDelete.id));
      if (expandedId === pendingDelete.id) setExpandedId(null);
      setPendingDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePanelSaved = () => {
    setExpandedId(null);
    refresh();
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const showCreatePlaceholder = expandedId === NEW_TOOL_KEY;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1.5,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '1rem',
              letterSpacing: '-0.015em',
              color: 'text.primary',
              lineHeight: 1.3,
            }}
          >
            Custom tools
          </Typography>
          <Typography variant="caption" color="text.tertiary" sx={{ mt: 0.25 }}>
            Wire your webhooks into Orion. {tools.length} of {TOOL_CAP_PER_USER} used.
          </Typography>
        </Box>
        <Button
          // Swap variant + icon when the create panel is open so the
          // wizard's contained Next button (inside the panel) becomes
          // the visually dominant action. Outlined neutral here = "don't
          // look at me, look at Next".
          variant={showCreatePlaceholder ? 'outlined' : 'contained'}
          color={showCreatePlaceholder ? 'inherit' : 'primary'}
          size="small"
          startIcon={showCreatePlaceholder ? <CloseIcon /> : <AddIcon />}
          onClick={() => setExpandedId(showCreatePlaceholder ? null : NEW_TOOL_KEY)}
          disabled={tools.length >= TOOL_CAP_PER_USER && !showCreatePlaceholder}
          sx={
            showCreatePlaceholder
              ? {
                color: 'text.secondary',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'text.primary',
                  backgroundColor: 'action.hover',
                },
              }
              : undefined
          }
        >
          {showCreatePlaceholder ? 'Cancel' : 'Add tool'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={1.25}>
        {showCreatePlaceholder && (
          <CardShell
            radius="lg"
            sx={{ borderStyle: 'dashed' }}
            head={{
              title: (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ExtensionIcon
                    sx={{ fontSize: 18, color: theme.palette.text.secondary }}
                  />
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: 'text.primary',
                    }}
                  >
                    New custom tool
                  </Typography>
                </Box>
              ),
            }}
          >
            <AnimatedDropdown>
              <CustomToolFormPanel
                existingTool={null}
                onClose={() => setExpandedId(null)}
                onSaved={handlePanelSaved}
              />
            </AnimatedDropdown>
          </CardShell>
        )}

        {tools.length === 0 && !showCreatePlaceholder ? (
          <CardShell
            radius="lg"
            sx={{ borderStyle: 'dashed', backgroundColor: 'transparent' }}
          >
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No custom tools yet. Add one to let Orion call your webhook for
                proprietary signals, screeners, or broker data.
              </Typography>
            </Box>
          </CardShell>
        ) : (
          tools.map((tool) => (
            <CustomToolCard
              key={tool.id}
              tool={tool}
              expanded={expandedId === tool.id}
              isTogglePending={pendingToggleIds.has(tool.id)}
              isTesting={testingIds.has(tool.id)}
              flash={testFlash.get(tool.id)}
              onToggle={handleToggle}
              onTest={handleTest}
              onToggleExpanded={toggleExpanded}
              onDelete={setPendingDelete}
              onPanelClose={() => setExpandedId(null)}
              onPanelSaved={handlePanelSaved}
            />
          ))
        )}
      </Stack>

      <ConfirmationDialog
        open={pendingDelete !== null}
        title="Delete custom tool?"
        message={
          <Typography
            sx={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'text.primary' }}
          >
            This will permanently remove{' '}
            <Box component="span" sx={{ fontWeight: 600 }}>
              {pendingDelete?.name}
            </Box>{' '}
            from Orion's catalog and revoke its webhook secret. This cannot be
            undone.
          </Typography>
        }
        confirmText="Delete"
        confirmColor="error"
        isSubmitting={deleting}
        onConfirm={confirmDeleteTool}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  );
};

export default CustomToolsSection;
