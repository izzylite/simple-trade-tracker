/**
 * ThoughtProcess Component
 * Collapsible section showing the AI's intermediate thinking during tool use.
 * Displayed above the final answer in assistant messages.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Collapse,
  useTheme,
  alpha
} from '@mui/material';
import {
  Psychology as ThinkingIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material';

interface ThoughtProcessProps {
  text: string;
}

const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ text }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          backgroundColor: alpha(theme.palette.text.primary, 0.03),
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.06),
          },
          transition: 'background-color 0.15s ease',
        }}
      >
        <ThinkingIcon
          sx={{ fontSize: 14, color: 'text.secondary' }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 500, flex: 1 }}
        >
          View thinking process
        </Typography>
        <ExpandIcon
          sx={{
            fontSize: 16,
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 0.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.text.primary, 0.02),
            borderLeft: `2px solid ${alpha(
              theme.palette.text.secondary, 0.2
            )}`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              fontStyle: 'italic',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {text}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ThoughtProcess;
