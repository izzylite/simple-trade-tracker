import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
  alpha
} from '@mui/material';
import {
  Close,
  Save,
  Folder
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
  ImportMappingTemplate
} from '../../types/import';
import { ColumnMapper } from './ColumnMapper';
import { ImportPreview } from './ImportPreview';
import { ValidationSummary } from './ValidationSummary';
import { TypeConverterPanel } from './TypeConverterPanel';
import { MappingTemplateManager } from './MappingTemplateManager';
import { detectColumnMapping, validateRequiredFieldsMapped, validateAndCorrectMappings, isColumnCompatibleWithField } from '../../utils/columnDetection';
import { validateImportData } from '../../utils/importValidation';
import {
  findMatchingTemplate,
  saveMappingTemplate,
  updateTemplateLastUsed
} from '../../utils/importMappingStorage';
import * as XLSX from 'xlsx';

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
  file
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [fileData, setFileData] = useState<ImportFileData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummaryType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const config: ImportConfig = {
    skipErrorRows: true,
    createTagsFromUnmapped: true,
    numberFormat: 'us'
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
      const fileType = file.name.split('.').pop()?.toLowerCase() as 'xlsx' | 'csv';
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
      const { correctedMappings, corrections } = validateAndCorrectMappings(detectedMappings, parsedData);

      // Show warnings if any mappings were auto-corrected
      if (corrections.length > 0) {
        const correctionMessages = corrections.map(c =>
          `"${c.column}" cannot be mapped to "${c.originalTarget}": ${c.reason}`
        ).join('\n');

        setSnackbarMessage(
          `⚠️ Auto-corrected ${corrections.length} incompatible mapping(s):\n${correctionMessages}\n\nThese columns have been set to "Ignore".`
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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, any>>;

          if (jsonData.length === 0) {
            throw new Error('No data found in file');
          }

          const columns = Object.keys(jsonData[0]);

          resolve({
            columns,
            rows: jsonData,
            fileType: 'xlsx',
            fileName: file.name,
            rowCount: jsonData.length
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
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
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
            rowCount: rows.length
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
      config
    );

    setPreviewRows(rows);
    setValidationSummary(summary);
  };

  const handleMappingChange = (fileColumn: string, target: MappingTarget) => {
    // If target is a trade field (not 'ignore' or 'create_tag'), validate compatibility
    if (target !== 'ignore' && target !== 'create_tag' && fileData) {
      // Get sample values for this column
      const sampleValues = fileData.rows.slice(0, 100).map(row => row[fileColumn]);
      const compatibility = isColumnCompatibleWithField(sampleValues, target);

      if (!compatibility.isCompatible) {
        // Show error and don't allow the mapping
        setSnackbarMessage(
          `❌ Cannot map "${fileColumn}" to "${target}": ${compatibility.reason}\n\n` +
          `This column will remain set to "Ignore". Clean your data or choose a different field.`
        );
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return; // Don't apply the invalid mapping
      }
    }

    setColumnMappings(prev =>
      prev.map(m =>
        m.fileColumn === fileColumn
          ? { ...m, target, autoDetected: false }
          : m
      )
    );
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // Validate required fields are mapped
      const validation = validateRequiredFieldsMapped(columnMappings);
      if (!validation.isValid) {
        setError(`Required fields not mapped: ${validation.missingFields.join(', ')}`);
        return;
      }

      // Check if any pair-related tags are mapped
      // Look for columns mapped to tags, or unmapped columns that will become tags
      const hasPairColumn = fileData?.columns.some(col =>
        col.toLowerCase().includes('pair') ||
        col.toLowerCase().includes('symbol') ||
        col.toLowerCase().includes('instrument')
      );

      if (hasPairColumn) {
        const pairColumnMapping = columnMappings.find(m => {
          const colName = m.fileColumn.toLowerCase();
          return (colName.includes('pair') || colName.includes('symbol') || colName.includes('instrument'));
        });

        // If pair column exists but is mapped to 'ignore', warn user
        if (pairColumnMapping?.target === 'ignore') {
          setSnackbarMessage('⚠️ Warning: Pair/Symbol column is set to "Ignore". Trades will not have economic events attached. Consider mapping it to "Tags" or "Create Tag".');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          // Don't return - allow them to proceed with warning
        }
      }

      validateData();
    }

    setError(null);
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => prev - 1);
  };

  const handleImport = () => {
    if (!validationSummary) return;

    // Get valid trades
    const validTrades = previewRows
      .filter(row => row.isValid || !config.skipErrorRows)
      .map(row => row.mappedData);

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
        `Template for ${fileData.fileName}`
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
      template.columnMappings.map(m => [m.fileColumn, m])
    );

    // Merge template with current auto-detected mappings
    // For columns in template: use template mapping
    // For new columns (not in template): keep auto-detected mapping
    const mergedMappings = columnMappings.map(currentMapping => {
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
      .filter(m => m.target !== 'ignore' && m.target !== 'create_tag')
      .map(m => m.target);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            '& .MuiDialogContent-root': {
              // Custom scrollbar styling to match app
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: alpha('#000', 0.05),
                borderRadius: 1
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: alpha('#000', 0.2),
                borderRadius: 1,
                '&:hover': {
                  bgcolor: alpha('#000', 0.3)
                }
              }
            }
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Import Trades
            </Typography>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Stepper activeStep={currentStep} sx={{ mb: 3 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isProcessing && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Processing file...
              </Typography>
            </Box>
          )}

          {!isProcessing && fileData && (
            <>
              {currentStep === 0 && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    File Loaded Successfully
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fileData.fileName} - {fileData.rowCount} rows, {fileData.columns.length} columns
                  </Typography>
                </Box>
              )}

              {currentStep === 1 && (
                <Box>
                  <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Folder />}
                      onClick={() => setShowTemplateManager(true)}
                    >
                      Load Template
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Save />}
                      onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    >
                      Save as Template
                    </Button>
                  </Box>

                  {showSaveTemplate && (
                    <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Save Mapping Template
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <input
                          type="text"
                          placeholder="Template name"
                          value={saveTemplateName}
                          onChange={(e) => setSaveTemplateName(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ccc'
                          }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSaveTemplate}
                          disabled={!saveTemplateName.trim()}
                        >
                          Save
                        </Button>
                      </Box>
                    </Box>
                  )}

                  <ColumnMapper
                    fileColumns={fileData.columns}
                    columnMappings={columnMappings}
                    sampleData={fileData.rows.slice(0, 5)}
                    onMappingChange={handleMappingChange}
                  />
                </Box>
              )}

              {currentStep === 2 && validationSummary && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ValidationSummary summary={validationSummary} />

                  {validationSummary.conversions.length > 0 && (
                    <TypeConverterPanel conversions={validationSummary.conversions} />
                  )}

                  {/* Check if trades will have pair tags for economic events */}
                  {(() => {
                    const hasPairTags = previewRows.some(row => {
                      const tags = row.mappedData.tags || [];
                      return tags.some((tag: string) => tag.toLowerCase().startsWith('pair:'));
                    });

                    const hasSession = previewRows.some(row => row.mappedData.session);

                    if (!hasPairTags) {
                      return (
                        <Alert severity="warning" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Economic Events Not Available
                          </Typography>
                          <Typography variant="caption">
                            No pair tags detected in your import. Trades will be imported without economic events.
                            To include economic events, ensure you have a "Pair" column (e.g., EURUSD, GBPJPY) mapped to "Tags" or "Create Tag".
                          </Typography>
                        </Alert>
                      );
                    } else if (!hasSession) {
                      return (
                        <Alert severity="info" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Partial Economic Events
                          </Typography>
                          <Typography variant="caption">
                            Pair tags detected, but no session information. Economic events will only be fetched for trades with a trading session (London, New York, Asian).
                          </Typography>
                        </Alert>
                      );
                    } else {
                      return (
                        <Alert severity="success" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Economic Events Will Be Fetched ✓
                          </Typography>
                          <Typography variant="caption">
                            Trades have pair tags and session information. Relevant economic events will be automatically attached during import.
                          </Typography>
                        </Alert>
                      );
                    }
                  })()}

                  <ImportPreview
                    previewRows={previewRows}
                    mappedFields={getMappedFields() as any}
                    maxRows={10}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            Cancel
          </Button>
          {currentStep > 0 && (
            <Button onClick={handleBack}>
              Back
            </Button>
          )}
          {currentStep < STEPS.length - 1 && (
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={isProcessing || !fileData}
            >
              Next
            </Button>
          )}
          {currentStep === STEPS.length - 1 && (
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!validationSummary || validationSummary.validRows === 0}
            >
              Import {validationSummary?.willImport || 0} Trades
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
