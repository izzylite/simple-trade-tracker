import React, { useState } from 'react';
import { formatCount } from 'utils/formatters';
import { Box, Typography, Collapse, Tooltip, alpha, useTheme } from '@mui/material';
import {
  CheckCircle,
  WarningAmber,
  ErrorOutline as ErrorIcon,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import { ImportPreviewRow, TradeField } from '../../types/import';
import { TRADE_FIELD_METADATA } from '../../utils/importValidation';
import { format } from 'date-fns';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

const TNUM = "'tnum' on, 'lnum' on";

interface ImportPreviewProps {
  previewRows: ImportPreviewRow[];
  mappedFields: TradeField[];
  maxRows?: number;
}

/**
 * Compact preview list — one card per row.
 * Header line: status dot · row # · primary fields (date · name · amount).
 * Below: secondary chips (session, tags, etc).
 * Issues collapse beneath the row.
 *
 * Designed for narrow dialogs (≤ 560px) where a wide table would scroll
 * horizontally and lose context. Matches the import-dialog token language.
 */
export const ImportPreview: React.FC<ImportPreviewProps> = ({
  previewRows,
  mappedFields,
  maxRows = 10,
}) => {
  const theme = useTheme();
  const {
    violet,
    violetSoft,
    violetBorder,
    surfaceInset,
    hairline,
    monoSectionLabelSx,
  } = useDialogTokens();

  const [showAll, setShowAll] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const displayRows = showAll ? previewRows : previewRows.slice(0, maxRows);
  const hasMore = previewRows.length > maxRows;

  const formatCellValue = (value: any, field: TradeField): string => {
    if (value === null || value === undefined || value === '') return '—';
    const metadata = TRADE_FIELD_METADATA[field];
    switch (metadata.type) {
      case 'date':
        return value instanceof Date
          ? format(value, 'yyyy-MM-dd')
          : String(value);
      case 'number':
        return typeof value === 'number' ? value.toFixed(2) : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'array':
        if (Array.isArray(value)) {
          if (
            field === 'images' &&
            value.length > 0 &&
            typeof value[0] === 'object' &&
            'url' in value[0]
          ) {
            return `${value.length} image(s)`;
          }
          return value.join(', ');
        }
        return String(value);
      default:
        return String(value);
    }
  };

  // Pick the most "headline-worthy" fields to show inline on each row.
  // Prefer date, name/symbol, and amount/p&l — anything else cascades to chips.
  const PRIMARY_ORDER: TradeField[] = ['trade_date', 'name', 'amount'];
  const primaryFields = PRIMARY_ORDER.filter((f) => mappedFields.includes(f));
  const secondaryFields = mappedFields.filter((f) => !primaryFields.includes(f));

  return (
    <Box
      sx={{
        border: `1px solid ${hairline}`,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: surfaceInset,
      }}
    >
      {/* Section header strip */}
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
        <Typography sx={monoSectionLabelSx}>Preview</Typography>
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
          {formatCount(displayRows.length)} of {formatCount(previewRows.length)}
        </Typography>
      </Box>

      {/* Row list */}
      <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
        {displayRows.map((row, index) => {
          const hasErrors = row.errors.length > 0;
          const hasWarnings = !hasErrors && row.warnings.length > 0;
          const hasIssues = hasErrors || hasWarnings;
          const isExpanded = expandedRow === index;

          const statusIcon = hasErrors ? (
            <ErrorIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
          ) : hasWarnings ? (
            <WarningAmber sx={{ fontSize: 14, color: theme.palette.warning.main }} />
          ) : (
            <CheckCircle sx={{ fontSize: 14, color: theme.palette.success.main }} />
          );

          const accentColor = hasErrors
            ? theme.palette.error.main
            : hasWarnings
              ? theme.palette.warning.main
              : 'transparent';

          return (
            <Box
              key={row.rowIndex}
              sx={{
                borderBottom:
                  index < displayRows.length - 1 ? `1px solid ${hairline}` : 'none',
                bgcolor: hasErrors
                  ? alpha(theme.palette.error.main, 0.04)
                  : hasWarnings
                    ? alpha(theme.palette.warning.main, 0.04)
                    : 'transparent',
                borderLeft: `2px solid ${accentColor}`,
                transition: 'background-color 120ms ease',
              }}
            >
              {/* Header line — status + row# + primary fields */}
              <Box
                onClick={() => hasIssues && setExpandedRow(isExpanded ? null : index)}
                sx={{
                  px: 1.5,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  cursor: hasIssues ? 'pointer' : 'default',
                  '&:hover': hasIssues
                    ? {
                        bgcolor: alpha(theme.palette.text.primary, 0.02),
                      }
                    : undefined,
                }}
              >
                {/* Status icon */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    flexShrink: 0,
                  }}
                >
                  {statusIcon}
                </Box>

                {/* Row index */}
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontFeatureSettings: TNUM,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: alpha(theme.palette.text.secondary, 0.75),
                    minWidth: 28,
                    flexShrink: 0,
                  }}
                >
                  #{row.rowIndex + 1}
                </Typography>

                {/* Primary inline fields */}
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    minWidth: 0,
                    flexWrap: 'wrap',
                  }}
                >
                  {primaryFields.length === 0 ? (
                    <Typography
                      sx={{
                        fontFamily: MONO_FONT,
                        fontSize: '0.72rem',
                        color: alpha(theme.palette.text.secondary, 0.6),
                        fontStyle: 'italic',
                      }}
                    >
                      No primary fields mapped
                    </Typography>
                  ) : (
                    primaryFields.map((field) => {
                      const value = row.mappedData[field];
                      const formatted = formatCellValue(value, field);
                      const hasFieldError = row.errors.some((e) => e.field === field);
                      const isAmount = field === 'amount';
                      const numericValue =
                        isAmount && typeof value === 'number' ? value : null;
                      const amountColor =
                        numericValue !== null
                          ? numericValue >= 0
                            ? theme.palette.success.main
                            : theme.palette.error.main
                          : theme.palette.text.primary;

                      return (
                        <Tooltip key={field} title={formatted} placement="top">
                          <Typography
                            sx={{
                              fontFamily: MONO_FONT,
                              fontFeatureSettings: TNUM,
                              fontSize: '0.78rem',
                              fontWeight: isAmount ? 700 : 500,
                              color: hasFieldError
                                ? theme.palette.error.main
                                : isAmount
                                  ? amountColor
                                  : theme.palette.text.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 140,
                            }}
                          >
                            {isAmount && numericValue !== null && numericValue > 0
                              ? `+${formatted}`
                              : formatted}
                          </Typography>
                        </Tooltip>
                      );
                    })
                  )}
                </Box>

                {/* Expand chevron — only when row has issues */}
                {hasIssues && (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
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
                )}
              </Box>

              {/* Secondary fields — small chip strip */}
              {secondaryFields.length > 0 && (
                <Box
                  sx={{
                    px: 1.5,
                    pb: 1,
                    pl: 4.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.4,
                  }}
                >
                  {secondaryFields.slice(0, 4).map((field) => {
                    const value = row.mappedData[field];
                    if (value === null || value === undefined || value === '') return null;
                    const formatted = formatCellValue(value, field);
                    if (formatted === '—') return null;
                    return (
                      <Tooltip
                        key={field}
                        title={`${TRADE_FIELD_METADATA[field].displayName}: ${formatted}`}
                        placement="top"
                      >
                        <Box
                          sx={{
                            fontFamily: MONO_FONT,
                            fontSize: '0.64rem',
                            color: alpha(theme.palette.text.secondary, 0.85),
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            border: `1px solid ${hairline}`,
                            borderRadius: 0.75,
                            px: 0.6,
                            py: 0.2,
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatted}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}

              {/* Collapsible issue list */}
              {hasIssues && (
                <Collapse in={isExpanded} timeout="auto">
                  <Box
                    sx={{
                      px: 1.5,
                      pb: 1.25,
                      pl: 4.5,
                      borderTop: `1px solid ${hairline}`,
                      pt: 1,
                      bgcolor: alpha(theme.palette.text.primary, 0.015),
                    }}
                  >
                    {row.errors.map((error, eIdx) => (
                      <Box
                        key={`e-${eIdx}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 0.75,
                          py: 0.5,
                        }}
                      >
                        <ErrorIcon
                          sx={{
                            fontSize: 12,
                            color: theme.palette.error.main,
                            mt: '2px',
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontFamily: MONO_FONT,
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              color: theme.palette.error.main,
                              lineHeight: 1.4,
                            }}
                          >
                            {error.column}: {error.message}
                          </Typography>
                          {error.suggestedFix && (
                            <Typography
                              sx={{
                                fontFamily: MONO_FONT,
                                fontSize: '0.66rem',
                                color: alpha(theme.palette.text.secondary, 0.75),
                                mt: 0.25,
                                lineHeight: 1.4,
                              }}
                            >
                              → {error.suggestedFix}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                    {row.warnings.map((warning, wIdx) => (
                      <Box
                        key={`w-${wIdx}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 0.75,
                          py: 0.5,
                        }}
                      >
                        <WarningAmber
                          sx={{
                            fontSize: 12,
                            color: theme.palette.warning.main,
                            mt: '2px',
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          sx={{
                            fontFamily: MONO_FONT,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: theme.palette.warning.main,
                            lineHeight: 1.4,
                          }}
                        >
                          {warning.column}: {warning.message}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Show all / show less footer */}
      {hasMore && (
        <Box
          onClick={() => setShowAll((v) => !v)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            py: 1,
            borderTop: `1px solid ${hairline}`,
            cursor: 'pointer',
            bgcolor: surfaceInset,
            transition: 'background-color 120ms ease',
            '&:hover': {
              bgcolor: violetSoft,
            },
          }}
        >
          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: violet,
            }}
          >
            {showAll
              ? `Show less`
              : `Show all ${formatCount(previewRows.length)} rows`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
