import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Chip,
  alpha,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Help
} from '@mui/icons-material';
import { ColumnMapping, MappingTarget, TradeField } from '../../types/import';
import { TRADE_FIELD_METADATA, getAllTradeFields } from '../../utils/importValidation';
import { getConfidenceLabel } from '../../utils/columnDetection';

interface ColumnMapperProps {
  fileColumns: string[];
  columnMappings: ColumnMapping[];
  sampleData: Array<Record<string, any>>;
  onMappingChange: (fileColumn: string, target: MappingTarget) => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  fileColumns,
  columnMappings,
  sampleData,
  onMappingChange
}) => {
  const theme = useTheme();
  const availableFields = getAllTradeFields();
  const mappedFields = new Set(
    columnMappings
      .filter(m => m.target !== 'ignore' && m.target !== 'create_tag')
      .map(m => m.target as TradeField)
  );

  // Calculate missing and valid columns
  const requiredFields = availableFields.filter(field => TRADE_FIELD_METADATA[field].required);
  const missingFields = requiredFields.filter(field => !mappedFields.has(field));
  const validMappings = columnMappings
    .filter(m => m.target !== 'ignore' && m.target !== 'create_tag')
    .map(m => ({
      fileColumn: m.fileColumn,
      targetField: TRADE_FIELD_METADATA[m.target as TradeField].displayName
    }));

  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return null;

    const label = getConfidenceLabel(confidence);

    switch (label) {
      case 'high':
        return <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'medium':
        return <Warning sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'low':
        return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      default:
        return null;
    }
  };

  const getSampleValues = (fileColumn: string, count: number = 3) => {
    const values = sampleData
      .slice(0, count)
      .map(row => row[fileColumn])
      .filter(v => v !== null && v !== undefined && v !== '')
      .map(v => String(v));

    // Return unique values only
    return Array.from(new Set(values));
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Column Mapping
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Map each file column to a trade field, ignore it, or choose "Create Tag" to convert it to a tag.
      </Typography>
       

      {/* Mapping Summary */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1
        }}
      >
        {missingFields.length > 0 && (
          <Box sx={{ mb: validMappings.length > 0 ? 1.5 : 0 }}>
            <Typography variant="body2" component="span" color="text.secondary">
              Missing columns:{' '}
            </Typography>
            {missingFields.map((field, idx) => (
              <Typography
                key={field}
                variant="body2"
                component="span"
                sx={{
                  fontWeight: 700,
                  color: 'error.main'
                }}
              >
                {TRADE_FIELD_METADATA[field].displayName}
                {idx < missingFields.length - 1 ? ', ' : ''}
              </Typography>
            ))}
          </Box>
        )}

        {validMappings.length > 0 && (
          <Box>
            <Typography variant="body2" component="span" color="text.secondary">
              Valid columns:{' '}
            </Typography>
            {validMappings.map((mapping, idx) => (
              <Typography
                key={mapping.fileColumn}
                variant="body2"
                component="span"
                sx={{
                  fontWeight: 700,
                  color: 'success.main'
                }}
              >
                {mapping.fileColumn} → {mapping.targetField}
                {idx < validMappings.length - 1 ? ', ' : ''}
              </Typography>
            ))}
          </Box>
        )}

        {missingFields.length === 0 && validMappings.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No columns mapped yet. Start mapping columns below.
          </Typography>
        )}
      </Box>

      {/* File Columns */}
      <Box>
          <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                File Columns
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                {fileColumns.map(fileColumn => {
                  const mapping = columnMappings.find(m => m.fileColumn === fileColumn);
                  const sampleValues = getSampleValues(fileColumn);

                  return (
                    <Box
                      key={fileColumn}
                      sx={{
                        p: 1.5,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} sx={{  color: 'text.secondary' }}>
                          File Column:
                        </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{flex: 1, mb: 1 }}>
                        {fileColumn}
                      </Typography>
                        {mapping?.autoDetected && mapping.confidence && (
                          <Tooltip title={`${mapping.confidence}% confidence - Auto-detected`}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getConfidenceIcon(mapping.confidence)}
                            </Box>
                          </Tooltip>
                        )}
                      </Box>

                    

                      {sampleValues.length > 0 && (
                        <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Sample data:
                          </Typography>
                          {sampleValues.map((value, idx) => (
                            <Chip
                              key={idx}
                              label={value.length > 20 ? `${value.substring(0, 20)}...` : value}
                              size="small"
                              sx={{
                                mr: 0.5,
                                mb: 0.5,
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: alpha(theme.palette.secondary.main, 0.1)
                              }}
                            />
                          ))}
                        </Box>
                      )}

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Map column "{fileColumn}" to:
                      </Typography>

                      <FormControl fullWidth size="small">
                        <Select
                          value={mapping?.target || 'ignore'}
                          onChange={(e) => onMappingChange(fileColumn, e.target.value as MappingTarget)}
                          sx={{ fontSize: '0.875rem' }}
                        >
                          <MenuItem value="ignore">
                            <em>Ignore this column</em>
                          </MenuItem>
                          <MenuItem value="create_tag">Create Tag from this column</MenuItem>
                          <MenuItem disabled sx={{ opacity: 0.5, fontSize: '0.75rem' }}>
                            ──── Trade Fields ────
                          </MenuItem>
                          {availableFields.map(field => {
                            const metadata = TRADE_FIELD_METADATA[field];
                            const isAlreadyMapped = mappedFields.has(field) && mapping?.target !== field;

                            return (
                              <MenuItem
                                key={field}
                                value={field}
                                disabled={isAlreadyMapped}
                                sx={{ fontSize: '0.875rem' }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                  <Typography variant="body2" sx={{ flex: 1 }}>
                                    {metadata.displayName}
                                  </Typography>
                                  {metadata.required && (
                                    <Chip
                                      label="Required"
                                      size="small"
                                      sx={{
                                        height: 16,
                                        fontSize: '0.65rem',
                                        bgcolor: alpha('#f44336', 0.1),
                                        color: 'error.main'
                                      }}
                                    />
                                  )}
                                  {isAlreadyMapped && (
                                    <Chip
                                      label="Mapped"
                                      size="small"
                                      sx={{
                                        height: 16,
                                        fontSize: '0.65rem',
                                        bgcolor: alpha('#2196f3', 0.1),
                                        color: 'info.main'
                                      }}
                                    />
                                  )}
                                </Box>
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>

                      {mapping?.target && mapping.target !== 'ignore' && mapping.target !== 'create_tag' && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'start', gap: 0.5 }}>
                          <Help sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25 }} />
                          <Typography variant="caption" color="text.secondary">
                            {TRADE_FIELD_METADATA[mapping.target as TradeField].description}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
      </Box>
    </Box>
  );
};
