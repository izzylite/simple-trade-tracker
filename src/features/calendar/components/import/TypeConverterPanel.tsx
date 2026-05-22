import React from 'react';
import { Box, Typography, Collapse, alpha, useTheme } from '@mui/material';
import {
  SwapHoriz,
  ExpandMore,
  ChevronRight,
  WarningAmber,
} from '@mui/icons-material';
import { TypeConversion } from '../../types/import';
import { TRADE_FIELD_METADATA } from '../../utils/importValidation';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { formatCount } from 'utils/formatters';

const TNUM = "'tnum' on, 'lnum' on";

interface TypeConverterPanelProps {
  conversions: TypeConversion[];
}

/**
 * Compact type-conversion list — one expandable row per conversion.
 * Header: field name · from-type → to-type · row count · optional warning chip.
 * Expanded: description + a couple of example transforms.
 * Matches the import-dialog token language (mono, hairlines, surfaceInset).
 */
export const TypeConverterPanel: React.FC<TypeConverterPanelProps> = ({
  conversions,
}) => {
  const theme = useTheme();
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const {
    violet,
    violetSoft,
    violetBorder,
    surfaceInset,
    hairline,
    monoSectionLabelSx,
  } = useDialogTokens();

  if (conversions.length === 0) return null;

  return (
    <Box
      sx={{
        border: `1px solid ${hairline}`,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: surfaceInset,
      }}
    >
      {/* Header strip */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <SwapHoriz sx={{ fontSize: 14, color: violet }} />
          <Typography sx={monoSectionLabelSx}>Type conversions</Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontFeatureSettings: TNUM,
            fontSize: '0.66rem',
            color: alpha(theme.palette.text.secondary, 0.8),
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {conversions.length}
        </Typography>
      </Box>

      {/* Conversion rows */}
      <Box>
        {conversions.map((conversion, index) => {
          const isExpanded = expandedIndex === index;
          const metadata = TRADE_FIELD_METADATA[conversion.field];

          return (
            <Box
              key={index}
              sx={{
                borderBottom:
                  index < conversions.length - 1 ? `1px solid ${hairline}` : 'none',
              }}
            >
              {/* Header row */}
              <Box
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                sx={{
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.text.primary, 0.02),
                  },
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: alpha(theme.palette.text.secondary, 0.6),
                    flexShrink: 0,
                  }}
                >
                  {isExpanded ? (
                    <ExpandMore sx={{ fontSize: 16 }} />
                  ) : (
                    <ChevronRight sx={{ fontSize: 16 }} />
                  )}
                </Box>

                {/* Field name */}
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {metadata.displayName}
                </Typography>

                {/* Type transform: fromType → toType */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.66rem',
                      color: alpha(theme.palette.text.secondary, 0.85),
                      bgcolor: surfaceInset,
                      border: `1px solid ${hairline}`,
                      borderRadius: 0.75,
                      px: 0.6,
                      py: 0.15,
                    }}
                  >
                    {conversion.fromType}
                  </Box>
                  <SwapHoriz
                    sx={{ fontSize: 12, color: violet, flexShrink: 0 }}
                  />
                  <Box
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.66rem',
                      color: violet,
                      bgcolor: violetSoft,
                      border: `1px solid ${violetBorder}`,
                      borderRadius: 0.75,
                      px: 0.6,
                      py: 0.15,
                    }}
                  >
                    {conversion.toType}
                  </Box>
                </Box>

                {/* Row count + optional warning */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {conversion.warnings > 0 && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        fontFamily: MONO_FONT,
                        fontFeatureSettings: TNUM,
                        fontSize: '0.64rem',
                        fontWeight: 600,
                        color: theme.palette.warning.main,
                      }}
                    >
                      <WarningAmber sx={{ fontSize: 11 }} />
                      {conversion.warnings}
                    </Box>
                  )}
                  <Typography
                    sx={{
                      fontFamily: MONO_FONT,
                      fontFeatureSettings: TNUM,
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: alpha(theme.palette.text.secondary, 0.75),
                    }}
                  >
                    {formatCount(conversion.affectedRows)} rows
                  </Typography>
                </Box>
              </Box>

              {/* Expanded detail */}
              <Collapse in={isExpanded} timeout="auto">
                <Box
                  sx={{
                    px: 1.5,
                    pb: 1.25,
                    pl: 4,
                    pt: 0.5,
                    borderTop: `1px solid ${hairline}`,
                    bgcolor: alpha(theme.palette.text.primary, 0.015),
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.72rem',
                      color: alpha(theme.palette.text.secondary, 0.8),
                      lineHeight: 1.5,
                      mt: 0.75,
                      mb: conversion.examples.length > 0 ? 1 : 0,
                    }}
                  >
                    {metadata.description}
                  </Typography>

                  {conversion.examples.length > 0 && (
                    <Box>
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: alpha(theme.palette.text.secondary, 0.7),
                          mb: 0.5,
                        }}
                      >
                        Examples
                      </Typography>
                      {conversion.examples.slice(0, 3).map((ex, exIdx) => {
                        const original = String(ex.original);
                        const converted =
                          typeof ex.converted === 'object'
                            ? JSON.stringify(ex.converted)
                            : String(ex.converted);
                        return (
                          <Box
                            key={exIdx}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              mb: 0.4,
                            }}
                          >
                            <Box
                              sx={{
                                fontFamily: MONO_FONT,
                                fontSize: '0.7rem',
                                color: alpha(theme.palette.text.primary, 0.65),
                                bgcolor: alpha(theme.palette.text.primary, 0.04),
                                border: `1px solid ${hairline}`,
                                borderRadius: 0.5,
                                px: 0.6,
                                py: 0.2,
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {original}
                            </Box>
                            <SwapHoriz
                              sx={{ fontSize: 11, color: violet, flexShrink: 0 }}
                            />
                            <Box
                              sx={{
                                fontFamily: MONO_FONT,
                                fontSize: '0.7rem',
                                color: theme.palette.success.main,
                                bgcolor: alpha(theme.palette.success.main, 0.08),
                                border: `1px solid ${alpha(theme.palette.success.main, 0.28)}`,
                                borderRadius: 0.5,
                                px: 0.6,
                                py: 0.2,
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {converted}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
