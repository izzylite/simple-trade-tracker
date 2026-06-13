import React from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Chip,
  alpha,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  ErrorOutline as ErrorIcon,
  HelpOutline as HelpIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { ColumnMapping, MappingTarget, TradeField } from '../../types/import';
import {
  TRADE_FIELD_METADATA,
  getAllTradeFields,
} from '../../utils/importValidation';
import { getConfidenceLabel } from '../../utils/columnDetection';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { Z_INDEX } from 'styles/zIndex';

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
  onMappingChange,
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
    monoSectionLabelSx,
  } = useDialogTokens();

  const availableFields = getAllTradeFields();
  const mappedFields = new Set(
    columnMappings
      .filter((m) => m.target !== 'ignore' && m.target !== 'create_tag')
      .map((m) => m.target as TradeField),
  );

  const requiredFields = availableFields.filter(
    (f) => TRADE_FIELD_METADATA[f].required,
  );
  const missingFields = requiredFields.filter((f) => !mappedFields.has(f));
  const validCount = columnMappings.filter(
    (m) => m.target !== 'ignore' && m.target !== 'create_tag',
  ).length;
  const autoCount = columnMappings.filter(
    (m) =>
      m.autoDetected &&
      m.target !== 'ignore' &&
      m.target !== 'create_tag',
  ).length;

  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return null;
    const label = getConfidenceLabel(confidence);
    const size = 13;
    if (label === 'high') return <CheckCircle sx={{ fontSize: size, color: 'success.main' }} />;
    if (label === 'medium') return <Warning sx={{ fontSize: size, color: 'warning.main' }} />;
    return <ErrorIcon sx={{ fontSize: size, color: 'error.main' }} />;
  };

  const getSampleValues = (fileColumn: string, count = 3) => {
    const values = sampleData
      .slice(0, count)
      .map((row) => row[fileColumn])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => String(v));
    return Array.from(new Set(values));
  };

  // Compact source pill — matches the landing-page import dialog mock.
  const sourcePillSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    bgcolor: surfaceInset,
    border: `1px solid ${hairline}`,
    borderRadius: 1,
    px: 1.25,
    py: 0.75,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  };

  // Compact status banner: "X of Y matched · Z auto-detected"
  const matchedCopy = `${validCount} of ${fileColumns.length} matched`;
  const autoCopy = autoCount > 0 ? `${autoCount} auto-detected` : null;

  return (
    <Box>
      {/* Status strip — folds the bulky summary into one tight row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: 1.5,
          py: 1,
          mb: 1.5,
          borderRadius: 1.25,
          border: `1px solid ${hairline}`,
          backgroundColor: surfaceInset,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontFeatureSettings: "'tnum' on, 'lnum' on",
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              color: theme.palette.text.primary,
            }}
          >
            {matchedCopy}
          </Typography>
          {autoCopy && (
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.7rem',
                color: violet,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}
            >
              · {autoCopy}
            </Typography>
          )}
        </Box>
        {missingFields.length > 0 && (
          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontSize: '0.7rem',
              color: theme.palette.error.main,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}
          >
            Missing: {missingFields.map((f) => TRADE_FIELD_METADATA[f].displayName).join(', ')}
          </Typography>
        )}
      </Box>

      {/* Column header strip */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 24px 1fr 20px',
          gap: { xs: 1, sm: 1.25 },
          px: 1.5,
          pb: 0.5,
        }}
      >
        <Typography sx={monoSectionLabelSx}>Your column</Typography>
        <Box />
        <Typography sx={monoSectionLabelSx}>JournoTrades field</Typography>
        <Box />
      </Box>

      {/* Mapping rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
        {fileColumns.map((fileColumn) => {
          const mapping = columnMappings.find((m) => m.fileColumn === fileColumn);
          const sampleValues = getSampleValues(fileColumn);
          const target = mapping?.target || 'ignore';
          const isMapped = target !== 'ignore' && target !== 'create_tag';
          const isTag = target === 'create_tag';
          const isAuto = !!mapping?.autoDetected && isMapped;

          // Target field styling: violet-tinted when mapped to a real field,
          // dashed/dim when ignored, soft-violet when "create_tag".
          const selectBg = isMapped
            ? violetSofter
            : isTag
              ? alpha(theme.palette.info.main, 0.06)
              : 'transparent';
          const selectBorder = isMapped
            ? `1px solid ${violetBorder}`
            : isTag
              ? `1px solid ${alpha(theme.palette.info.main, 0.3)}`
              : `1px dashed ${hairline}`;
          const selectColor = isMapped
            ? theme.palette.text.primary
            : alpha(theme.palette.text.primary, 0.55);

          return (
            <Box
              key={fileColumn}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 24px 1fr 20px',
                gap: { xs: 1, sm: 1.25 },
                alignItems: 'center',
                px: 1.5,
                py: 0.5,
                borderRadius: 1.25,
                transition: 'background-color 120ms ease',
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.02)'
                    : alpha(theme.palette.text.primary, 0.02),
                },
              }}
            >
              {/* Source column pill + sample data */}
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={sourcePillSx}>{fileColumn}</Box>
                  {isAuto && mapping?.confidence && (
                    <Tooltip
                      title={`${mapping.confidence}% confidence · auto-detected`}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getConfidenceIcon(mapping.confidence)}
                      </Box>
                    </Tooltip>
                  )}
                </Box>
                {sampleValues.length > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.4,
                      mt: 0.5,
                      pl: 0.25,
                    }}
                  >
                    {sampleValues.map((value, idx) => (
                      <Chip
                        key={idx}
                        label={value.length > 18 ? `${value.slice(0, 18)}…` : value}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontFamily: MONO_FONT,
                          color: alpha(theme.palette.text.secondary, 0.85),
                          bgcolor: 'transparent',
                          border: `1px solid ${hairline}`,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Arrow — violet when row is actively mapped */}
              <Box
                aria-hidden
                sx={{
                  color: isMapped ? violet : alpha(theme.palette.text.secondary, 0.35),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowIcon sx={{ fontSize: 16 }} />
              </Box>

              {/* Target field selector */}
              <Box sx={{ minWidth: 0 }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={target}
                    onChange={(e) =>
                      onMappingChange(fileColumn, e.target.value as MappingTarget)
                    }
                    variant="outlined"
                    MenuProps={{
                      sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                      PaperProps: {
                        sx: {
                          maxHeight: 360,
                          borderRadius: 1.25,
                          border: `1px solid ${hairline}`,
                          boxShadow: theme.shadows[12],
                          backgroundImage: 'none',
                        },
                      },
                    }}
                    sx={{
                      fontFamily: MONO_FONT,
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: selectColor,
                      bgcolor: selectBg,
                      borderRadius: 1,
                      fontStyle: isMapped ? 'normal' : 'italic',
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: selectBorder,
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: alpha(violet, 0.5),
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: violet,
                        borderWidth: 1,
                      },
                      '& .MuiSelect-select': {
                        py: 0.75,
                        pl: 1.25,
                        pr: 3,
                      },
                    }}
                  >
                    <MenuItem value="ignore" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                      Ignore this column
                    </MenuItem>
                    <MenuItem value="create_tag" sx={{ fontSize: '0.8rem' }}>
                      Create tag from this column
                    </MenuItem>
                    <MenuItem
                      disabled
                      sx={{
                        opacity: 0.5,
                        fontSize: '0.66rem',
                        fontFamily: MONO_FONT,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      ─── Trade fields ───
                    </MenuItem>
                    {availableFields.map((field) => {
                      const metadata = TRADE_FIELD_METADATA[field];
                      const isAlreadyMapped =
                        mappedFields.has(field) && mapping?.target !== field;
                      return (
                        <MenuItem
                          key={field}
                          value={field}
                          disabled={isAlreadyMapped}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              width: '100%',
                            }}
                          >
                            <Typography sx={{ flex: 1, fontSize: '0.8rem' }}>
                              {metadata.displayName}
                            </Typography>
                            {metadata.required && (
                              <Chip
                                label="Required"
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  bgcolor: alpha(theme.palette.error.main, 0.1),
                                  color: theme.palette.error.main,
                                  '& .MuiChip-label': { px: 0.6 },
                                }}
                              />
                            )}
                            {isAlreadyMapped && (
                              <Chip
                                label="Mapped"
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  bgcolor: violetSoft,
                                  color: violet,
                                  '& .MuiChip-label': { px: 0.6 },
                                }}
                              />
                            )}
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                {isMapped && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      mt: 0.5,
                      pl: 0.25,
                    }}
                  >
                    <HelpIcon
                      sx={{
                        fontSize: 12,
                        color: alpha(theme.palette.text.secondary, 0.6),
                        mt: '2px',
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        color: alpha(theme.palette.text.secondary, 0.75),
                        lineHeight: 1.4,
                      }}
                    >
                      {TRADE_FIELD_METADATA[target as TradeField].description}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Status tick — green when mapped, hollow when not */}
              <Box
                aria-label={isMapped ? 'mapped' : 'awaiting assignment'}
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1.5px solid ${
                    isMapped
                      ? theme.palette.success.main
                      : alpha(theme.palette.text.secondary, 0.3)
                  }`,
                  color: isMapped ? theme.palette.success.main : 'transparent',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  justifySelf: 'center',
                }}
              >
                ✓
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
