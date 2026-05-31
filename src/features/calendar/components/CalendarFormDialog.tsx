import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  TextField,
  Box,
  CircularProgress,
  Typography,
  Switch,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import {
  Image as ImageIcon,
  DeleteOutline as DeleteIcon,
  CalendarMonth as CalendarIcon,
  Edit as EditIcon,
  ArrowForward as ArrowIcon,
  AutoAwesome as SparkIcon,
} from '@mui/icons-material';
import { Calendar } from '../types/calendar';
import { ASSET_CLASSES } from 'features/events/services/instrumentCatalog';
import { ImagePickerDialog, ImageAttribution } from 'components/heroImage';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';

export interface CalendarFormData {
  name: string;
  account_balance: number;
  max_daily_drawdown: number;
  weekly_target?: number;
  monthly_target?: number;
  yearly_target?: number;
  risk_per_trade?: number;
  dynamic_risk_enabled?: boolean;
  increased_risk_percentage?: number;
  profit_threshold_percentage?: number;
  hero_image_url?: string;
  hero_image_attribution?: ImageAttribution;
  asset_classes?: string[];
}

interface CalendarFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (calendarData: CalendarFormData) => Promise<void>;
  initialData?: Partial<Calendar>;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
  title: string;
  submitButtonText: string;
}

const NUMERIC_INPUT_REGEX = /^\d*\.?\d*$/;

export const CalendarFormDialog: React.FC<CalendarFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  mode,
  title,
  submitButtonText,
}) => {
  const theme = useTheme();
  const {
    isDark,
    violet, violetSoft, violetSofter, violetBorder,
    surfaceInset, hairline,
    paperSx, headerSx, iconAvatarSx, footerSx,
    monoLabelSx, monoSectionLabelSx, optionalSx, inputSx,
    primaryButtonSx, ghostButtonSx, chipStyle,
  } = useDialogTokens();

  const [name, setName] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [maxDailyDrawdown, setMaxDailyDrawdown] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [yearlyTarget, setYearlyTarget] = useState('');
  const [riskPerTrade, setRiskPerTrade] = useState('');
  const [dynamicRiskEnabled, setDynamicRiskEnabled] = useState(false);
  const [increasedRiskPercentage, setIncreasedRiskPercentage] = useState('');
  const [profitThresholdPercentage, setProfitThresholdPercentage] = useState('');

  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [heroImageAttribution, setHeroImageAttribution] = useState<ImageAttribution | undefined>(undefined);

  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  const [assetClasses, setAssetClasses] = useState<string[]>([]);

  const toggleAssetClass = (cls: string) =>
    setAssetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    );

  // Extend hook's inputSx with adornment typography styling (used by numericField prefix/suffix).
  const inputSxWithAdornment = {
    ...inputSx,
    '& .MuiInputAdornment-root .MuiTypography-root': {
      fontFamily: MONO_FONT,
      fontSize: '0.78rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
    },
  };
  const sectionLabelSx = monoSectionLabelSx;

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name || '');
      setAccountBalance(initialData.account_balance?.toString() || '');
      setMaxDailyDrawdown(initialData.max_daily_drawdown?.toString() || '');
      setWeeklyTarget(initialData.weekly_target?.toString() || '');
      setMonthlyTarget(initialData.monthly_target?.toString() || '');
      setYearlyTarget(initialData.yearly_target?.toString() || '');
      setRiskPerTrade(initialData.risk_per_trade?.toString() || '');
      setDynamicRiskEnabled(initialData.dynamic_risk_enabled || false);
      setIncreasedRiskPercentage(initialData.increased_risk_percentage?.toString() || '');
      setProfitThresholdPercentage(initialData.profit_threshold_percentage?.toString() || '');
      setHeroImageUrl(initialData.hero_image_url || '');
      setHeroImageAttribution(initialData.hero_image_attribution);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData, mode]);

  const resetForm = () => {
    setName('');
    setAccountBalance('');
    setMaxDailyDrawdown('');
    setWeeklyTarget('');
    setMonthlyTarget('');
    setYearlyTarget('');
    setRiskPerTrade('');
    setDynamicRiskEnabled(false);
    setIncreasedRiskPercentage('');
    setProfitThresholdPercentage('');
    setHeroImageUrl('');
    setHeroImageAttribution(undefined);
    setAssetClasses([]);
  };

  const handleNumericChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value === '' || NUMERIC_INPUT_REGEX.test(value)) setter(value);
    };

  const handleSubmit = async () => {
    if (!name.trim() || !accountBalance.trim() || !maxDailyDrawdown.trim()) return;

    const balance = parseFloat(accountBalance);
    const maxDrawdown = parseFloat(maxDailyDrawdown);
    const weeklyVal = weeklyTarget.trim() ? parseFloat(weeklyTarget) : undefined;
    const monthlyVal = monthlyTarget.trim() ? parseFloat(monthlyTarget) : undefined;
    const yearlyVal = yearlyTarget.trim() ? parseFloat(yearlyTarget) : undefined;
    const riskVal = riskPerTrade.trim() ? parseFloat(riskPerTrade) : undefined;
    const increasedRiskVal = increasedRiskPercentage.trim()
      ? parseFloat(increasedRiskPercentage)
      : undefined;
    const profitThresholdVal = profitThresholdPercentage.trim()
      ? parseFloat(profitThresholdPercentage)
      : undefined;

    if (isNaN(balance) || balance < 0) return;
    if (isNaN(maxDrawdown) || maxDrawdown <= 0) return;
    if (weeklyVal !== undefined && (isNaN(weeklyVal) || weeklyVal < 0)) return;
    if (monthlyVal !== undefined && (isNaN(monthlyVal) || monthlyVal < 0)) return;
    if (yearlyVal !== undefined && (isNaN(yearlyVal) || yearlyVal < 0)) return;
    if (riskVal !== undefined && (isNaN(riskVal) || riskVal <= 0)) return;
    if (increasedRiskVal !== undefined && (isNaN(increasedRiskVal) || increasedRiskVal <= 0)) return;
    if (profitThresholdVal !== undefined && (isNaN(profitThresholdVal) || profitThresholdVal <= 0)) return;

    await onSubmit({
      name: name.trim(),
      account_balance: balance,
      max_daily_drawdown: maxDrawdown,
      weekly_target: weeklyVal,
      monthly_target: monthlyVal,
      yearly_target: yearlyVal,
      risk_per_trade: riskVal,
      dynamic_risk_enabled: dynamicRiskEnabled,
      increased_risk_percentage: increasedRiskVal,
      profit_threshold_percentage: profitThresholdVal,
      hero_image_url: heroImageUrl || undefined,
      hero_image_attribution: heroImageAttribution,
      asset_classes: isEdit ? undefined : assetClasses,
    });
  };

  const handleImageSelect = (imageUrl: string, attribution?: ImageAttribution) => {
    setHeroImageUrl(imageUrl);
    setHeroImageAttribution(attribution);
    setIsImagePickerOpen(false);
  };

  const handleRemoveImage = () => {
    setHeroImageUrl('');
    setHeroImageAttribution(undefined);
  };

  const isEdit = mode === 'edit';
  const isFormValid =
    name.trim() &&
    accountBalance.trim() &&
    maxDailyDrawdown.trim() &&
    (isEdit || assetClasses.length > 0);
  const subtitle = isEdit
    ? 'Update calendar settings, targets, and risk rules'
    : 'Set the rules and rhythm for a new trading calendar';

  const renderLabel = (
    label: string,
    opts: { required?: boolean; optional?: boolean; hint?: string } = {},
  ) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      <Typography sx={monoLabelSx}>
        {label}
        {opts.required && (
          <Box component="span" sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}>
            *
          </Box>
        )}
        {opts.optional && (
          <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>
            · Optional
          </Box>
        )}
      </Typography>
      {opts.hint && (
        <Typography sx={{ fontSize: '0.72rem', color: alpha(theme.palette.text.secondary, 0.85) }}>
          {opts.hint}
        </Typography>
      )}
    </Box>
  );

  const numericField = (
    value: string,
    onChange: React.Dispatch<React.SetStateAction<string>>,
    opts: {
      prefix?: string;
      suffix?: string;
      placeholder?: string;
      size?: 'small' | 'medium';
    } = {},
  ) => (
    <TextField
      value={value}
      onChange={handleNumericChange(onChange)}
      type="number"
      fullWidth
      size={opts.size ?? 'small'}
      placeholder={opts.placeholder}
      disabled={isSubmitting}
      InputProps={{
        startAdornment: opts.prefix ? (
          <Box component="span" sx={{ mr: 1, color: theme.palette.text.secondary }}>
            {opts.prefix}
          </Box>
        ) : undefined,
        endAdornment: opts.suffix ? (
          <Box component="span" sx={{ ml: 1, color: theme.palette.text.secondary }}>
            {opts.suffix}
          </Box>
        ) : undefined,
      }}
      sx={inputSxWithAdornment}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: { sx: paperSx },
      }}
    >
      {/* Header */}
      <Box sx={headerSx}>
        <Box sx={iconAvatarSx}>
          {isEdit ? <EditIcon sx={{ fontSize: 18 }} /> : <CalendarIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}>
            {subtitle}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          ...scrollbarStyles(theme),
          overflowY: 'auto',
          maxHeight: '70vh',
        }}
      >
        {/* Identity */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={sectionLabelSx}>Identity</Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Calendar name', { required: true })}
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoFocus
              size="small"
              placeholder="e.g. Funded Challenge — FTMO 100K"
              disabled={isSubmitting}
              sx={inputSx}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Cover image', { optional: true })}
            {heroImageUrl ? (
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  border: `1px solid ${hairline}`,
                  height: 120,
                  backgroundImage: `url(${heroImageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(to bottom, ${alpha(theme.palette.common.black, 0.05)}, ${alpha(theme.palette.common.black, 0.35)})`,
                  },
                }}
              >
                <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.75 }}>
                  <Tooltip title="Replace image">
                    <IconButton
                      size="small"
                      onClick={() => setIsImagePickerOpen(true)}
                      disabled={isSubmitting}
                      sx={{
                        backgroundColor: alpha(theme.palette.common.black, 0.55),
                        color: '#fff',
                        backdropFilter: 'blur(4px)',
                        '&:hover': { backgroundColor: alpha(theme.palette.common.black, 0.75) },
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove image">
                    <IconButton
                      size="small"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      sx={{
                        backgroundColor: alpha(theme.palette.error.main, 0.9),
                        color: '#fff',
                        '&:hover': { backgroundColor: theme.palette.error.main },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                {heroImageAttribution && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 6,
                      right: 8,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      backgroundColor: alpha(theme.palette.common.black, 0.6),
                      color: '#fff',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 500 }}>
                      📸 {heroImageAttribution.photographer}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                role="button"
                tabIndex={0}
                onClick={() => !isSubmitting && setIsImagePickerOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isSubmitting) setIsImagePickerOpen(true);
                  }
                }}
                sx={{
                  height: 120,
                  borderRadius: 1.5,
                  border: `1px dashed ${alpha(violet, isDark ? 0.45 : 0.35)}`,
                  backgroundColor: violetSofter,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  color: violet,
                  cursor: isSubmitting ? 'default' : 'pointer',
                  transition: 'background-color 150ms ease, border-color 150ms ease',
                  '&:hover': isSubmitting
                    ? undefined
                    : {
                        backgroundColor: violetSoft,
                        borderColor: violetBorder,
                      },
                  '&:focus-visible': {
                    outline: `2px solid ${violet}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <ImageIcon sx={{ fontSize: 22 }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Choose a cover image
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: alpha(theme.palette.text.secondary, 0.85),
                    fontFamily: MONO_FONT,
                  }}
                >
                  Unsplash · landscape
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Capital */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={sectionLabelSx}>Capital</Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {renderLabel(isEdit ? 'Account balance' : 'Initial balance', { required: true })}
              {numericField(accountBalance, setAccountBalance, { prefix: '$', placeholder: '10000' })}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {renderLabel('Max daily drawdown', { required: true })}
              {numericField(maxDailyDrawdown, setMaxDailyDrawdown, { suffix: '%', placeholder: '5' })}
            </Box>
          </Box>
        </Box>

        {/* Assets — create mode only; edit manages instruments via the tag panel */}
        {!isEdit && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography sx={sectionLabelSx}>Assets</Typography>
            {renderLabel('Asset classes you trade', {
              required: true,
              hint: 'Seeds your required Asset tag group',
            })}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {ASSET_CLASSES.map((cls) => {
                const selected = assetClasses.includes(cls);
                return (
                  <Box
                    key={cls}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    onClick={() => !isSubmitting && toggleAssetClass(cls)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isSubmitting) toggleAssetClass(cls);
                      }
                    }}
                    sx={{
                      ...chipStyle(selected),
                      cursor: isSubmitting ? 'default' : 'pointer',
                      pointerEvents: isSubmitting ? 'none' : undefined,
                      '&:focus-visible': { outline: `2px solid ${violet}`, outlineOffset: 2 },
                    }}
                  >
                    {cls}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Targets */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={sectionLabelSx}>Targets</Typography>
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.66rem',
                color: alpha(theme.palette.text.secondary, 0.75),
              }}
            >
              Set to 0 to skip
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {renderLabel('Weekly')}
              {numericField(weeklyTarget, setWeeklyTarget, { suffix: '%', placeholder: '2' })}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {renderLabel('Monthly')}
              {numericField(monthlyTarget, setMonthlyTarget, { suffix: '%', placeholder: '8' })}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {renderLabel('Yearly')}
              {numericField(yearlyTarget, setYearlyTarget, { suffix: '%', placeholder: '100' })}
            </Box>
          </Box>
        </Box>

        {/* Risk */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={sectionLabelSx}>Risk</Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Risk per trade', {
              optional: true,
              hint: 'Percent of balance staked per position',
            })}
            {numericField(riskPerTrade, setRiskPerTrade, { suffix: '%', placeholder: '1' })}
          </Box>

          {riskPerTrade && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                p: 1.75,
                borderRadius: 1.5,
                border: `1px solid ${violetBorder}`,
                backgroundColor: violetSofter,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <SparkIcon sx={{ fontSize: 16, color: violet, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                      Dynamic risk
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.74rem',
                        color: theme.palette.text.secondary,
                        lineHeight: 1.3,
                      }}
                    >
                      Scale up risk after a profit threshold is hit
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={dynamicRiskEnabled}
                  onChange={(e) => setDynamicRiskEnabled(e.target.checked)}
                  disabled={isSubmitting}
                  size="small"
                />
              </Box>

              {dynamicRiskEnabled && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {renderLabel('Profit threshold')}
                    {numericField(profitThresholdPercentage, setProfitThresholdPercentage, {
                      suffix: '%',
                      placeholder: '5',
                    })}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {renderLabel('Increased risk')}
                    {numericField(increasedRiskPercentage, setIncreasedRiskPercentage, {
                      suffix: '%',
                      placeholder: '2',
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={footerSx}>
        <Button
          onClick={() => !isSubmitting && onClose()}
          disabled={isSubmitting}
          sx={ghostButtonSx}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          variant="contained"
          endIcon={
            isSubmitting ? (
              <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
            ) : !isEdit ? (
              <ArrowIcon sx={{ fontSize: 14 }} />
            ) : undefined
          }
          sx={primaryButtonSx}
        >
          {submitButtonText}
        </Button>
      </Box>

      <ImagePickerDialog
        open={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onImageSelect={handleImageSelect}
        title="Choose a cover image for your calendar"
      />
    </Dialog>
  );
};

export default CalendarFormDialog;
