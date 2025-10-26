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
  const [account_balance, setAccount_balance] = useState('');
  const [max_daily_drawdown, setMax_daily_drawdown] = useState('');
  const [weekly_target, setWeekly_target] = useState('');
  const [monthly_target, setMonthly_target] = useState('');
  const [yearly_target, setYearly_target] = useState('');
  const [risk_per_trade, setRisk_per_trade] = useState('');
  const [dynamic_risk_enabled, setDynamicRiskEnabled] = useState(false);
  const [increased_risk_percentage, setIncreasedRiskPercentage] = useState('');
  const [profit_threshold_percentage, setProfitThresholdPercentage] = useState('');

  // Hero image state
  const [hero_image_url, setHeroImageUrl] = useState<string>('');
  const [hero_image_attribution, setHeroImageAttribution] = useState<ImageAttribution | undefined>(undefined);

  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  // Initialize form with initial data when in edit mode or when initial data is provided, or reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name || '');
        setAccount_balance(initialData.account_balance?.toString() || '');
        setMax_daily_drawdown(initialData.max_daily_drawdown?.toString() || '');
        setWeekly_target(initialData.weekly_target?.toString() || '');
        setMonthly_target(initialData.monthly_target?.toString() || '');
        setYearly_target(initialData.yearly_target?.toString() || '');
        setRisk_per_trade(initialData.risk_per_trade?.toString() || '');
        setDynamicRiskEnabled(initialData.dynamic_risk_enabled || false);
        setIncreasedRiskPercentage(initialData.increased_risk_percentage?.toString() || '');
        setProfitThresholdPercentage(initialData.profit_threshold_percentage?.toString() || '');
        setHeroImageUrl(initialData.hero_image_url || '');
        setHeroImageAttribution(initialData.hero_image_attribution);

      } else {
        // Reset form for create mode without initial data
        resetForm();
      }
    }
  }, [open, initialData, mode]);

  const resetForm = () => {
    setName('');
    setAccount_balance('');
    setMax_daily_drawdown('');
    setWeekly_target('');
    setMonthly_target('');
    setYearly_target('');
    setRisk_per_trade('');
    setDynamicRiskEnabled(false);
    setIncreasedRiskPercentage('');
    setProfitThresholdPercentage('');
    setHeroImageUrl('');
    setHeroImageAttribution(undefined);

  };

  const handleSubmit = async () => {
    if (name.trim() && account_balance.trim() && max_daily_drawdown.trim()) {
      const balance = parseFloat(account_balance);
      const maxDrawdown = parseFloat(max_daily_drawdown);
      const weeklyTargetValue = weekly_target.trim() ? parseFloat(weekly_target) : undefined;
      const monthlyTargetValue = monthly_target.trim() ? parseFloat(monthly_target) : undefined;
      const yearlyTargetValue = yearly_target.trim() ? parseFloat(yearly_target) : undefined;
      const riskPerTradeValue = risk_per_trade.trim() ? parseFloat(risk_per_trade) : undefined;
      const increasedRiskValue = increased_risk_percentage.trim() ? parseFloat(increased_risk_percentage) : undefined;
      const profitThresholdValue = profit_threshold_percentage.trim() ? parseFloat(profit_threshold_percentage) : undefined;

      if (!isNaN(balance) && balance >= 0 && !isNaN(maxDrawdown) && maxDrawdown > 0 &&
          (weeklyTargetValue === undefined || (!isNaN(weeklyTargetValue) && weeklyTargetValue > 0)) &&
          (monthlyTargetValue === undefined || (!isNaN(monthlyTargetValue) && monthlyTargetValue > 0)) &&
          (yearlyTargetValue === undefined || (!isNaN(yearlyTargetValue) && yearlyTargetValue > 0)) &&
          (riskPerTradeValue === undefined || (!isNaN(riskPerTradeValue) && riskPerTradeValue > 0)) &&
          (increasedRiskValue === undefined || (!isNaN(increasedRiskValue) && increasedRiskValue > 0)) &&
          (profitThresholdValue === undefined || (!isNaN(profitThresholdValue) && profitThresholdValue > 0))) {

        await onSubmit({
          name: name.trim(),
          account_balance: balance,
          max_daily_drawdown: maxDrawdown,
          weekly_target: weeklyTargetValue,
          monthly_target: monthlyTargetValue,
          yearly_target: yearlyTargetValue,
          risk_per_trade: riskPerTradeValue,
          dynamic_risk_enabled,
          increased_risk_percentage: increasedRiskValue,
          profit_threshold_percentage: profitThresholdValue,
          hero_image_url: hero_image_url || undefined,
          hero_image_attribution: hero_image_attribution,

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



  const isFormValid = name.trim() && account_balance.trim() && max_daily_drawdown.trim();

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

            {hero_image_url ? (
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
                    backgroundImage: `url(${hero_image_url})`,
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
                {hero_image_attribution && (
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
                      📸 {hero_image_attribution.photographer}
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
            value={account_balance}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAccount_balance(value);
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
            value={max_daily_drawdown}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setMax_daily_drawdown(value);
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
            value={weekly_target}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setWeekly_target(value);
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
            value={monthly_target}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setMonthly_target(value);
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
            value={yearly_target}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setYearly_target(value);
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
            value={risk_per_trade}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setRisk_per_trade(value);
              }
            }}
            type="number"
            InputProps={{
              endAdornment: <Box component="span" sx={{ ml: 1 }}>%</Box>
            }}
            helperText="Percentage of account balance to risk per trade (optional)"
          />

          {risk_per_trade && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Dynamic Risk Settings
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={dynamic_risk_enabled}
                    onChange={(e) => setDynamicRiskEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Dynamic Risk"
                sx={{ mb: 1.5 }}
              />

              {dynamic_risk_enabled && (
                <Stack spacing={2}>
                  <TextField
                    label="Profit Threshold (%)"
                    fullWidth
                    value={profit_threshold_percentage}
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
                    value={increased_risk_percentage}
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
