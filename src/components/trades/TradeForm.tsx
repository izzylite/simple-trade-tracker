import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  InputLabel,
  Box,
  FormControlLabel as MuiFormControlLabel,
  Checkbox,
  Typography,
  Chip,
  alpha,
  useTheme,
  Autocomplete,
  Button,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Trade, TradeEconomicEvent } from '../../types/dualWrite';
import { FormField } from '../StyledComponents';
import ImageUploader from './ImageUploader';
import { GridImage, GridPendingImage } from './ImageGrid';
import { formatCurrency } from '../../utils/formatters';
import TagsInput from './TagsInput';
import { isGroupedTag, getTagGroup } from '../../utils/tagColors';
import { DynamicRiskSettings } from '../../utils/dynamicRiskUtils';
import RichTextEditor from '../common/RichTextEditor';
import { fetchAndGenerateTradeNameSuggestions } from '../../utils/tradeNameSuggestions';
import { Currency } from '../../types/economicCalendar';
import { CURRENCY_PAIRS } from '../../services/tradeEconomicEventService';
import { Z_INDEX } from '../../styles/zIndex';

export const DEFAULT_PAIRS_TAG_GROUP ="Pairs"
export interface NewTradeForm {
  id: string;
  name: string;
  trade_type: 'win' | 'loss' | 'breakeven';
  amount: number;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  take_profit: number;
  risk_to_reward: number;
  trade_date?: Date | null;
  tags: string[]; 
  partials_taken: boolean;
  session: 'Asia' | 'London' | 'NY AM' | 'NY PM' | '';
  notes: string;
  pending_images: Array<PendingImage>;
  uploaded_images: Array<TradeImage>;
  is_temporary?: boolean;
  economic_events?: TradeEconomicEvent[];
}

export interface PendingImage {
  id?: string;
  file: File;
  preview: string;
  caption?: string;
  width?: number;
  height?: number;
  row?: number;
  column?: number;
  column_width?: number; // Width as percentage (0-100)
}

export interface TradeImage {
  url: string;
  id: string;
  calendar_id: string;
  pending?: boolean;
  caption?: string;
  width?: number;
  height?: number;
  row?: number;
  column?: number;
  column_width?: number; // Width as percentage (0-100)
}
interface TradeFormProps {
  newTrade: NewTradeForm;
  editingTrade: Trade | null;
  allTags: string[];
  isSubmitting: boolean;
  isLoadingPrecalculatedValues?: boolean;
  accountBalance: number;
  dynamicRiskSettings: DynamicRiskSettings;
  calculateCumulativePnl(newTrade?: NewTradeForm): number;
  calculateAmountFromRiskToReward: (rr: number, cumulativePnL: number) => number;
  calendarId: string;
  requiredTagGroups?: string[];
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAmountChange: (amount: number) => void;
  onTypeChange: (e: any) => void;
  onEntryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExitChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStopLossChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTakeProfitChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRiskToRewardChange: (risk_to_reward: number) => void;
  onPartialsTakenChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSessionChange: (e: any) => void;
  onNotesChange: (value: string) => void;
  onTagsChange: (event: React.SyntheticEvent, newValue: string[]) => void;
  onDateChange?: (trade_date: Date | null) => void;
  onImageUpload: (files: FileList) => void;
  onImageCaptionChange: (index: number, caption: string, isPending: boolean) => void;
  onImageRemove: (index: number, isPending: boolean) => void;
  onImagesReordered?: (images: Array<GridImage | GridPendingImage>) => void;
  onSubmit: (e: React.FormEvent) => void;
  // Optional props for trade link navigation in notes
  trades?: Array<{ id: string;[key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({
  newTrade,
  editingTrade,
  allTags,
  isSubmitting,
  isLoadingPrecalculatedValues = false,
  accountBalance,
  dynamicRiskSettings,
  calculateAmountFromRiskToReward,
  calculateCumulativePnl,
  calendarId,
  requiredTagGroups = [],
  onTagUpdated,
  onNameChange,
  onAmountChange,
  onTypeChange,
  onEntryChange,
  onExitChange,
  onStopLossChange,
  onTakeProfitChange,
  onRiskToRewardChange,
  onPartialsTakenChange,
  onSessionChange,
  onNotesChange,
  onTagsChange,
  onDateChange,
  onImageUpload,
  onImageCaptionChange,
  onImageRemove,
  onImagesReordered,
  onSubmit,
  trades,
  onOpenGalleryMode
}) => {
  const theme = useTheme();

  // State for trade name suggestions
  const [tradeNameSuggestions, setTradeNameSuggestions] = useState<string[]>([]);

  // Fetch and generate trade name suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!calendarId) return;

      const suggestions = await fetchAndGenerateTradeNameSuggestions(
        calendarId,
        newTrade.tags,
        newTrade.session || undefined,
        newTrade.name,
        8
      );
      setTradeNameSuggestions(suggestions);
    };

    fetchSuggestions();
  }, [calendarId, newTrade.tags, newTrade.session, newTrade.name]);

  const tagsWithPairs = useMemo(() => {
    return Array.from(new Set([...allTags, ...CURRENCY_PAIRS.map(pair => `${DEFAULT_PAIRS_TAG_GROUP}:${pair}`)]));
  }, [allTags]);

  // Automatically add "pair" to required tag groups if not already present
  const effectiveRequiredTagGroups = useMemo(() => {
    const groups = [...requiredTagGroups];
    if (!groups.includes(DEFAULT_PAIRS_TAG_GROUP)) {
      groups.push(DEFAULT_PAIRS_TAG_GROUP);
    }
    return groups;
  }, [requiredTagGroups]);

  // Calculate which required tag groups are still missing
  const missingRequiredGroups = useMemo(() => {
    if (!effectiveRequiredTagGroups || effectiveRequiredTagGroups.length === 0) return [];

    // Get the groups that are already satisfied by current tags
    const satisfiedGroups = new Set<string>();
    newTrade.tags.forEach(tag => {
      if (isGroupedTag(tag)) {
        const group = getTagGroup(tag);
        satisfiedGroups.add(group);
      }
    });

    // Return groups that are required but not satisfied
    return effectiveRequiredTagGroups.filter(group => !satisfiedGroups.has(group));
  }, [effectiveRequiredTagGroups, newTrade.tags]);

  const cumulativePnl = calculateCumulativePnl(newTrade);

 

  // Calculate and update the amount based on risk
  const calculateAmountFromRisk = (): number => {
    if (!dynamicRiskSettings.risk_per_trade || !newTrade.risk_to_reward) return 0;

    const rr = newTrade.risk_to_reward;
    if (isNaN(rr)) return 0;

    const amount = calculateAmountFromRiskToReward(rr, cumulativePnl);

    // Ensure the amount is updated in the form state
    // This is important to make sure the amount is saved correctly
    if (!newTrade.partials_taken && amount > 0) {
      // Only update if we're not in manual mode and have a valid amount
      setTimeout(() => onAmountChange(amount), 0);
    }

    return amount;
  };


  const handleRiskToRewardChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const numValue = value === '' ? 0 : parseFloat(value);
      onRiskToRewardChange(numValue)

      // If risk per trade is set and partials are not taken, automatically calculate and update the amount
      if (dynamicRiskSettings.risk_per_trade && numValue && !newTrade.partials_taken) {
        if (!isNaN(numValue)) {
          const calculatedAmount = calculateAmountFromRiskToReward(numValue, cumulativePnl);
          onAmountChange(calculatedAmount)
        }
      }
    }
  }, [onRiskToRewardChange, dynamicRiskSettings.risk_per_trade, newTrade.partials_taken, cumulativePnl, onAmountChange]);


  return (
    <form onSubmit={onSubmit}>
      <FormField>
        <Autocomplete
          freeSolo
          options={tradeNameSuggestions}
          value={newTrade.name}
          onInputChange={(event, newValue) => {
            // Create a synthetic event for compatibility with existing handler
            const syntheticEvent = {
              target: { value: newValue || '' }
            } as React.ChangeEvent<HTMLInputElement>;
            onNameChange(syntheticEvent);
          }}
          slotProps={{
            popper: {
              sx: { zIndex: Z_INDEX.DIALOG_POPUP }
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Trade Name"
              placeholder="Enter a name for this trade"
              fullWidth
            />
          )}
          renderOption={(props, option) => {
            const { key, ...otherProps } = props;
            return (
              <Box component="li" key={key} {...otherProps}>
                <Typography variant="body2">{option}</Typography>
              </Box>
            );
          }}
          sx={{
            '& .MuiAutocomplete-option': {
              fontSize: '0.875rem',
            }
          }}
        />
      </FormField>
      <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Entry Price"
            value={newTrade.entry_price == 0? undefined : newTrade.entry_price}
            onChange={onEntryChange}
            fullWidth
            placeholder="Optional entry price"
          />
        </FormField>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Exit Price"
            value={newTrade.exit_price == 0? undefined : newTrade.exit_price}
            onChange={onExitChange}
            fullWidth
            placeholder="Optional exit price"
          />
        </FormField>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Stop Loss"
            value={newTrade.stop_loss == 0? undefined : newTrade.stop_loss}
            onChange={onStopLossChange}
            fullWidth
            placeholder="Optional stop loss"
          />
        </FormField>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Take Profit"
            value={newTrade.take_profit == 0? undefined : newTrade.take_profit}
            onChange={onTakeProfitChange}
            fullWidth
            placeholder="Optional take profit"
          />
        </FormField>
      </Box>

      {/* Date picker - only show when editing a trade */}
      {editingTrade && onDateChange && (
        <FormField>
          <DatePicker
            label="Trade Date"
            value={newTrade.trade_date}
            onChange={onDateChange}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: 'Change the date of this trade'
              },
              popper: {
                sx: { zIndex: Z_INDEX.DIALOG_POPUP }
              }
            }}
          />
        </FormField>
      )}
      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <FormLabel component="legend">Trade Type</FormLabel>
        <RadioGroup
          row
          name="type"
          value={newTrade.trade_type}
          onChange={onTypeChange}
        >
          <FormControlLabel
            value="win"
            control={<Radio />}
            label="Win"
          />
          <FormControlLabel
            value="loss"
            control={<Radio />}
            label="Loss"
          />
          <FormControlLabel
            value="breakeven"
            control={<Radio />}
            label="Breakeven"
          />
        </RadioGroup>
      </FormControl>
      {(!dynamicRiskSettings.risk_per_trade || (dynamicRiskSettings.risk_per_trade && newTrade.partials_taken)) ? (
        <FormField>
          <TextField
            label="Amount"
            type="number"
            value={newTrade.amount ==0 ? undefined : newTrade.amount}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            fullWidth
            required
            helperText={dynamicRiskSettings.risk_per_trade && newTrade.partials_taken ? "Manual entry for partial profits" : undefined}
          />
        </FormField>
      ) : (
        <FormField>
          <TextField
            label="Amount (Calculated from Risk)"
            type="number"
            value={calculateAmountFromRisk()}
            sx={{
              '& .MuiInputBase-input': { pointerEvents: 'none' }
            }}
            fullWidth
            disabled
            InputLabelProps={{
              shrink: true
            }}
            InputProps={{
              endAdornment: isLoadingPrecalculatedValues ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : null
            }}
            helperText={
              dynamicRiskSettings?.dynamic_risk_enabled &&
                dynamicRiskSettings.increased_risk_percentage &&
                dynamicRiskSettings.profit_threshold_percentage &&
                (cumulativePnl / accountBalance * 100) >= dynamicRiskSettings.profit_threshold_percentage
                ? `Based on ${dynamicRiskSettings.increased_risk_percentage}% of account balance (INCREASED from ${dynamicRiskSettings.risk_per_trade}%)`
                : `Based on ${dynamicRiskSettings.risk_per_trade}% of account balance (${formatCurrency((accountBalance * (dynamicRiskSettings.risk_per_trade || 0)) / 100)})`
            }
          />
        </FormField>
      )}


      {dynamicRiskSettings.risk_per_trade !== undefined && (
        <FormField>
          <MuiFormControlLabel
            control={
              <Checkbox
                checked={newTrade.partials_taken}
                onChange={onPartialsTakenChange}
              />
            }
            label={
              <Typography variant="body2">
                Partials taken (allows manual amount entry)
              </Typography>
            }
          />
        </FormField>
      )}
      <FormField>
        <TextField
          label="Risk to Reward"
          value={newTrade.risk_to_reward == 0? undefined : newTrade.risk_to_reward}
          onChange={handleRiskToRewardChange}
          fullWidth
          type="number"
          slotProps={{
            htmlInput: { min: 0, step: 0.1 }
          }}
          sx={{
            // Hide number input spinners for Chrome, Safari, Edge, Opera
            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            // Hide number input spinners for Firefox
            '& input[type=number]': {
              MozAppearance: 'textfield',
            },
          }}
        />
      </FormField>
      <FormField>
        <FormControl fullWidth required>
          <InputLabel id="session-label">Session *</InputLabel>
          <Select
            labelId="session-label"
            value={newTrade.session}
            onChange={onSessionChange}
            label="Session *"
            required
            MenuProps={{
              sx: { zIndex: Z_INDEX.DIALOG_POPUP }
            }}
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="Asia">Asia</MenuItem>
            <MenuItem value="London">London</MenuItem>
            <MenuItem value="NY AM">NY AM</MenuItem>
            <MenuItem value="NY PM">NY PM</MenuItem>
          </Select>
        </FormControl>
      </FormField>
      <FormField>
        {/* Required Tag Groups Indicator */}
        {missingRequiredGroups.length > 0 && (
          <Box sx={{
            mb: 2,
            p: 2,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
          }}>
            <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600, mb: 1 }}>
              Required Tag Groups
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Please add at least one tag from each required group:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {missingRequiredGroups.map(group => (
                <Chip
                  key={group}
                  label={group}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{
                    fontWeight: 500,
                    '& .MuiChip-label': {
                      fontSize: '0.75rem'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

     

        <TagsInput
          tags={newTrade.tags}
          allTags={tagsWithPairs}
          onTagsChange={onTagsChange}
          calendarId={calendarId}
          onTagUpdated={onTagUpdated}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Pro tip: Categorize tags using the format "Category:Tag" (e.g., "Strategy:Breakout", "Setup:Double Top").
          Categorized tags are grouped together in charts, making it easier to filter and analyze your trading patterns
          and identify which strategies and setups are most profitable. Note: Only one colon (:) is allowed per tag.
        </Typography>
      </FormField>


      {/* Debug layout information */}
      {/* {(() => {
        logger.log("TradeForm rendering with images:",
          "Pending:", newTrade.pending_images.map(img => ({ id: img.id, row: img.row, column: img.column, column_width: img.column_width })),
          "Uploaded:", newTrade.uploaded_images.map(img => ({ id: img.id, row: img.row, column: img.column, column_width: img.column_width })));
        return null;
      })()} */}

      <ImageUploader
        pendingImages={newTrade.pending_images}
        uploadedImages={newTrade.uploaded_images}
        editingTrade={editingTrade !== null}
        onImageUpload={onImageUpload}
        onImageCaptionChange={onImageCaptionChange}
        onImageRemove={onImageRemove}
        onImagesReordered={onImagesReordered}
      />

      <FormField>
        <RichTextEditor
          label="Notes"
          value={newTrade.notes}
          onChange={onNotesChange}
          placeholder="Add notes for this trade..."
          minHeight={150}
          maxHeight={400}
          maxLength={1024}
          toolbarVariant="sticky"
          stickyPosition="bottom"
          calendarId={calendarId}
          trades={trades}
          onOpenGalleryMode={onOpenGalleryMode}
        />
      </FormField>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
        <button
          type="submit"
          style={{ display: 'none' }}
          disabled={isSubmitting}
        />
      </Box>
    </form>
  );
};

export default TradeForm;
