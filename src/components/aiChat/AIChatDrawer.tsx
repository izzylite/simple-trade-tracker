/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis.
 * Manages backdrop, positioning, animation, and close button.
 * Delegates all chat content to AIChatContent.
 */

import React, { useState, useEffect } from 'react';
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
import { format } from 'date-fns';
import { v5 as uuidv5 } from 'uuid';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import AIChatContent from '../sidePanel/content/AIChatContent';
import { UseAIChatReturn } from '../../hooks/useAIChat';
import RoundedTabs, { TabPanel } from '../common/RoundedTabs';
import OrionTasksContent from '../orionTasks/OrionTasksContent';
import type { OrionTask, OrionTaskResult, TaskType, TaskConfig } from '../../types/orionTask';
import { TASK_TYPE_LABELS } from '../../types/orionTask';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { createNote } from '../../services/notesService';

const ORION_NOTE_NS = 'a7f3d5e2-1b4c-5890-9e12-f3c4d5b6a7e8';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;
  tradeOperations: TradeOperationsProps;
  /** When provided, shares chat state with the panel version */
  sharedChatState?: UseAIChatReturn;
  /** Calendar picker props (Home page) */
  availableCalendars?: Calendar[];
  selectedCalendarId?: string;
  onCalendarChange?: (calendarId: string) => void;
  /** Orion Tasks props */
  tasks?: OrionTask[];
  taskResults?: OrionTaskResult[];
  taskUnreadCount?: number;
  tasksLoading?: boolean;
  onCreateTask?: (taskType: TaskType, config: TaskConfig) => Promise<OrionTask | undefined>;
  onUpdateTask?: (taskId: string, updates: { config?: TaskConfig }) => Promise<OrionTask | undefined>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onMarkTaskResultRead?: (resultId: string) => Promise<void>;
  onMarkAllTaskResultsRead?: () => Promise<void>;
  onHideTaskResult?: (resultId: string) => Promise<void>;
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
  tradeOperations,
  sharedChatState,
  availableCalendars,
  selectedCalendarId,
  onCalendarChange,
  tasks,
  taskResults,
  taskUnreadCount,
  tasksLoading,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMarkTaskResultRead,
  onMarkAllTaskResultsRead,
  onHideTaskResult,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [chatSeedMessage, setChatSeedMessage] = useState<string>('');

  const handleSaveNote = async (result: OrionTaskResult) => {
    if (!user?.uid) return;
    const taskLabel = TASK_TYPE_LABELS[result.task_type];
    const formattedDate = format(new Date(result.created_at), 'MMM d, yyyy');
    await createNote({
      id: uuidv5(result.id, ORION_NOTE_NS),
      user_id: user.uid,
      calendar_id: calendar?.id ?? null,
      title: `Orion Briefing: ${taskLabel} — ${formattedDate}`,
      content: result.content_plain, 
      by_assistant: true,
      tags: ['orion', 'briefing'],
    });
  };

  const handleFollowupAboutResult = (result: OrionTaskResult) => {
    const title = (result.metadata as { title?: string } | null)?.title ?? 'this briefing';
    const seed = `I'd like to follow up on "${title}":\n\n${result.content_plain}\n\nMy question: `;
    setChatSeedMessage(seed);
    setActiveTab(0);
  };

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
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
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

          {/* Tabs */}
          <Box sx={{ px: 2, pt: 1, flexShrink: 0 }}>
            <RoundedTabs
              tabs={[
                { label: 'Chat' },
                { label: 'Tasks' },
              ]}
              activeTab={activeTab}
              onTabChange={(_e, v) => setActiveTab(v)}
              size="small"
              fullWidth
            />
          </Box>

          {/* Tab content */}
          <Box sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            '& [role="tabpanel"]:not([hidden])': {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
            '& [role="tabpanel"]:not([hidden]) > .MuiBox-root': {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          }}>
            <TabPanel value={activeTab} index={0}>
              <AIChatContent
                trades={trades}
                calendar={calendar}
                isReadOnly={isReadOnly}
                tradeOperations={tradeOperations}
                isActive={open && activeTab === 0}
                sharedChatState={sharedChatState}
                availableCalendars={availableCalendars}
                selectedCalendarId={selectedCalendarId}
                onCalendarChange={onCalendarChange}
                seedMessage={chatSeedMessage}
                onSeedMessageConsumed={() => setChatSeedMessage('')}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <OrionTasksContent
                tasks={tasks ?? []}
                results={taskResults ?? []}
                unreadCount={taskUnreadCount ?? 0}
                loading={tasksLoading ?? false}
                onCreateTask={onCreateTask ?? (async () => undefined)}
                onUpdateTask={onUpdateTask}
                onDeleteTask={onDeleteTask ?? (async () => {})}
                onMarkRead={onMarkTaskResultRead ?? (async () => {})}
                onMarkAllRead={onMarkAllTaskResultsRead}
                onHideResult={onHideTaskResult}
                onFollowup={handleFollowupAboutResult}
                onSaveNote={handleSaveNote}
              />
            </TabPanel>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default AIChatDrawer;
