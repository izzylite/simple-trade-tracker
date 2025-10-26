import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Stack,
  Box,
  CircularProgress,
  Typography,
  FormControlLabel,
  Switch,
  Card,
  CardMedia,
  IconButton,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import {
  Image as ImageIcon,
  Delete as DeleteIcon,

} from '@mui/icons-material';
import { Calendar } from '../types/calendar';
import { BaseDialog } from './common';
import { ImagePickerDialog, ImageAttribution } from './heroImage';

export interface CalendarFormData {
  name: string;
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;

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

export const CalendarFormDialog: React.FC<CalendarFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  mode,
  title,
  submitButtonText
}) => {
  const theme = useTheme();

  // Form state
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

  // Hero image state
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const [heroImageAttribution, setHeroImageAttribution] = useState<ImageAttribution | undefined>(undefined);

  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  // Initialize form with initial data when in edit mode or when initial data is provided, or reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name || '');
        setAccountBalance(initialData.accountBalance?.toString() || '');
        setMaxDailyDrawdown(initialData.maxDailyDrawdown?.toString() || '');
        setWeeklyTarget(initialData.weeklyTarget?.toString() || '');
        setMonthlyTarget(initialData.monthlyTarget?.toString() || '');
        setYearlyTarget(initialData.yearlyTarget?.toString() || '');
        setRiskPerTrade(initialData.riskPerTrade?.toString() || '');
        setDynamicRiskEnabled(initialData.dynamicRiskEnabled || false);
        setIncreasedRiskPercentage(initialData.increasedRiskPercentage?.toString() || '');
        setProfitThresholdPercentage(initialData.profitThresholdPercentage?.toString() || '');
        setHeroImageUrl(initialData.heroImageUrl || '');
        setHeroImageAttribution(initialData.heroImageAttribution);

      } else {
        // Reset form for create mode without initial data
        resetForm();
      }
    }
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

  };

  const handleSubmit = async () => {
    if (name.trim() && accountBalance.trim() && maxDailyDrawdown.trim()) {
      const balance = parseFloat(accountBalance);
      const maxDrawdown = parseFloat(maxDailyDrawdown);
      const weeklyTargetValue = weeklyTarget.trim() ? parseFloat(weeklyTarget) : undefined;
      const monthlyTargetValue = monthlyTarget.trim() ? parseFloat(monthlyTarget) : undefined;
      const yearlyTargetValue = yearlyTarget.trim() ? parseFloat(yearlyTarget) : undefined;
      const riskPerTradeValue = riskPerTrade.trim() ? parseFloat(riskPerTrade) : undefined;
      const increasedRiskValue = increasedRiskPercentage.trim() ? parseFloat(increasedRiskPercentage) : undefined;
      const profitThresholdValue = profitThresholdPercentage.trim() ? parseFloat(profitThresholdPercentage) : undefined;

      if (!isNaN(balance) && balance >= 0 && !isNaN(maxDrawdown) && maxDrawdown > 0 &&
          (weeklyTargetValue === undefined || (!isNaN(weeklyTargetValue) && weeklyTargetValue > 0)) &&
          (monthlyTargetValue === undefined || (!isNaN(monthlyTargetValue) && monthlyTargetValue > 0)) &&
          (yearlyTargetValue === undefined || (!isNaN(yearlyTargetValue) && yearlyTargetValue > 0)) &&
          (riskPerTradeValue === undefined || (!isNaN(riskPerTradeValue) && riskPerTradeValue > 0)) &&
          (increasedRiskValue === undefined || (!isNaN(increasedRiskValue) && increasedRiskValue > 0)) &&
          (profitThresholdValue === undefined || (!isNaN(profitThresholdValue) && profitThresholdValue > 0))) {

        await onSubmit({
          name: name.trim(),
          accountBalance: balance,
          maxDailyDrawdown: maxDrawdown,
          weeklyTarget: weeklyTargetValue,
          monthlyTarget: monthlyTargetValue,
          yearlyTarget: yearlyTargetValue,
          riskPerTrade: riskPerTradeValue,
          dynamicRiskEnabled,
          increasedRiskPercentage: increasedRiskValue,
          profitThresholdPercentage: profitThresholdValue,
          heroImageUrl: heroImageUrl || undefined,
          heroImageAttribution: heroImageAttribution,

        });
      }
    }
  };

  // Hero image handlers
  const handleImageSelect = (imageUrl: string, attribution?: ImageAttribution) => {
    setHeroImageUrl(imageUrl);
    setHeroImageAttribution(attribution);
    setIsImagePickerOpen(false);
  };

  const handleRemoveImage = () => {
    setHeroImageUrl('');
    setHeroImageAttribution(undefined);

  };



  const isFormValid = name.trim() && accountBalance.trim() && maxDailyDrawdown.trim();

  const dialogTitle = title;

  const dialogActions = (
    <>
      <Button
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        variant="contained"
        disabled={!isFormValid || isSubmitting}
        sx={{
          minWidth: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        {submitButtonText}
        {isSubmitting && (
          <CircularProgress
            size={20}
            color="inherit"
          />
        )}
      </Button>
    </>
  );

  return (
    <BaseDialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      maxWidth="xs"
      fullWidth
      title={dialogTitle}
      actions={dialogActions}
      hideFooterCancelButton={true}
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Calendar Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          {/* Hero Image Section */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              Cover Image (Optional)
            </Typography>

            {heroImageUrl ? (
              <Card sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <CardMedia
                  component="div"
                  sx={{
                    height: 120,
                    backgroundImage: `url(${heroImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `linear-gradient(to bottom, ${alpha(theme.palette.common.black, 0.1)}, ${alpha(theme.palette.common.black, 0.3)})`,
                      zIndex: 1
                    }
                  }}
                />

                {/* Image controls overlay */}
                <Box sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 1,
                  zIndex: 2
                }}>


                  <Tooltip title="Remove image">
                    <IconButton
                      size="small"
                      onClick={handleRemoveImage}
                      sx={{
                        backgroundColor: alpha(theme.palette.error.main, 0.9),
                        color: 'white',
                        '&:hover': {
                          backgroundColor: theme.palette.error.main,
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Attribution */}
                {heroImageAttribution && (
                  <Box sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    backgroundColor: alpha(theme.palette.common.black, 0.7),
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 0.5,
                    zIndex: 2
                  }}>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                      📸 {heroImageAttribution.photographer}
                    </Typography>
                  </Box>
                )}
              </Card>
            ) : (
              <Button
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={() => setIsImagePickerOpen(true)}
                sx={{
                  height: 120,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
                fullWidth
              >
                Add Cover Image
              </Button>
            )}
          </Box>
          <TextField
            label={mode === 'create' ? "Initial Account Balance" : "Account Balance"}
            fullWidth
            value={accountBalance}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAccountBalance(value);
              }
            }}
            type="number"
            InputProps={{
              startAdornment: <Box component="span" sx={{ mr: 1 }}>$</Box>
            }}
          />
          <TextField
            label="Max Daily Drawdown (%)"
            fullWidth
            value={maxDailyDrawdown}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setMaxDailyDrawdown(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Maximum allowed loss percentage per day"
          />
          <TextField
            label="Weekly Target (%)"
            fullWidth
            value={weeklyTarget}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setWeeklyTarget(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Target profit percentage per week"
          />
          <TextField
            label="Monthly Target (%)"
            fullWidth
            value={monthlyTarget}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setMonthlyTarget(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Target profit percentage per month"
          />
          <TextField
            label="Yearly Target (%)"
            fullWidth
            value={yearlyTarget}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setYearlyTarget(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Target profit percentage per year"
          />
          <TextField
            label="Risk Per Trade (%)"
            fullWidth
            value={riskPerTrade}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setRiskPerTrade(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Percentage of account balance to risk per trade (optional)"
          />

          {riskPerTrade && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Dynamic Risk Settings
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={dynamicRiskEnabled}
                    onChange={(e) => setDynamicRiskEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Dynamic Risk"
                sx={{ mb: 1.5 }}
              />

              {dynamicRiskEnabled && (
                <Stack spacing={2}>
                  <TextField
                    label="Profit Threshold (%)"
                    fullWidth
                    value={profitThresholdPercentage}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setProfitThresholdPercentage(value);
                      }
                    }}
                    type="number"
                    InputProps={{
                      endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
                    }}
                    helperText="Increase risk when profit exceeds this percentage"
                    size="small"
                  />

                  <TextField
                    label="Increased Risk (%)"
                    fullWidth
                    value={increasedRiskPercentage}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setIncreasedRiskPercentage(value);
                      }
                    }}
                    type="number"
                    InputProps={{
                      endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
                    }}
                    helperText="New risk percentage when profit threshold is exceeded"
                    size="small"
                  />
                </Stack>
              )}
            </Box>
          )}
        </Stack>

        {/* Image Picker Dialog */}
        <ImagePickerDialog
          open={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          onImageSelect={handleImageSelect}
          title="Choose a cover image for your calendar"
        />
    </BaseDialog>
  );
};

export default CalendarFormDialog;
