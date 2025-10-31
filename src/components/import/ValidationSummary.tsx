import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  alpha,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  SwapHoriz
} from '@mui/icons-material';
import { ValidationSummary as ValidationSummaryType } from '../../types/import';

interface ValidationSummaryProps {
  summary: ValidationSummaryType;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ summary }) => {
  const {
    totalRows,
    validRows,
    rowsWithWarnings,
    rowsWithErrors,
    willImport,
    conversions
  } = summary;

  const validPercentage = totalRows > 0 ? (validRows / totalRows) * 100 : 0;

  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Validation Summary
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Valid Rows
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {validRows} / {totalRows} ({validPercentage.toFixed(0)}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={validPercentage}
            sx={{
              height: 8,
              borderRadius: 1,
              bgcolor: alpha('#f44336', 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: validPercentage >= 80 ? 'success.main' : validPercentage >= 50 ? 'warning.main' : 'error.main',
                borderRadius: 1
              }
            }}
          />
        </Box>

        <List dense disablePadding>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Valid rows</Typography>
                  <Chip
                    label={validRows}
                    size="small"
                    sx={{
                      bgcolor: alpha('#4caf50', 0.1),
                      color: 'success.main',
                      fontWeight: 600
                    }}
                  />
                </Box>
              }
            />
          </ListItem>

          {rowsWithWarnings > 0 && (
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Rows with warnings</Typography>
                    <Chip
                      label={rowsWithWarnings}
                      size="small"
                      sx={{
                        bgcolor: alpha('#ff9800', 0.1),
                        color: 'warning.main',
                        fontWeight: 600
                      }}
                    />
                  </Box>
                }
              />
            </ListItem>
          )}

          {rowsWithErrors > 0 && (
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Rows with errors</Typography>
                    <Chip
                      label={rowsWithErrors}
                      size="small"
                      sx={{
                        bgcolor: alpha('#f44336', 0.1),
                        color: 'error.main',
                        fontWeight: 600
                      }}
                    />
                  </Box>
                }
              />
            </ListItem>
          )}

          {conversions.length > 0 && (
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <SwapHoriz sx={{ color: 'info.main', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Type conversions</Typography>
                    <Chip
                      label={conversions.length}
                      size="small"
                      sx={{
                        bgcolor: alpha('#2196f3', 0.1),
                        color: 'info.main',
                        fontWeight: 600
                      }}
                    />
                  </Box>
                }
              />
            </ListItem>
          )}
        </List>

        {conversions.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Conversions:
            </Typography>
            {conversions.map((conversion, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 0.5,
                  p: 0.5,
                  bgcolor: alpha('#2196f3', 0.05),
                  borderRadius: 0.5
                }}
              >
                <Info sx={{ fontSize: 16, color: 'info.main' }} />
                <Typography variant="caption" color="text.secondary">
                  {conversion.affectedRows} {conversion.field} values: {conversion.fromType} → {conversion.toType}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Will import:
          </Typography>
          <Chip
            label={`${willImport} trades`}
            size="small"
            color="primary"
            sx={{ fontWeight: 600 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};
