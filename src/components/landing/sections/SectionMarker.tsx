import React from 'react';
import { Box, Typography } from '@mui/material';
import { ACCENT, HAIR, TNUM } from '../landingTokens';

interface Props {
    label: string;
}

/* Centered pill that straddles the section's top divider line.
   Background matches page bg (#080808) so the hair-line appears to break
   around the marker. Sits on top of the borderTop via translate(-50%) on
   the y-axis. Parent must have `position: relative`. */
const SectionMarker: React.FC<Props> = ({ label }) => (
    <Box
        aria-hidden
        sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: '#080808',
            border: HAIR,
            borderRadius: '999px',
            px: 2.25,
            py: 0.6,
            zIndex: 1,
            // Tiny inner rule so the pill reads as a labeled marker, not an
            // orphaned chip floating on the line.
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.85,
            '&::before': {
                content: '""',
                width: 5,
                height: 5,
                borderRadius: '2px',
                bgcolor: ACCENT,
            },
        }}
    >
        <Typography
            component="span"
            sx={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontFeatureSettings: TNUM,
                fontSize: '0.66rem',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1,
            }}
        >
            {label}
        </Typography>
    </Box>
);

export default SectionMarker;
