import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Collapse,
  IconButton,
  alpha,
  Tooltip
} from '@mui/material';
import {
  SwapHoriz,
  ExpandMore,
  ExpandLess,
  Info
} from '@mui/icons-material';
import { TypeConversion } from '../../types/import';
import { TRADE_FIELD_METADATA } from '../../utils/importValidation';

interface TypeConverterPanelProps {
  conversions: TypeConversion[];
}

export const TypeConverterPanel: React.FC<TypeConverterPanelProps> = ({ conversions }) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (conversions.length === 0) {
    return null;
  }

  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SwapHoriz sx={{ color: 'info.main' }} />
          <Typography variant="h6">
            Type Conversions
          </Typography>
          <Chip
            label={conversions.length}
            size="small"
            color="info"
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The following data type conversions will be applied during import:
        </Typography>

        <List disablePadding>
          {conversions.map((conversion, index) => {
            const isExpanded = expandedIndex === index;
            const fieldMetadata = TRADE_FIELD_METADATA[conversion.field];

            return (
              <ListItem
                key={index}
                disablePadding
                sx={{
                  mb: 1,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  bgcolor: alpha('#2196f3', 0.05),
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: alpha('#2196f3', 0.2),
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1.5,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: alpha('#2196f3', 0.08)
                    }
                  }}
                  onClick={() => handleToggleExpand(index)}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {fieldMetadata.displayName}
                      </Typography>
                      <Chip
                        label={`${conversion.affectedRows} rows`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: alpha('#2196f3', 0.15),
                          color: 'info.main'
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={conversion.fromType}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          borderColor: alpha('#666', 0.3)
                        }}
                      />
                      <SwapHoriz sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Chip
                        label={conversion.toType}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          bgcolor: alpha('#4caf50', 0.1),
                          color: 'success.main',
                          border: '1px solid',
                          borderColor: alpha('#4caf50', 0.3)
                        }}
                      />
                      {conversion.warnings > 0 && (
                        <Tooltip title={`${conversion.warnings} warnings`}>
                          <Chip
                            label={`⚠ ${conversion.warnings}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              bgcolor: alpha('#ff9800', 0.1),
                              color: 'warning.main'
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  <IconButton
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Collapse in={isExpanded} timeout="auto">
                  <Box sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                    <Box
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'start', gap: 1, mb: 1 }}>
                        <Info sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                        <Typography variant="caption" color="text.secondary">
                          {fieldMetadata.description}
                        </Typography>
                      </Box>

                      {conversion.examples.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                            Example conversions:
                          </Typography>
                          {conversion.examples.map((example, exIndex) => (
                            <Box
                              key={exIndex}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 0.5,
                                p: 0.75,
                                bgcolor: alpha('#000', 0.02),
                                borderRadius: 0.5,
                                fontSize: '0.75rem'
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontFamily: 'monospace',
                                  px: 0.75,
                                  py: 0.25,
                                  bgcolor: alpha('#f44336', 0.1),
                                  color: 'error.dark',
                                  borderRadius: 0.5
                                }}
                              >
                                {String(example.original)}
                              </Typography>
                              <SwapHoriz sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  fontFamily: 'monospace',
                                  px: 0.75,
                                  py: 0.25,
                                  bgcolor: alpha('#4caf50', 0.1),
                                  color: 'success.dark',
                                  borderRadius: 0.5
                                }}
                              >
                                {typeof example.converted === 'object'
                                  ? JSON.stringify(example.converted)
                                  : String(example.converted)}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </ListItem>
            );
          })}
        </List>

        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: alpha('#2196f3', 0.05),
            borderRadius: 1,
            border: '1px solid',
            borderColor: alpha('#2196f3', 0.2)
          }}
        >
          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> All conversions are automatic and will be applied when you import the data.
            If any conversion fails, that row will be marked with an error.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
