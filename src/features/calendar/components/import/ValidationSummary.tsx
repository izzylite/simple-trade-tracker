import React from 'react';
import { formatCount } from 'utils/formatters';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { ValidationSummary as ValidationSummaryType } from '../../types/import';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

interface ValidationSummaryProps {
  summary: ValidationSummaryType;
}

const TNUM = "'tnum' on, 'lnum' on";

/**
 * Compact validation summary — four stat tiles (Valid · Warnings · Errors · Will import)
 * with a thin progress strip below. Matches the import-dialog style language:
 * mono numerals, hairline borders, surfaceInset bg, no Card/List chrome.
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ summary }) => {
  const theme = useTheme();
  const {
    violet,
    violetSoft,
    violetBorder,
    surfaceInset,
    hairline,
  } = useDialogTokens();

  const { totalRows, validRows, rowsWithWarnings, rowsWithErrors, willImport } = summary;
  const validPct = totalRows > 0 ? (validRows / totalRows) * 100 : 0;

  const tiles: Array<{
    label: string;
    value: number;
    color: string;
    bg: string;
    border: string;
    emphasis?: boolean;
  }> = [
    {
      label: 'Valid',
      value: validRows,
      color: theme.palette.success.main,
      bg: alpha(theme.palette.success.main, 0.08),
      border: alpha(theme.palette.success.main, 0.28),
    },
    {
      label: 'Warnings',
      value: rowsWithWarnings,
      color:
        rowsWithWarnings > 0
          ? theme.palette.warning.main
          : alpha(theme.palette.text.secondary, 0.55),
      bg:
        rowsWithWarnings > 0
          ? alpha(theme.palette.warning.main, 0.08)
          : surfaceInset,
      border:
        rowsWithWarnings > 0
          ? alpha(theme.palette.warning.main, 0.28)
          : hairline,
    },
    {
      label: 'Errors',
      value: rowsWithErrors,
      color:
        rowsWithErrors > 0
          ? theme.palette.error.main
          : alpha(theme.palette.text.secondary, 0.55),
      bg:
        rowsWithErrors > 0
          ? alpha(theme.palette.error.main, 0.08)
          : surfaceInset,
      border:
        rowsWithErrors > 0
          ? alpha(theme.palette.error.main, 0.28)
          : hairline,
    },
    {
      label: 'Will import',
      value: willImport,
      color: violet,
      bg: violetSoft,
      border: violetBorder,
      emphasis: true,
    },
  ];

  return (
    <Box
      sx={{
        border: `1px solid ${hairline}`,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: surfaceInset,
      }}
    >
      {/* Stat tile row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
        }}
      >
        {tiles.map((t, i) => (
          <Box
            key={t.label}
            sx={{
              px: 1.25,
              py: 1.25,
              borderRight: i < tiles.length - 1 ? `1px solid ${hairline}` : 'none',
              backgroundColor: t.bg,
              borderTop: `2px solid ${t.border}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontFeatureSettings: TNUM,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: t.color,
                lineHeight: 1.1,
              }}
            >
              {formatCount(t.value)}
            </Typography>
            <Typography
              sx={{
                mt: 0.25,
                fontFamily: MONO_FONT,
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: t.emphasis ? violet : alpha(theme.palette.text.secondary, 0.7),
              }}
            >
              {t.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Progress strip — thin bar showing valid % */}
      <Box
        sx={{
          height: 3,
          borderTop: `1px solid ${hairline}`,
          bgcolor: alpha(theme.palette.error.main, 0.12),
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            right: 'auto',
            width: `${validPct}%`,
            bgcolor:
              validPct >= 80
                ? theme.palette.success.main
                : validPct >= 50
                  ? theme.palette.warning.main
                  : theme.palette.error.main,
            transition: 'width 240ms cubic-bezier(.2,.7,.2,1)',
          }}
        />
      </Box>

      {/* Footer caption */}
      <Box
        sx={{
          px: 1.5,
          py: 0.85,
          borderTop: `1px solid ${hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontFeatureSettings: TNUM,
            fontSize: '0.68rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: alpha(theme.palette.text.secondary, 0.85),
          }}
        >
          {formatCount(validRows)} / {formatCount(totalRows)} rows valid
        </Typography>
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontFeatureSettings: TNUM,
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: validPct >= 80 ? theme.palette.success.main : theme.palette.warning.main,
          }}
        >
          {validPct.toFixed(0)}%
        </Typography>
      </Box>
    </Box>
  );
};
