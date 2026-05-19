import React, { useState } from 'react';
import { formatCount } from 'utils/formatters';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  Button,
  Collapse,
  useTheme
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
  TableChartOutlined
} from '@mui/icons-material';
import { ImportPreviewRow, TradeField } from '../../types/import';
import { TRADE_FIELD_METADATA } from '../../utils/importValidation';
import { format } from 'date-fns';
import { EYEBROW_SX, TNUM } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';

interface ImportPreviewProps {
  previewRows: ImportPreviewRow[];
  mappedFields: TradeField[];
  maxRows?: number;
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({
  previewRows,
  mappedFields,
  maxRows = 10
}) => {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const displayRows = showAll ? previewRows : previewRows.slice(0, maxRows);
  const hasMore = previewRows.length > maxRows;

  const handleToggleRow = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  const formatCellValue = (value: any, field: TradeField): string => {
    if (value === null || value === undefined) return '-';

    const metadata = TRADE_FIELD_METADATA[field];

    switch (metadata.type) {
      case 'date':
        return value instanceof Date ? format(value, 'MM/dd/yyyy') : String(value);

      case 'number':
        return typeof value === 'number' ? value.toFixed(2) : String(value);

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'array':
        if (Array.isArray(value)) {
          // Special handling for images field - show URLs from TradeImageEntity
          if (field === 'images' && value.length > 0 && typeof value[0] === 'object' && 'url' in value[0]) {
            return value.map(img => img.url).join(', ');
          }
          return value.join(', ');
        }
        return String(value);

      default:
        return String(value);
    }
  };

  const getRowIcon = (row: ImportPreviewRow) => {
    if (row.errors.length > 0) {
      return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />;
    }
    if (row.warnings.length > 0) {
      return <Warning sx={{ fontSize: 20, color: 'warning.main' }} />;
    }
    return <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />;
  };

  const getRowColor = (row: ImportPreviewRow) => {
    if (row.errors.length > 0) {
      return alpha(theme.palette.error.main, 0.05);
    }
    if (row.warnings.length > 0) {
      return alpha(theme.palette.warning.main, 0.05);
    }
    return 'transparent';
  };

  return (
    <CardShell
      radius="lg"
      head={{
        icon: <TableChartOutlined sx={{ fontSize: 16 }} />,
        title: 'Data preview',
        eyebrow: `Showing ${formatCount(displayRows.length)} of ${formatCount(previewRows.length)} rows`,
      }}
      innerSx={{ p: 0 }}
    >
      <TableContainer
        sx={{
          maxHeight: 500,
          overflow: 'auto',
          // Custom scrollbar styling to match app
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: alpha(theme.palette.text.primary, 0.05),
            borderRadius: `${theme.palette.custom.radius.sm}px`
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.2),
            borderRadius: `${theme.palette.custom.radius.sm}px`,
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.3)
            }
          }
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40, bgcolor: 'background.paper' }}>
                <Typography sx={EYEBROW_SX}>Status</Typography>
              </TableCell>
              <TableCell sx={{ width: 60, bgcolor: 'background.paper' }}>
                <Typography sx={EYEBROW_SX}>Row</Typography>
              </TableCell>
              {mappedFields.map(field => (
                <TableCell key={field} sx={{ bgcolor: 'background.paper', minWidth: 120 }}>
                  <Typography sx={EYEBROW_SX}>
                    {TRADE_FIELD_METADATA[field].displayName}
                  </Typography>

                </TableCell>
              ))}
              <TableCell sx={{ width: 40, bgcolor: 'background.paper' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {displayRows.map((row, index) => {
              const isExpanded = expandedRow === index;
              const hasIssues = row.errors.length > 0 || row.warnings.length > 0;

              return (
                <React.Fragment key={row.rowIndex}>
                  <TableRow
                    sx={{
                      bgcolor: getRowColor(row),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.text.primary, 0.02)
                      }
                    }}
                  >
                    <TableCell>
                      <Tooltip
                        title={
                          row.errors.length > 0
                            ? `${formatCount(row.errors.length)} error(s)`
                            : row.warnings.length > 0
                            ? `${formatCount(row.warnings.length)} warning(s)`
                            : 'Valid'
                        }
                      >
                        {getRowIcon(row)}
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.tertiary', fontFeatureSettings: TNUM }}>
                        {row.rowIndex + 1}
                      </Typography>
                    </TableCell>
                    {mappedFields.map(field => {
                      const value = row.mappedData[field];
                      const hasError = row.errors.some(e => e.field === field);
                      const hasWarning = row.warnings.some(w => w.field === field);

                      return (
                        <TableCell
                          key={field}
                          sx={{
                            bgcolor: hasError
                              ? alpha(theme.palette.error.main, 0.08)
                              : hasWarning
                              ? alpha(theme.palette.warning.main, 0.08)
                              : 'transparent',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Tooltip title={formatCellValue(value, field)} placement="top">
                            <Typography
                              variant="caption"
                              sx={{
                                color: hasError ? 'error.main' : hasWarning ? 'warning.main' : 'text.primary',
                                fontWeight: hasError || hasWarning ? 600 : 400,
                                fontFeatureSettings: TNUM,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block'
                              }}
                            >
                              {formatCellValue(value, field)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      {hasIssues && (
                        <IconButton
                          size="small"
                          onClick={() => handleToggleRow(index)}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>

                  {hasIssues && (
                    <TableRow>
                      <TableCell colSpan={mappedFields.length + 3} sx={{ p: 0, border: 'none' }}>
                        <Collapse in={isExpanded} timeout="auto">
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: alpha(
                                row.errors.length > 0
                                  ? theme.palette.error.main
                                  : theme.palette.warning.main,
                                0.05
                              ),
                              borderBottom: `1px solid ${theme.palette.divider}`
                            }}
                          >
                            {row.errors.length > 0 && (
                              <Box sx={{ mb: row.warnings.length > 0 ? 2 : 0 }}>
                                <Typography sx={{ ...EYEBROW_SX, color: 'error.main', display: 'block', mb: 1 }}>
                                  Errors
                                </Typography>
                                {row.errors.map((error, errorIndex) => (
                                  <Box
                                    key={errorIndex}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'start',
                                      gap: 1,
                                      mb: 0.5,
                                      p: 0.75,
                                      bgcolor: 'background.paper',
                                      borderRadius: `${theme.palette.custom.radius.sm}px`,
                                      border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                    }}
                                  >
                                    <ErrorIcon sx={{ fontSize: 16, color: 'error.main', mt: 0.25 }} />
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="caption" color="error.main">
                                        {error.column}: {error.message}
                                      </Typography>
                                      {error.suggestedFix && (
                                        <Typography variant="caption" color="text.tertiary" sx={{ display: 'block', mt: 0.25 }}>
                                          💡 {error.suggestedFix}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            )}

                            {row.warnings.length > 0 && (
                              <Box>
                                <Typography sx={{ ...EYEBROW_SX, color: 'warning.main', display: 'block', mb: 1 }}>
                                  Warnings
                                </Typography>
                                {row.warnings.map((warning, warningIndex) => (
                                  <Box
                                    key={warningIndex}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'start',
                                      gap: 1,
                                      mb: 0.5,
                                      p: 0.75,
                                      bgcolor: 'background.paper',
                                      borderRadius: `${theme.palette.custom.radius.sm}px`,
                                      border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                    }}
                                  >
                                    <Warning sx={{ fontSize: 16, color: 'warning.main', mt: 0.25 }} />
                                    <Typography variant="caption" color="warning.main">
                                      {warning.column}: {warning.message}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {hasMore && !showAll && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowAll(true)}
          >
            Show All {formatCount(previewRows.length)} Rows
          </Button>
        </Box>
      )}

      {showAll && hasMore && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowAll(false)}
          >
            Show Less
          </Button>
        </Box>
      )}
    </CardShell>
  );
};
