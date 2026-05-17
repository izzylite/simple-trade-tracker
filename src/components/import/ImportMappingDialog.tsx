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
import {
  detectColumnMapping,
  validateRequiredFieldsMapped,
  validateAndCorrectMappings,
  isColumnCompatibleWithField,
} from '../../utils/columnDetection';
import { validateImportData } from '../../utils/importValidation';
import {
  findMatchingTemplate,
  saveMappingTemplate,
  updateTemplateLastUsed,
} from '../../utils/importMappingStorage';
import BaseDialog from '../common/BaseDialog';
import { useDialogTokens, MONO_FONT } from '../../styles/dialogTokens';
// Lazy-load xlsx (~600KB) only when an .xlsx file is actually parsed.
const loadXLSX = () => import('xlsx');

interface ImportMappingDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (trades: Partial<Trade>[]) => void;
  file: File | null;
}

const STEPS = ['Upload & Parse', 'Map Columns', 'Preview & Validate'];

export const ImportMappingDialog: React.FC<ImportMappingDialogProps> = ({
  open,
  onClose,
  onImport,
  file,
}) => {
  const theme = useTheme();
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
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [validationSummary, setValidationSummary] =
    useState<ValidationSummaryType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
      setPreviewRows([]);
      setValidationSummary(null);
      setError(null);
    }
  }, [open, file]);

  // Auto-validate when mappings change
  useEffect(() => {
    if (fileData && columnMappings.length > 0 && currentStep >= 1) {
      validateData();
    }
  }, [columnMappings, fileData]);

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

    setPreviewRows(rows);
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

      // Check if any pair-related tags are mapped
      // Look for columns mapped to tags, or unmapped columns that will become tags
      const hasPairColumn = fileData?.columns.some(
        (col) =>
          col.toLowerCase().includes('pair') ||
          col.toLowerCase().includes('symbol') ||
          col.toLowerCase().includes('instrument'),
      );

      if (hasPairColumn) {
        const pairColumnMapping = columnMappings.find((m) => {
          const colName = m.fileColumn.toLowerCase();
          return (
            colName.includes('pair') ||
            colName.includes('symbol') ||
            colName.includes('instrument')
          );
        });

        // If pair column exists but is mapped to 'ignore', warn user
        if (pairColumnMapping?.target === 'ignore') {
          setSnackbarMessage(
            '⚠️ Warning: Pair/Symbol column is set to "Ignore". Trades will not have economic events attached. Consider mapping it to "Tags" or "Create Tag".',
          );
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          // Don't return - allow them to proceed with warning
        }
      }

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

  // Chip-style step indicator
  const StepIndicator: React.FC = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {STEPS.map((label, idx) => {
        const active = idx === currentStep;
        const completed = idx < currentStep;
        const numColor = completed
          ? violet
          : active
            ? violet
            : theme.palette.text.secondary;
        return (
          <React.Fragment key={label}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                border: `1px solid ${
                  active || completed ? violetBorder : hairline
                }`,
                backgroundColor:
                  active || completed ? violetSofter : surfaceInset,
                fontFamily: MONO_FONT,
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: active || completed ? violet : theme.palette.text.secondary,
                transition: 'all 120ms ease',
              }}
            >
              {completed ? (
                <CheckCircleIcon sx={{ fontSize: 13, color: violet }} />
              ) : (
                <Box
                  component="span"
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: numColor,
                    backgroundColor: active
                      ? alpha(violet, 0.22)
                      : surfaceInset,
                    border: `1px solid ${active ? violetBorder : hairline}`,
                  }}
                >
                  {idx + 1}
                </Box>
              )}
              {label}
            </Box>
            {idx < STEPS.length - 1 && (
              <Box
                sx={{
                  width: 16,
                  height: 1,
                  backgroundColor:
                    idx < currentStep ? violetBorder : hairline,
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
        maxWidth="lg"
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
            sx: {
              borderRadius: 2,
              border: `1px solid ${hairline}`,
              boxShadow: theme.shadows[10],
              backgroundImage: 'none',
              height: '90vh',
              overflow: 'hidden',
            },
          },
        }}
        contentSx={{ px: 2.5, py: 2 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {/* Step indicator */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography sx={monoLabelSx}>Progress</Typography>
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

                  {/* Columns section */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Typography sx={monoLabelSx}>Columns</Typography>
                    <ColumnMapper
                      fileColumns={fileData.columns}
                      columnMappings={columnMappings}
                      sampleData={fileData.rows.slice(0, 5)}
                      onMappingChange={handleMappingChange}
                    />
                  </Box>
                </Box>
              )}

              {currentStep === 2 && validationSummary && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {/* Warning about deleting existing trades */}
                  <Alert
                    severity="warning"
                    sx={{
                      borderRadius: 1.5,
                      border: `1px solid ${alpha(
                        theme.palette.warning.main,
                        0.3,
                      )}`,
                      backgroundColor: alpha(theme.palette.warning.main, 0.08),
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        mb: 0.5,
                      }}
                    >
                      Importing will replace all existing trades
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.8rem',
                        color: theme.palette.text.secondary,
                        lineHeight: 1.5,
                      }}
                    >
                      All current trades in this calendar will be permanently
                      deleted before importing the new trades. This action
                      cannot be undone. Make sure you have a backup if needed.
                    </Typography>
                  </Alert>

                  <ValidationSummary summary={validationSummary} />

                  {validationSummary.conversions.length > 0 && (
                    <TypeConverterPanel
                      conversions={validationSummary.conversions}
                    />
                  )}

                  {/* Check if trades will have pair tags for economic events */}
                  {(() => {
                    const hasPairTags = previewRows.some((row) => {
                      const tags = row.mappedData.tags || [];
                      return tags.some((tag: string) =>
                        tag.toLowerCase().startsWith('pair:'),
                      );
                    });

                    const hasSession = previewRows.some(
                      (row) => row.mappedData.session,
                    );

                    if (!hasPairTags) {
                      return (
                        <Alert
                          severity="warning"
                          sx={{
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(
                              theme.palette.warning.main,
                              0.3,
                            )}`,
                            backgroundColor: alpha(
                              theme.palette.warning.main,
                              0.08,
                            ),
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              mb: 0.5,
                            }}
                          >
                            Economic events not available
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: theme.palette.text.secondary,
                              lineHeight: 1.5,
                            }}
                          >
                            No pair tags detected in your import. Trades will be
                            imported without economic events. To include
                            economic events, ensure you have a "Pair" column
                            (e.g., EURUSD, GBPJPY) mapped to "Tags" or "Create
                            Tag".
                          </Typography>
                        </Alert>
                      );
                    } else if (!hasSession) {
                      return (
                        <Alert
                          severity="info"
                          sx={{
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(
                              theme.palette.info.main,
                              0.3,
                            )}`,
                            backgroundColor: alpha(
                              theme.palette.info.main,
                              0.08,
                            ),
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              mb: 0.5,
                            }}
                          >
                            Partial economic events
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: theme.palette.text.secondary,
                              lineHeight: 1.5,
                            }}
                          >
                            Pair tags detected, but no session information.
                            Economic events will only be fetched for trades
                            with a trading session (London, New York, Asian).
                          </Typography>
                        </Alert>
                      );
                    } else {
                      return (
                        <Alert
                          severity="success"
                          icon={
                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                          }
                          sx={{
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(
                              theme.palette.success.main,
                              0.3,
                            )}`,
                            backgroundColor: alpha(
                              theme.palette.success.main,
                              0.08,
                            ),
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              mb: 0.5,
                            }}
                          >
                            Economic events will be fetched
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: theme.palette.text.secondary,
                              lineHeight: 1.5,
                            }}
                          >
                            Trades have pair tags and session information.
                            Relevant economic events will be automatically
                            attached during import.
                          </Typography>
                        </Alert>
                      );
                    }
                  })()}

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Typography sx={monoLabelSx}>Preview</Typography>
                    <ImportPreview
                      previewRows={previewRows}
                      mappedFields={getMappedFields() as any}
                      maxRows={10}
                    />
                  </Box>
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
