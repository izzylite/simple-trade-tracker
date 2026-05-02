/**
 * MemoryLogsPanel
 *
 * Two-tab panel: "Audit Log" shows memory_audit rows (destructive ops Orion
 * performed on its memory); "Memory" shows the live AGENT_MEMORY note content
 * in read-only mode so the user can see what Orion currently knows about them.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Chip,
  Collapse,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EconomicEventShimmer from '../economicCalendar/EconomicEventShimmer';
import { getMemoryAudit, getMemoryNote, type MemoryAuditRow } from '../../services/memoryAuditService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';

interface MemoryLogsPanelProps {
  calendarId: string | undefined;
}

function formatAgo(isoTime: string): string {
  const ms = Date.now() - new Date(isoTime).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const OP_COLORS: Record<MemoryAuditRow['op'], 'warning' | 'error' | 'default' | 'primary'> = {
  UPDATE: 'warning',
  REMOVE: 'error',
  COMPACT: 'default',
  REPLACE_SECTION: 'primary',
};

const MemoryLogsPanel: React.FC<MemoryLogsPanelProps> = ({ calendarId }) => {
  const theme = useTheme();
  const [tab, setTab] = useState<0 | 1>(0);

  // Audit Log tab state
  const [auditRows, setAuditRows] = useState<MemoryAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Memory tab state
  const [memoryContent, setMemoryContent] = useState<string | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const loadAudit = useCallback(async () => {
    if (!calendarId) return;
    setAuditLoading(true);
    try {
      const rows = await getMemoryAudit(calendarId);
      setAuditRows(rows);
    } catch (err) {
      logger.error('Failed to load memory audit:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [calendarId]);

  const loadMemory = useCallback(async () => {
    if (!calendarId) return;
    setMemoryLoading(true);
    try {
      const content = await getMemoryNote(calendarId);
      setMemoryContent(content);
    } catch (err) {
      logger.error('Failed to load memory note:', err);
    } finally {
      setMemoryLoading(false);
    }
  }, [calendarId]);

  // Fetch on mount and when calendarId changes.
  useEffect(() => { void loadAudit(); }, [loadAudit]);
  useEffect(() => { void loadMemory(); }, [loadMemory]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as 0 | 1)}
        variant="fullWidth"
        sx={{ borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}
      >
        <Tab label="Audit Log" icon={<HistoryEduIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
        <Tab label="Memory" icon={<PsychologyIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 44, fontSize: '0.8rem' }} />
      </Tabs>

      {/* Audit Log tab */}
      {tab === 0 && (
        <Box sx={{ flex: 1, overflow: 'auto', ...scrollbarStyles(theme) }}>
          {auditLoading ? (
            <EconomicEventShimmer count={10} />
          ) : auditRows.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4, gap: 1.5, textAlign: 'center' }}>
              <HistoryEduIcon sx={{ fontSize: 40, color: alpha(theme.palette.text.secondary, 0.4) }} />
              <Typography variant="subtitle2" color="text.secondary">No memory changes recorded yet.</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 260 }}>
                This log tracks when Orion updates or removes bullets from its memory about you.
              </Typography>
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {auditRows.map(row => (
                <Box
                  key={row.id}
                  onClick={() => toggleExpand(row.id)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.1) },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={row.op}
                      size="small"
                      color={OP_COLORS[row.op]}
                      sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                      {row.section}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {formatAgo(row.created_at)}
                    </Typography>
                  </Box>

                  <Collapse in={expandedIds.has(row.id)}>
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {row.before_text == null && row.after_text == null ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          Low-score bullets trimmed to stay within size limit.
                        </Typography>
                      ) : (
                        <>
                          {row.before_text != null && (
                            <Box>
                              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Before</Typography>
                              <Box sx={{ mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {row.before_text}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {row.after_text != null && (
                            <Box>
                              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>After</Typography>
                              <Box sx={{ mt: 0.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.success.main, 0.08), border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {row.after_text}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Memory tab */}
      {tab === 1 && (
        <Box sx={{ flex: 1, overflow: 'auto', ...scrollbarStyles(theme) }}>
          {memoryLoading ? (
            <EconomicEventShimmer count={10} />
          ) : memoryContent == null ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4, gap: 1.5, textAlign: 'center' }}>
              <PsychologyIcon sx={{ fontSize: 40, color: alpha(theme.palette.text.secondary, 0.4) }} />
              <Typography variant="subtitle2" color="text.secondary">No memory profile yet.</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 280 }}>
                Orion hasn't built a memory profile yet — start chatting to let it learn your patterns.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'text.primary',
                  lineHeight: 1.7,
                  m: 0,
                }}
              >
                {memoryContent}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MemoryLogsPanel;
