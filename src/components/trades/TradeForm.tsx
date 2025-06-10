import React, { useMemo } from 'react';
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
  useTheme
} from '@mui/material';
import { DatePicker} from '@mui/x-date-pickers';
import { Trade } from '../../types/trade';
import { FormField } from '../StyledComponents';
import ImageUploader from './ImageUploader';
import { GridImage, GridPendingImage } from './ImageGrid';
import { formatCurrency } from '../../utils/formatters';
import TagsInput from './TagsInput';
import { isGroupedTag, getTagGroup } from '../../utils/tagColors';
import { DynamicRiskSettings } from '../../utils/dynamicRiskUtils';

export interface NewTradeForm {
  id: string;
  name: string;
  amount: string;
  type: 'win' | 'loss' | 'breakeven';
  entry: string;
  exit: string;
  date?: Date | null;
  tags: string[];
  riskToReward: string;
  partialsTaken: boolean;
  session: 'Asia' | 'London' | 'NY AM' | 'NY PM' | '';
  notes: string;
  pendingImages: Array<PendingImage>;
  uploadedImages: Array<TradeImage>;
  isTemporary?: boolean;
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
  columnWidth?: number; // Width as percentage (0-100)
  uploadProgress?: number;
}

export interface TradeImage {
    url: string;
    id: string;
    calendarId: string;
    pending?: boolean;
    caption?: string;
    width?: number;
    height?: number;
    row?: number;
    column?: number;
    columnWidth?: number; // Width as percentage (0-100)
}
interface TradeFormProps {
  newTrade: NewTradeForm;
  editingTrade: Trade | null;
  allTags: string[];
  isSubmitting: boolean; 
  accountBalance: number;
  dynamicRiskSettings: DynamicRiskSettings;
  calculateCumulativePnl(newTrade?: NewTradeForm): number;
  calculateAmountFromRiskToReward: (rr: number,cumulativePnL: number) => number;
  calendarId: string;
  requiredTagGroups?: string[];
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAmountChange: (amount: string) => void;
  onTypeChange: (e: any) => void;
  onEntryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExitChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRiskToRewardChange: (riskToReward: string) => void;
  onPartialsTakenChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSessionChange: (e: any) => void;
  onNotesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTagsChange: (event: React.SyntheticEvent, newValue: string[]) => void;
  onDateChange?: (date: Date | null) => void;
  onImageUpload: (files: FileList) => void;
  onImageCaptionChange: (index: number, caption: string, isPending: boolean) => void;
  onImageRemove: (index: number, isPending: boolean) => void;
  onImagesReordered?: (images: Array<GridImage | GridPendingImage>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const TradeForm: React.FC<TradeFormProps> = ({
  newTrade,
  editingTrade,
  allTags,
  isSubmitting, 
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
  onSubmit
}) => {
  const theme = useTheme();

  // Calculate which required tag groups are still missing
  const missingRequiredGroups = useMemo(() => {
    if (!requiredTagGroups || requiredTagGroups.length === 0) return [];

    // Get the groups that are already satisfied by current tags
    const satisfiedGroups = new Set<string>();
    newTrade.tags.forEach(tag => {
      if (isGroupedTag(tag)) {
        const group = getTagGroup(tag);
        satisfiedGroups.add(group);
      }
    });

    // Return groups that are required but not satisfied
    return requiredTagGroups.filter(group => !satisfiedGroups.has(group));
  }, [requiredTagGroups, newTrade.tags]);

  const cumulativePnl = calculateCumulativePnl(newTrade); 

  // Calculate and update the amount based on risk
  const calculateAmountFromRisk = (): string => {
    if (!dynamicRiskSettings.riskPerTrade || !newTrade.riskToReward) return '';

    const rr = parseFloat(newTrade.riskToReward);
    if (isNaN(rr)) return '';

    const amount = calculateAmountFromRiskToReward(rr, cumulativePnl);

    // Ensure the amount is updated in the form state
    // This is important to make sure the amount is saved correctly
    if (!newTrade.partialsTaken && amount > 0) {
      // Only update if we're not in manual mode and have a valid amount
      setTimeout(() => onAmountChange(amount.toString()), 0);
    }

    return amount.toString();
  };




  const handleRiskToRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onRiskToRewardChange(value)

      // If risk per trade is set and partials are not taken, automatically calculate and update the amount
      if (dynamicRiskSettings.riskPerTrade && value && !newTrade.partialsTaken) {
        const rr = parseFloat(value);
        if (!isNaN(rr)) {
          const calculatedAmount = calculateAmountFromRiskToReward(rr,cumulativePnl);
          onAmountChange(calculatedAmount.toString())
        }
      }
    }
  };


  return (
    <form onSubmit={onSubmit}>
      <FormField>
        <TextField
          label="Trade Name"
          value={newTrade.name}
          onChange={onNameChange}
          fullWidth
          placeholder="Enter a name for this trade"
        />
      </FormField>
      <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Entry Price"
            value={newTrade.entry}
            onChange={onEntryChange}
            fullWidth
            placeholder="Optional entry price"
          />
        </FormField>
        <FormField sx={{ flex: 1 }}>
          <TextField
            label="Exit Price"
            value={newTrade.exit}
            onChange={onExitChange}
            fullWidth
            placeholder="Optional exit price"
          />
        </FormField>
      </Box>

      {/* Date picker - only show when editing a trade */}
      {editingTrade && onDateChange && (
        <FormField>
          <DatePicker
            label="Trade Date"
            value={newTrade.date}
            onChange={onDateChange}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: 'Change the date of this trade'
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
          value={newTrade.type}
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
      {(!dynamicRiskSettings.riskPerTrade || (dynamicRiskSettings.riskPerTrade && newTrade.partialsTaken)) ? (
        <FormField>
          <TextField
            label="Amount"
            type="number"
            value={newTrade.amount}
            onChange={(e) => onAmountChange(e.target.value)}
            fullWidth
            required
            helperText={dynamicRiskSettings.riskPerTrade && newTrade.partialsTaken ? "Manual entry for partial profits" : undefined}
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
            helperText={
              dynamicRiskSettings?.dynamicRiskEnabled &&
                dynamicRiskSettings.increasedRiskPercentage &&
                dynamicRiskSettings.profitThresholdPercentage &&
                (cumulativePnl / accountBalance * 100) >= dynamicRiskSettings.profitThresholdPercentage
                ? `Based on ${dynamicRiskSettings.increasedRiskPercentage}% of account balance (INCREASED from ${dynamicRiskSettings.riskPerTrade}%)`
                : `Based on ${dynamicRiskSettings.riskPerTrade}% of account balance (${formatCurrency((accountBalance * (dynamicRiskSettings.riskPerTrade || 0)) / 100)})`
            }
          />
        </FormField>
      )}


      {dynamicRiskSettings.riskPerTrade !== undefined && (
        <FormField>
          <MuiFormControlLabel
            control={
              <Checkbox
                checked={newTrade.partialsTaken}
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
          value={newTrade.riskToReward}
          onChange={handleRiskToRewardChange}
          fullWidth
          type="number"
          sx={{
            '& input': { min: 0, step: 0.1 }
          }}
        />
      </FormField>
      <FormField>
        <FormControl fullWidth>
          <InputLabel id="session-label">Session</InputLabel>
          <Select
            labelId="session-label"
            value={newTrade.session}
            onChange={onSessionChange}
            label="Session"
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
          allTags={allTags}
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
        console.log("TradeForm rendering with images:",
          "Pending:", newTrade.pendingImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })),
          "Uploaded:", newTrade.uploadedImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })));
        return null;
      })()} */}

      <ImageUploader
        pendingImages={newTrade.pendingImages}
        uploadedImages={newTrade.uploadedImages}
        editingTrade={editingTrade !== null}
        onImageUpload={onImageUpload}
        onImageCaptionChange={onImageCaptionChange}
        onImageRemove={onImageRemove}
        onImagesReordered={onImagesReordered}
      />

      <FormField>
        <TextField
          label="Notes"
          value={newTrade.notes}
          onChange={onNotesChange}
          fullWidth
          multiline
          minRows={4}
          maxRows={20} // Large number to effectively disable scrolling
          sx={{
            '& .MuiInputBase-root': { overflow: 'visible' }, // Prevent scrollbars
            '& .MuiOutlinedInput-root': { overflow: 'visible' } // Ensure outline doesn't clip
          }}
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
