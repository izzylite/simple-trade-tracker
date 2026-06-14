import React, { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  alpha,
  useTheme,
} from '@mui/material';
import { getShadow } from 'styles/designTokens';
import {
  Save,
  FolderOpenOutlined as FolderIcon,
  UploadFileOutlined as UploadFileIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { Trade } from '../../types/dualWrite';
import {
  ImportFileData,
  ImportStep,
  ColumnMapping,
  ImportConfig,
  MappingTarget,
  ImportPreviewRow,
  ValidationSummary as ValidationSummaryType,
  ImportMappingTemplate,
} from '../../types/import';
import { ColumnMapper } from './ColumnMapper';
import { ImportPreview } from './ImportPreview';
import { ValidationSummary } from './ValidationSummary';
import { TypeConverterPanel } from './TypeConverterPanel';
import { MappingTemplateManager } from './MappingTemplateManager';
import { AssetMappingPanel } from './AssetMappingPanel';
import {
  detectColumnMapping,
  validateRequiredFieldsMapped,
  validateAndCorrectMappings,
  isColumnCompatibleWithField,
} from '../../utils/columnDetection';
import { validateImportData } from '../../utils/importValidation';
import {
  saveMappingTemplate,
  updateTemplateLastUsed,
} from '../../utils/importMappingStorage';
import BaseDialog from 'components/common/BaseDialog';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { loadXLSX } from '../../utils/loadXLSX';
import { ASSET_TAG_GROUP } from 'features/events/services/instrumentCatalog';
import { useIsMobile } from 'hooks/useResponsive';

interface ImportMappingDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (trades: Partial<Trade>[]) => void;
  file: File | null;
}

const STEPS = ['Upload', 'Map', 'Assets', 'Preview'];

type NoticeTone = 'warning' | 'info' | 'success' | 'error';

interface NoticeStripProps {
  tone: NoticeTone;
  title: string;
  body: string;
}

/**
 * Compact inset notice — replaces MUI Alert with the dialog's token language.
 * Mono uppercase eyebrow on the left, body copy on the right, hairline border,
 * subtle tone-tinted background.
 */
const NoticeStrip: React.FC<NoticeStripProps> = ({ tone, title, body }) => {
  const theme = useTheme();
  const { hairline } = useDialogTokens();

  const toneColor =
    tone === 'warning'
      ? theme.palette.warning.main
      : tone === 'error'
        ? theme.palette.error.main
        : tone === 'success'
          ? theme.palette.success.main
          : theme.palette.info.main;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 1.25,
        border: `1px solid ${hairline}`,
        bgcolor: alpha(toneColor, 0.06),
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: 3,
          bgcolor: toneColor,
          flexShrink: 0,
        }}
      />
      <Box sx={{ px: 1.5, py: 1, flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: toneColor,
            mb: 0.4,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.78rem',
            color: alpha(theme.palette.text.primary, 0.78),
            lineHeight: 1.5,
          }}
        >
          {body}
        </Typography>
      </Box>
    </Box>
  );
};

export const ImportMappingDialog: React.FC<ImportMappingDialogProps> = ({
  open,
  onClose,
  onImport,
  file,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const {
    isDark,
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
    inputSx,
  } = useDialogTokens();

  const ghostButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.8rem',
    color: theme.palette.text.primary,
    backgroundColor: surfaceInset,
    border: `1px solid ${hairline}`,
    borderRadius: 1.25,
    px: 1.5,
    py: 0.625,
    minHeight: 0,
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
      borderColor: alpha(violet, 0.45),
    },
    '&.Mui-disabled': {
      color: alpha(theme.palette.text.primary, 0.35),
      borderColor: alpha(theme.palette.divider, 0.6),
    },
  };

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [fileData, setFileData] = useState<ImportFileData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  // Asset-mapping step state — `splitColumn` is the file column to group by;
  // `assetAssignments` is uppercased-value → instrument symbol (e.g. "EU" → "EURUSD").
  // On import these get applied as `Asset:XXX` tags so trades join the
  // economic-events index. Step is fully optional.
  const [splitColumn, setSplitColumn] = useState<string | null>(null);
  const [assetAssignments, setAssetAssignments] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [validationSummary, setValidationSummary] =
    useState<ValidationSummaryType | null>(null);
  // Initial true when a file is already present so the first commit after
  // mount already renders the parse spinner. Without this, the dialog body
  // flashes empty for one render until the parseFile useEffect fires
  // setIsProcessing(true) — and for fast parses that flash IS the entire
  // pre-parse window, making the dialog look like it only opens after
  // parsing finishes.
  const [isProcessing, setIsProcessing] = useState<boolean>(() => Boolean(file));
  const [error, setError] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );

  const config: ImportConfig = {
    skipErrorRows: true,
    createTagsFromUnmapped: true,
    numberFormat: 'us',
  };

  // Parse file on open
  useEffect(() => {
    if (open && file) {
      parseFile(file);
    } else if (!open) {
      // Reset state on close
      setCurrentStep(0);
      setFileData(null);
      setColumnMappings([]);
      setSplitColumn(null);
      setAssetAssignments({});
      setPreviewRows([]);
      setValidationSummary(null);
      setError(null);
    }
  }, [open, file]);

  // Auto-validate when mappings or asset assignments change. Including
  // splitColumn/assetAssignments so preview tags reflect the asset step.
  useEffect(() => {
    if (fileData && columnMappings.length > 0 && currentStep >= 1) {
      validateData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnMappings, fileData, splitColumn, assetAssignments]);

  const parseFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase() as
        | 'xlsx'
        | 'csv';
      let parsedData: ImportFileData;

      if (fileType === 'csv') {
        parsedData = await parseCSV(file);
      } else {
        parsedData = await parseExcel(file);
      }

      setFileData(parsedData);

      // Auto-detect column mappings (no auto-load of templates)
      const detectedMappings = detectColumnMapping(parsedData.columns);

      // Validate and auto-correct mappings based on actual data
      const { correctedMappings, corrections } = validateAndCorrectMappings(
        detectedMappings,
        parsedData,
      );

      // Show warnings if any mappings were auto-corrected
      if (corrections.length > 0) {
        const correctionMessages = corrections
          .map(
            (c) =>
              `"${c.column}" cannot be mapped to "${c.originalTarget}": ${c.reason}`,
          )
          .join('\n');

        setSnackbarMessage(
          `⚠️ Auto-corrected ${corrections.length} incompatible mapping(s):\n${correctionMessages}\n\nThese columns have been set to "Ignore".`,
        );
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }

      setColumnMappings(correctedMappings);

      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const parseExcel = async (file: File): Promise<ImportFileData> => {
    const XLSX = await loadXLSX();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<
            Record<string, any>
          >;

          if (jsonData.length === 0) {
            throw new Error('No data found in file');
          }

          const columns = Object.keys(jsonData[0]);

          resolve({
            columns,
            rows: jsonData,
            fileType: 'xlsx',
            fileName: file.name,
            rowCount: jsonData.length,
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  /**
   * Parse a CSV line properly handling commas within quoted fields
   */
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        // Handle escaped quotes (double quotes)
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  };

  const parseCSV = async (file: File): Promise<ImportFileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter((line) => line.trim());

          if (lines.length < 2) {
            throw new Error(
              'CSV file must have at least a header and one data row',
            );
          }

          const headers = parseCSVLine(lines[0]);
          const rows: Array<Record<string, any>> = [];

          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, any> = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            rows.push(row);
          }

          resolve({
            columns: headers,
            rows,
            fileType: 'csv',
            fileName: file.name,
            rowCount: rows.length,
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const validateData = () => {
    if (!fileData) return;

    const { previewRows: rows, validationSummary: summary } = validateImportData(
      fileData.rows,
      columnMappings,
      config,
    );

    // Apply asset-mapping tags so the preview accurately reflects what will
    // land. Walks each row, looks up its split-column value, and appends
    // `Asset:XXX` if the user assigned an instrument to that group.
    const enriched = splitColumn
      ? rows.map((row) => {
          const raw = String(fileData.rows[row.rowIndex]?.[splitColumn] ?? '').trim();
          const key = raw.toUpperCase() || '(EMPTY)';
          const symbol = assetAssignments[key];
          if (!symbol) return row;
          const existing = row.mappedData.tags || [];
          const assetTag = `${ASSET_TAG_GROUP}:${symbol}`;
          if (existing.includes(assetTag)) return row;
          return {
            ...row,
            mappedData: {
              ...row.mappedData,
              tags: [...existing, assetTag],
            },
          };
        })
      : rows;

    setPreviewRows(enriched);
    setValidationSummary(summary);
  };

  const handleMappingChange = (fileColumn: string, target: MappingTarget) => {
    // If target is a trade field (not 'ignore' or 'create_tag'), validate compatibility
    if (target !== 'ignore' && target !== 'create_tag' && fileData) {
      // Get sample values for this column
      const sampleValues = fileData.rows
        .slice(0, 100)
        .map((row) => row[fileColumn]);
      const compatibility = isColumnCompatibleWithField(sampleValues, target);

      if (!compatibility.isCompatible) {
        // Show error and don't allow the mapping
        setSnackbarMessage(
          `❌ Cannot map "${fileColumn}" to "${target}": ${compatibility.reason}\n\n` +
            `This column will remain set to "Ignore". Clean your data or choose a different field.`,
        );
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return; // Don't apply the invalid mapping
      }
    }

    setColumnMappings((prev) =>
      prev.map((m) =>
        m.fileColumn === fileColumn
          ? { ...m, target, autoDetected: false }
          : m,
      ),
    );
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // Validate required fields are mapped
      const validation = validateRequiredFieldsMapped(columnMappings);
      if (!validation.isValid) {
        setError(
          `Required fields not mapped: ${validation.missingFields.join(', ')}`,
        );
        return;
      }

      // Note: instrument detection used to warn here. That is now handled by the
      // Assets step (next), where the user can group trades by any column and
      // assign instruments explicitly. No pre-warning needed.

      validateData();
    }

    setError(null);
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => prev - 1);
  };

  const handleImport = () => {
    if (!validationSummary) return;

    // Get valid trades
    const validTrades = previewRows
      .filter((row) => row.isValid || !config.skipErrorRows)
      .map((row) => row.mappedData);

    onImport(validTrades);
    onClose();
  };

  const handleSaveTemplate = () => {
    if (!fileData || !saveTemplateName.trim()) return;

    try {
      saveMappingTemplate(
        saveTemplateName.trim(),
        columnMappings,
        fileData.columns,
        `Template for ${fileData.fileName}`,
      );
      setShowSaveTemplate(false);
      setSaveTemplateName('');
      setSnackbarMessage('Template saved successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (err) {
      setSnackbarMessage('Failed to save template');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleApplyTemplate = (template: ImportMappingTemplate) => {
    if (!fileData) return;

    // Create a map of template mappings for quick lookup
    const templateMap = new Map(
      template.columnMappings.map((m) => [m.fileColumn, m]),
    );

    // Merge template with current auto-detected mappings
    // For columns in template: use template mapping
    // For new columns (not in template): keep auto-detected mapping
    const mergedMappings = columnMappings.map((currentMapping) => {
      const templateMapping = templateMap.get(currentMapping.fileColumn);
      if (templateMapping) {
        // Use template mapping for existing columns
        return templateMapping;
      }
      // Keep auto-detected mapping for new columns
      return currentMapping;
    });

    setColumnMappings(mergedMappings);
    updateTemplateLastUsed(template.id);
    setShowTemplateManager(false);
  };

  const getMappedFields = () => {
    return columnMappings
      .filter((m) => m.target !== 'ignore' && m.target !== 'create_tag')
      .map((m) => m.target);
  };

  // --- Subtitle + primary CTA wiring for BaseDialog ---
  const subtitle = (() => {
    if (currentStep === 0) return 'Parsing your file…';
    if (currentStep === 1) return 'Map your CSV columns to trade fields';
    if (currentStep === 2)
      return 'Optional — link trades to instruments for economic events';
    return 'Review and confirm before importing';
  })();

  const canGoNext =
    currentStep < STEPS.length - 1 && !isProcessing && !!fileData;
  const canImport =
    currentStep === STEPS.length - 1 &&
    !!validationSummary &&
    validationSummary.validRows > 0;

  const primaryButtonText =
    currentStep === STEPS.length - 1
      ? `Import ${validationSummary?.willImport || 0} trades`
      : 'Next';
  const primaryButtonAction = canImport
    ? handleImport
    : canGoNext
      ? handleNext
      : undefined;

  // Clean step rail — numbered violet circles connected by hairlines.
  // Mirrors the landing-page import dialog mock (no pill chrome around labels).
  const StepIndicator: React.FC = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      {STEPS.map((label, idx) => {
        const active = idx === currentStep;
        const completed = idx < currentStep;
        return (
          <React.Fragment key={label}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                component="span"
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO_FONT,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  border: `1.5px solid ${
                    active || completed ? violet : hairline
                  }`,
                  backgroundColor: active ? violet : 'transparent',
                  color: active
                    ? '#fff'
                    : completed
                      ? violet
                      : alpha(theme.palette.text.secondary, 0.6),
                  lineHeight: 1,
                  transition: 'all 120ms ease',
                  flexShrink: 0,
                }}
              >
                {completed ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: violet }} />
                ) : (
                  idx + 1
                )}
              </Box>
              <Typography
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  fontFamily: MONO_FONT,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase' as const,
                  color: active
                    ? theme.palette.text.primary
                    : alpha(theme.palette.text.secondary, 0.7),
                }}
              >
                {label}
              </Typography>
            </Box>
            {idx < STEPS.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  maxWidth: 56,
                  height: '1px',
                  backgroundColor: idx < currentStep ? violet : hairline,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );

  const headerIcon = <UploadFileIcon sx={{ fontSize: 18 }} />;

  return (
    <>
      <BaseDialog
        open={open}
        onClose={onClose}
        title="Import trades"
        subtitle={subtitle}
        headerIcon={headerIcon}
        maxWidth="sm"
        fullWidth
        primaryButtonText={primaryButtonText}
        primaryButtonAction={primaryButtonAction}
        isSubmitting={
          (currentStep === STEPS.length - 1 && !canImport) ||
          (currentStep < STEPS.length - 1 && !canGoNext)
        }
        actions={
          currentStep > 0 ? (
            <Button
              onClick={handleBack}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.primary,
                backgroundColor: surfaceInset,
                border: `1px solid ${hairline}`,
                borderRadius: 1.25,
                px: 1.5,
                py: 0.625,
                minHeight: 0,
                '&:hover': {
                  backgroundColor: alpha(
                    theme.palette.text.primary,
                    isDark ? 0.06 : 0.05,
                  ),
                  borderColor: alpha(violet, 0.45),
                },
              }}
            >
              Back
            </Button>
          ) : null
        }
        slotProps={{
          paper: {
            // On phones, defer entirely to BaseDialog's own full-screen paper —
            // the custom maxWidth/85vh/borderRadius here would clobber it.
            sx: isMobile
              ? undefined
              : {
                  borderRadius: 2,
                  border: `1px solid ${hairline}`,
                  boxShadow: getShadow(theme, 'xl'),
                  backgroundImage: 'none',
                  maxWidth: 560,
                  height: '85vh',
                  overflow: 'hidden',
                },
          },
        }}
        // flex: 1 + minHeight: 0 makes the body fill remaining vertical space
        // so the footer stays pinned to the bottom even when step content is
        // short (e.g. Assets empty state). overflowY:auto already handles tall
        // steps like Preview.
        contentSx={{ px: 2.5, py: 2, flex: 1, minHeight: 0 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {/* Step rail — sits flush at the top of the dialog body */}
          <Box
            sx={{
              px: 1.5,
              py: 1.25,
              borderRadius: 1.25,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
            }}
          >
            <StepIndicator />
          </Box>

          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{
                borderRadius: 1.5,
                border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                backgroundColor: alpha(theme.palette.error.main, 0.08),
                '& .MuiAlert-message': { fontSize: '0.85rem' },
              }}
            >
              {error}
            </Alert>
          )}

          {isProcessing && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 8,
                gap: 1.5,
              }}
            >
              <CircularProgress size={20} thickness={5} sx={{ color: violet }} />
              <Typography
                sx={{
                  fontSize: '0.88rem',
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                }}
              >
                Processing file…
              </Typography>
            </Box>
          )}

          {!isProcessing && fileData && (
            <>
              {currentStep === 0 && (
                <Box
                  sx={{
                    py: 5,
                    px: 3,
                    textAlign: 'center',
                    borderRadius: 1.5,
                    border: `1px solid ${hairline}`,
                    backgroundColor: surfaceInset,
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.25,
                      mx: 'auto',
                      mb: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: violetSoft,
                      color: violet,
                      border: `1px solid ${violetBorder}`,
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      mb: 0.5,
                      color: theme.palette.text.primary,
                    }}
                  >
                    File loaded successfully
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.82rem',
                      color: theme.palette.text.secondary,
                      fontFamily: MONO_FONT,
                    }}
                  >
                    {fileData.fileName} · {fileData.rowCount} rows ·{' '}
                    {fileData.columns.length} columns
                  </Typography>
                </Box>
              )}

              {currentStep === 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {/* Template actions */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography sx={monoLabelSx}>Mapping templates</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<FolderIcon sx={{ fontSize: 16 }} />}
                        onClick={() => setShowTemplateManager(true)}
                        sx={ghostButtonSx}
                      >
                        Load template
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Save sx={{ fontSize: 16 }} />}
                        onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                        sx={ghostButtonSx}
                      >
                        Save as template
                      </Button>
                    </Box>
                  </Box>

                  {showSaveTemplate && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: `1px solid ${hairline}`,
                        backgroundColor: surfaceInset,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Typography sx={monoLabelSx}>
                        Save mapping template
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          placeholder="Template name"
                          value={saveTemplateName}
                          onChange={(e) => setSaveTemplateName(e.target.value)}
                          size="small"
                          fullWidth
                          sx={inputSx}
                        />
                        <Button
                          onClick={handleSaveTemplate}
                          disabled={!saveTemplateName.trim()}
                          variant="contained"
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            backgroundColor: violet,
                            color: '#fff',
                            borderRadius: 1.25,
                            px: 1.75,
                            py: 0.75,
                            minHeight: 0,
                            boxShadow: 'none',
                            '&:hover': {
                              backgroundColor: theme.palette.primary.dark,
                              boxShadow: 'none',
                            },
                            '&.Mui-disabled': {
                              backgroundColor: alpha(violet, 0.35),
                              color: alpha('#fff', 0.7),
                            },
                          }}
                        >
                          Save
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Columns — ColumnMapper renders its own status strip + headers */}
                  <ColumnMapper
                    fileColumns={fileData.columns}
                    columnMappings={columnMappings}
                    sampleData={fileData.rows.slice(0, 5)}
                    onMappingChange={handleMappingChange}
                  />
                </Box>
              )}

              {currentStep === 2 && (
                <AssetMappingPanel
                  fileData={fileData}
                  splitColumn={splitColumn}
                  onSplitColumnChange={setSplitColumn}
                  assetAssignments={assetAssignments}
                  onAssetAssignmentsChange={setAssetAssignments}
                />
              )}

              {currentStep === 3 && validationSummary && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.75,
                  }}
                >
                  {/* Destructive notice — mono eyebrow + body text in an inset strip */}
                  <NoticeStrip
                    tone="warning"
                    title="Importing replaces existing trades"
                    body="All current trades in this calendar will be permanently deleted before the new ones are written. This action cannot be undone."
                  />

                  <ValidationSummary summary={validationSummary} />

                  {validationSummary.conversions.length > 0 && (
                    <TypeConverterPanel
                      conversions={validationSummary.conversions}
                    />
                  )}

                  {/* Economic events context — tone depends on asset/session coverage */}
                  {(() => {
                    const assetPrefix = `${ASSET_TAG_GROUP.toLowerCase()}:`;
                    const hasAssetTags = previewRows.some((row) => {
                      const tags = row.mappedData.tags || [];
                      return tags.some((tag: string) =>
                        tag.toLowerCase().startsWith(assetPrefix),
                      );
                    });
                    const hasSession = previewRows.some(
                      (row) => row.mappedData.session,
                    );

                    if (!hasAssetTags) {
                      return (
                        <NoticeStrip
                          tone="warning"
                          title="Economic events not available"
                          body='No asset tags detected. Map an instrument column (e.g. EURUSD, GBPJPY) to Tags or Create Tag to attach events.'
                        />
                      );
                    }
                    if (!hasSession) {
                      return (
                        <NoticeStrip
                          tone="info"
                          title="Partial economic events"
                          body="Asset tags found, no session. Events will only attach to trades that include a session (London / NY / Asian)."
                        />
                      );
                    }
                    return (
                      <NoticeStrip
                        tone="success"
                        title="Economic events will attach"
                        body="Asset tags and session info detected. Relevant events will be linked automatically during import."
                      />
                    );
                  })()}

                  {/* Preview renders its own header strip — no extra label */}
                  <ImportPreview
                    previewRows={previewRows}
                    mappedFields={getMappedFields() as any}
                    maxRows={10}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </BaseDialog>

      <MappingTemplateManager
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onApplyTemplate={handleApplyTemplate}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
