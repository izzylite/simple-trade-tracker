import React, { useState, useEffect } from 'react';
import {
  Button,
  Typography,
  Box,
  IconButton,
  alpha,
  Snackbar,
  Alert,
  useTheme,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  FileDownload,
  FileUpload,
  CheckCircle,
  FolderOpenOutlined as FolderOpenIcon,
} from '@mui/icons-material';
import { ImportMappingTemplate } from '../../types/import';
import {
  loadMappingTemplates,
  deleteMappingTemplate,
  exportTemplates,
  importTemplates,
} from '../../utils/importMappingStorage';
import { format } from 'date-fns';
import BaseDialog from '../common/BaseDialog';

interface MappingTemplateManagerProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (template: ImportMappingTemplate) => void;
}

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

export const MappingTemplateManager: React.FC<MappingTemplateManagerProps> = ({
  open,
  onClose,
  onApplyTemplate,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetSofter = alpha(violet, isDark ? 0.12 : 0.10);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark
    ? 'rgba(255,255,255,0.03)'
    : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const monoLabelSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
  };

  const metaChipSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 0.875,
    py: 0.25,
    borderRadius: 999,
    fontFamily: MONO_FONT,
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: theme.palette.text.secondary,
    backgroundColor: surfaceInset,
    border: `1px solid ${hairline}`,
  };

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

  const [templates, setTemplates] = useState<ImportMappingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success',
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = () => {
    const loaded = loadMappingTemplates();
    setTemplates(loaded);
  };

  const handleDeleteClick = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (templateToDelete) {
      deleteMappingTemplate(templateToDelete);
      loadTemplates();
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setTemplateToDelete(null);
  };

  const handleApply = () => {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (template) {
      onApplyTemplate(template);
      onClose();
    }
  };

  const handleExport = () => {
    exportTemplates();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        const count = importTemplates(jsonData);
        setSnackbarMessage(`Successfully imported ${count} template(s)`);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        loadTemplates();
      } catch (err) {
        setSnackbarMessage('Failed to import templates');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <>
      <BaseDialog
        open={open}
        onClose={onClose}
        title="Mapping templates"
        subtitle="Reuse a saved column mapping for this CSV"
        headerIcon={<FolderOpenIcon sx={{ fontSize: 18 }} />}
        maxWidth="sm"
        fullWidth
        primaryButtonText="Apply template"
        primaryButtonAction={selectedTemplate ? handleApply : undefined}
        isSubmitting={!selectedTemplate}
        cancelButtonText="Close"
        contentSx={{ px: 2.5, py: 2 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Saved templates label */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography sx={monoLabelSx}>
              Saved templates
              <Box component="span" sx={{ ...metaChipSx, ml: 0.5 }}>
                {templates.length}
              </Box>
            </Typography>
          </Box>

          {/* List or empty state */}
          {templates.length === 0 ? (
            <Box
              sx={{
                px: 2,
                py: 5,
                textAlign: 'center',
                borderRadius: 1.5,
                border: `1px dashed ${hairline}`,
                backgroundColor: surfaceInset,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: theme.palette.text.secondary,
                  lineHeight: 1.5,
                }}
              >
                No saved templates yet. Map columns in the import flow and save
                the mapping to reuse it next time.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {templates.map((template) => {
                const selected = selectedTemplate === template.id;
                return (
                  <Box
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    sx={{
                      position: 'relative',
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 1.5,
                      border: `1px solid ${selected ? violetBorder : hairline}`,
                      backgroundColor: selected ? violetSofter : surfaceInset,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      '&:hover': {
                        borderColor: selected
                          ? violetBorder
                          : alpha(violet, 0.4),
                        backgroundColor: selected
                          ? violetSoft
                          : alpha(theme.palette.text.primary, isDark ? 0.04 : 0.03),
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              color: theme.palette.text.primary,
                            }}
                          >
                            {template.name}
                          </Typography>
                          {selected && (
                            <CheckCircle
                              sx={{ fontSize: 14, color: violet }}
                            />
                          )}
                        </Box>
                        {template.description && (
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: theme.palette.text.secondary,
                              lineHeight: 1.4,
                              mb: 0.75,
                            }}
                          >
                            {template.description}
                          </Typography>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 0.5,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Box sx={metaChipSx}>
                            {template.fileColumns.length} cols
                          </Box>
                          <Box sx={metaChipSx}>
                            {format(template.createdAt, 'MMM d, yyyy')}
                          </Box>
                          {template.lastUsed && (
                            <Box sx={metaChipSx}>
                              Used {format(template.lastUsed, 'MMM d')}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(template.id);
                        }}
                        sx={{
                          color: alpha(theme.palette.text.secondary, 0.7),
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          '&:hover': {
                            color: theme.palette.error.main,
                            backgroundColor: alpha(
                              theme.palette.error.main,
                              0.08,
                            ),
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Import / Export row */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              pt: 1,
              borderTop: `1px solid ${hairline}`,
            }}
          >
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              id="import-templates"
              onChange={handleImport}
            />
            <label htmlFor="import-templates" style={{ flex: 1 }}>
              <Button
                component="span"
                size="small"
                startIcon={<FileUpload sx={{ fontSize: 16 }} />}
                fullWidth
                sx={ghostButtonSx}
              >
                Import
              </Button>
            </label>
            <Button
              size="small"
              startIcon={<FileDownload sx={{ fontSize: 16 }} />}
              onClick={handleExport}
              disabled={templates.length === 0}
              sx={{ ...ghostButtonSx, flex: 1 }}
            >
              Export
            </Button>
          </Box>
        </Box>
      </BaseDialog>

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

      {/* Delete Confirmation */}
      <BaseDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        title="Delete template?"
        subtitle="This cannot be undone"
        headerIcon={<DeleteIcon sx={{ fontSize: 18 }} />}
        maxWidth="xs"
        fullWidth
        primaryButtonText="Delete"
        primaryButtonAction={handleDeleteConfirm}
        cancelButtonText="Cancel"
        contentSx={{ px: 2.5, py: 2 }}
      >
        <Typography
          sx={{
            fontSize: '0.88rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.5,
          }}
        >
          Are you sure you want to delete this mapping template? You'll need to
          re-create it from a CSV import if you want it back.
        </Typography>
      </BaseDialog>
    </>
  );
};
