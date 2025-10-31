import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Chip,
  TextField,
  alpha,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Delete,
  FileDownload,
  FileUpload,
  CheckCircle
} from '@mui/icons-material';
import { ImportMappingTemplate } from '../../types/import';
import {
  loadMappingTemplates,
  deleteMappingTemplate,
  exportTemplates,
  importTemplates
} from '../../utils/importMappingStorage';
import { format } from 'date-fns';

interface MappingTemplateManagerProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (template: ImportMappingTemplate) => void;
}

export const MappingTemplateManager: React.FC<MappingTemplateManagerProps> = ({
  open,
  onClose,
  onApplyTemplate
}) => {
  const [templates, setTemplates] = useState<ImportMappingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
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
    const template = templates.find(t => t.id === selectedTemplate);
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
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
        Mapping Templates
      </DialogTitle>
      <DialogContent>
        {templates.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No saved templates yet. Create templates by mapping columns and saving them for future use.
            </Typography>
          </Box>
        ) : (
          <List>
            {templates.map(template => (
              <ListItem
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                sx={{
                  mb: 1,
                  border: '1px solid',
                  borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: selectedTemplate === template.id ? alpha('#2196f3', 0.05) : 'transparent',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: alpha('#2196f3', 0.08)
                  }
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {template.name}
                      </Typography>
                      {selectedTemplate === template.id && (
                        <CheckCircle sx={{ fontSize: 18, color: 'primary.main' }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {template.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {template.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${template.fileColumns.length} columns`}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        <Chip
                          label={format(template.createdAt, 'MM/dd/yyyy')}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {template.lastUsed && (
                          <Chip
                            label={`Used ${format(template.lastUsed, 'MM/dd/yyyy')}`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(template.id);
                    }}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
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
              variant="outlined"
              startIcon={<FileUpload />}
              fullWidth
            >
              Import
            </Button>
          </label>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            disabled={templates.length === 0}
            sx={{ flex: 1 }}
          >
            Export
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={!selectedTemplate}
        >
          Apply Template
        </Button>
      </DialogActions>

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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Template?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete this template? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
