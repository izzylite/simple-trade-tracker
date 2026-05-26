// Read-only transparency view of Orion's built-in tools.
//
// Why this exists: traders who wire in custom webhooks see exactly what
// Orion can do natively, in trader-friendly language (not the Gemini
// schema descriptions). No actions — display only. The source of truth
// lives in `supabase/functions/ai-trading-agent/tools.ts` (registry) +
// the Supabase MCP server (execute_sql). The list below mirrors them at
// the user-facing level; if a tool is added or renamed there, update
// this catalog too (low-frequency change; one entry per ship).

import React from 'react';
import { Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import {
  StorageOutlined as DataIcon,
  TrendingUpOutlined as MarketIcon,
  PsychologyOutlined as MemoryIcon,
  EditNoteOutlined as NotesIcon,
  AlarmOutlined as RemindersIcon,
} from '@mui/icons-material';
import CardShell from 'components/common/CardShell';
import { MONO_FONT } from 'styles/designTokens';

type ToolCategory = 'market' | 'data' | 'memory' | 'notes' | 'reminders';

interface SystemTool {
  name: string;
  category: ToolCategory;
  description: string;
}

/** Trader-friendly description of every built-in tool. Categories group
 *  for scanability; ordering within a category is registry order. */
const SYSTEM_TOOLS: SystemTool[] = [
  // Market data
  {
    name: 'search_web',
    category: 'market',
    description:
      'Searches the web for market news, analysis, and current events. Used when you ask about today\'s headlines, a specific company, or anything Orion needs fresh info on.',
  },
  {
    name: 'scrape_url',
    category: 'market',
    description:
      'Fetches and reads a specific webpage you reference. Used when you paste a link or ask Orion to read an article.',
  },
  {
    name: 'get_market_data',
    category: 'market',
    description:
      'Pulls real-time and historical prices for instruments (FX pairs, indices, commodities, crypto). Used for "what\'s the current price of X" or "show me the last week of EURUSD".',
  },
  {
    name: 'generate_chart',
    category: 'market',
    description:
      'Builds a chart image (line, candle, P&L curve) from price or trade data. Used when a visualization helps answer your question.',
  },

  // Trading data
  {
    name: 'execute_sql',
    category: 'data',
    description:
      'Queries your trades, calendars, notes, and the economic-events database. Read-only; scoped to your data. Used for any "how did I do last week / show my biggest wins / which sessions am I best in" type question.',
  },
  {
    name: 'analyze_image',
    category: 'data',
    description:
      'Looks at a trade screenshot or chart image stored in your journal and describes what\'s in it. Used when you ask about a specific trade\'s setup.',
  },
  {
    name: 'get_recent_orion_briefings',
    category: 'data',
    description:
      'Retrieves daily / weekly / monthly briefings Orion has previously sent you. Used when you reference "your briefing" or "the alert from earlier".',
  },

  // Memory
  {
    name: 'update_memory',
    category: 'memory',
    description:
      "Updates Orion's notes about your trading style, rules, and preferences. Used when you teach Orion something durable ('I never trade Mondays').",
  },
  {
    name: 'apply_rule_change',
    category: 'memory',
    description:
      'Atomically logs a rule change AND updates memory in one step. Used when you change a trading rule mid-conversation.',
  },
  {
    name: 'manage_event',
    category: 'memory',
    description:
      'Append-only event log — records corrections, decisions, pattern discoveries, and recalls them later. Used for "have we discussed X / when did we decide Y".',
  },
  {
    name: 'recall_conversations',
    category: 'memory',
    description:
      'Semantic search over past chat conversations. Used when you reference "what did we say about X last week" — finds the exact prior exchange.',
  },

  // Notes & tags
  {
    name: 'manage_note',
    category: 'notes',
    description:
      'Creates, edits, finds, or deletes notes in your journal. Used when you tell Orion to write a note or look up an existing one.',
  },
  {
    name: 'manage_tag',
    category: 'notes',
    description:
      'Renames or recolors tags across all your trades in bulk. Used when you tidy up your tag taxonomy.',
  },

  // Reminders
  {
    name: 'manage_reminder',
    category: 'reminders',
    description:
      'Sets, lists, cancels, or edits future Orion check-ins. Used when you ask Orion to remind you about something — a single fire or a recurring loop.',
  },
];

const CATEGORY_META: Record<
  ToolCategory,
  { label: string; icon: React.ReactNode }
> = {
  market: { label: 'Market data', icon: <MarketIcon sx={{ fontSize: 16 }} /> },
  data: { label: 'Your trading data', icon: <DataIcon sx={{ fontSize: 16 }} /> },
  memory: { label: 'Memory', icon: <MemoryIcon sx={{ fontSize: 16 }} /> },
  notes: { label: 'Notes & tags', icon: <NotesIcon sx={{ fontSize: 16 }} /> },
  reminders: { label: 'Reminders', icon: <RemindersIcon sx={{ fontSize: 16 }} /> },
};

const SystemToolsSection: React.FC = () => {
  const theme = useTheme();

  // Group tools by category preserving SYSTEM_TOOLS order.
  const grouped = (Object.keys(CATEGORY_META) as ToolCategory[]).map((cat) => ({
    category: cat,
    tools: SYSTEM_TOOLS.filter((t) => t.category === cat),
  }));

  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '1rem',
            letterSpacing: '-0.015em',
            color: 'text.primary',
            lineHeight: 1.3,
          }}
        >
          System tools
        </Typography>
        <Typography variant="caption" color="text.tertiary" sx={{ mt: 0.25 }}>
          Orion's built-in capabilities. Always available, no setup required.
          Shown here so you know what Orion can do natively.
        </Typography>
      </Box>

      <Stack spacing={1.5}>
        {grouped.map(({ category, tools }) => (
          <Box key={category}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 0.75,
                color: 'text.secondary',
              }}
            >
              {CATEGORY_META[category].icon}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.7rem',
                }}
              >
                {CATEGORY_META[category].label}
              </Typography>
            </Box>
            <Stack spacing={0.75}>
              {tools.map((tool) => (
                <CardShell key={tool.name} radius="lg" sx={{ p: 0 }}>
                  <Box sx={{ px: 2.25, py: 1.25 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontFamily: MONO_FONT,
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          letterSpacing: '-0.005em',
                          color: 'text.primary',
                        }}
                      >
                        {tool.name}
                      </Typography>
                      <Chip
                        label="built-in"
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          color: theme.palette.text.tertiary,
                          borderColor: theme.palette.divider,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.5, fontSize: '0.825rem' }}
                    >
                      {tool.description}
                    </Typography>
                  </Box>
                </CardShell>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default SystemToolsSection;
