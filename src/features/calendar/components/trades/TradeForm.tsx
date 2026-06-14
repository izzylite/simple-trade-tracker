import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  Box,
  FormControlLabel as MuiFormControlLabel,
  Checkbox,
  Typography,
  alpha,
  useTheme,
  Autocomplete,
} from '@mui/material';
import {
  TuneOutlined as TradeTabIcon,
  PhotoLibraryOutlined as ScreenshotsTabIcon,
  NotesOutlined as NotesTabIcon,
} from '@mui/icons-material';
import { useDialogTokens } from 'styles/dialogTokens';
import { getShadow } from 'styles/designTokens';
import { DatePicker } from '@mui/x-date-pickers';
import { Trade, TradeEconomicEvent, PinnedEvent } from '../../types/dualWrite';
import { FormField } from '../StyledComponents';
import ImageUploader from './ImageUploader';
import { GridImage, GridPendingImage } from './ImageGrid';
import { formatCurrency } from 'utils/formatters';
import TagsInput from './TagsInput';
import { isGroupedTag, getTagGroup } from 'utils/tagColors';
import { DynamicRiskSettings } from '../../utils/dynamicRiskUtils';
import RichTextEditor, { RichTextEditorHandle } from 'components/common/RichTextEditor';
import { useTradeLinkInsertion } from 'components/common/RichTextEditor/hooks/useTradeLinkInsertion';
import RoundedTabs, { TabPanel } from 'components/common/RoundedTabs';
import { fetchAndGenerateTradeNameSuggestions } from '../../utils/tradeNameSuggestions';
import { Currency } from 'features/events/types/economicCalendar';
import { Z_INDEX } from 'styles/zIndex';

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
  /** Notes from the calendar — feeds the /note picker inside the notes editor. */
  availableNotes?: Array<{ id: string; title: string; color?: string }>;
  /** Pinned economic events — feeds the /event picker inside the notes editor. */
  availableEvents?: PinnedEvent[];
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
  onOpenGalleryMode,
  availableNotes,
  availableEvents,
}) => {
  const theme = useTheme();
  const {
    isDark,
    violet, surfaceInset, hairline,
    monoLabelSx, inputSx, chipStyle,
  } = useDialogTokens();

  // State for trade name suggestions
  const [tradeNameSuggestions, setTradeNameSuggestions] = useState<string[]>([]);

  // Active tab inside the dialog: 0 = Trade, 1 = Screenshots, 2 = Notes
  const [activeTab, setActiveTab] = useState<number>(0);

  // Editor + trade-link plumbing shared with NoteEditorBody.
  const editorRef = useRef<RichTextEditorHandle>(null);
  // Bumping this on mention/note/event state change forces a re-render so the
  // editor's internal pickers stay positioned correctly.
  const [, setMentionVersion] = useState(0);
  const bumpMention = useCallback(() => setMentionVersion(v => v + 1), []);

  const {
    onInsertTradeLink,
    onSharedTradeClick,
    elements: tradeLinkElements,
  } = useTradeLinkInsertion(editorRef);

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

  /** Mono uppercase field label rendered above an input. */
  const renderLabel = (text: string, required?: boolean) => (
    <Typography sx={monoLabelSx}>
      {text}
      {required && (
        <Box component="span" sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}>
          *
        </Box>
      )}
    </Typography>
  );

  /** Mono caption rendered below an input. */
  const renderHelper = (text: React.ReactNode, tone: 'default' | 'warning' = 'default') => (
    <Typography
      sx={{
        fontSize: '0.74rem',
        color: tone === 'warning' ? theme.palette.warning.main : alpha(theme.palette.text.secondary, 0.85),
        lineHeight: 1.4,
      }}
    >
      {text}
    </Typography>
  );

  /** Trade-type chip used in the segmented control. */
  const tradeTypeOptions: Array<{
    value: 'win' | 'loss' | 'breakeven';
    label: string;
    color: string;
  }> = [
    { value: 'win', label: 'Win', color: theme.palette.success.main },
    { value: 'loss', label: 'Loss', color: theme.palette.error.main },
    { value: 'breakeven', label: 'Breakeven', color: theme.palette.text.secondary },
  ];



  // Calculate and update the amount based on risk
  const calculateAmountFromRisk = (): number => {
    if (!dynamicRiskSettings.risk_per_trade || !newTrade.risk_to_reward) return 0;

    const rr = Number(newTrade.risk_to_reward);
    if (isNaN(rr)) return 0;

    const amount = calculateAmountFromRiskToReward(rr, Number(cumulativePnl));

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


  const numericInputSx = {
    ...inputSx,
    // Hide number input spinners across browsers
    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
    '& input[type=number]': {
      MozAppearance: 'textfield',
    },
  };

  // Badge counts for tabs
  const screenshotCount = newTrade.pending_images.length + newTrade.uploaded_images.length;

  const tabs = [
    { label: 'Trade', icon: <TradeTabIcon sx={{ fontSize: 16 }} /> },
    {
      label: 'Screenshots',
      icon: <ScreenshotsTabIcon sx={{ fontSize: 16 }} />,
      badgeCount: screenshotCount,
    },
    { label: 'Notes', icon: <NotesTabIcon sx={{ fontSize: 16 }} /> },
  ];

  return (
    <form onSubmit={onSubmit}>
      <Box sx={{ mb: 2 }}>
        <RoundedTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(_, v) => setActiveTab(v)}
          size="small"
          fullWidth
        />
      </Box>

      {/* Stable min-height so the dialog doesn't shrink when switching tabs.
          Screenshots & Notes tabs are typically shorter than Trade — the
          fullHeight TabPanels let their empty-state surfaces (drop zone,
          editor) stretch into this floor. */}
      <Box sx={{ minHeight: 460, display: 'flex', flexDirection: 'column' }}>

      <TabPanel value={activeTab} index={0} fullHeight>
      {/* Trade name */}
      <FormField>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Trade name')}
          <Autocomplete
            freeSolo
            options={tradeNameSuggestions}
            value={newTrade.name}
            onInputChange={(event, newValue) => {
              const syntheticEvent = {
                target: { value: newValue || '' },
              } as React.ChangeEvent<HTMLInputElement>;
              onNameChange(syntheticEvent);
            }}
            slotProps={{
              popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="e.g. EURUSD"
                fullWidth
                size="small"
                sx={inputSx}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Typography sx={{ fontSize: '0.875rem' }}>{option}</Typography>
                </Box>
              );
            }}
          />
        </Box>
      </FormField>

      {/* Price grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Entry price')}
          <TextField
            type="number"
            value={newTrade.entry_price === 0 ? '' : newTrade.entry_price}
            onChange={onEntryChange}
            fullWidth
            size="small"
            placeholder="Optional"
            slotProps={{ htmlInput: { step: 0.00001 } }}
            sx={numericInputSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Exit price')}
          <TextField
            type="number"
            value={newTrade.exit_price === 0 ? '' : newTrade.exit_price}
            onChange={onExitChange}
            fullWidth
            size="small"
            placeholder="Optional"
            slotProps={{ htmlInput: { step: 0.00001 } }}
            sx={numericInputSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Stop loss')}
          <TextField
            type="number"
            value={newTrade.stop_loss === 0 ? '' : newTrade.stop_loss}
            onChange={onStopLossChange}
            fullWidth
            size="small"
            placeholder="Optional"
            slotProps={{ htmlInput: { step: 0.00001 } }}
            sx={numericInputSx}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Take profit')}
          <TextField
            type="number"
            value={newTrade.take_profit === 0 ? '' : newTrade.take_profit}
            onChange={onTakeProfitChange}
            fullWidth
            size="small"
            placeholder="Optional"
            slotProps={{ htmlInput: { step: 0.00001 } }}
            sx={numericInputSx}
          />
        </Box>
      </Box>

      {/* Trade date — only when editing */}
      {editingTrade && onDateChange && (
        <FormField>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Trade date')}
            <DatePicker
              value={newTrade.trade_date}
              onChange={onDateChange}
              slotProps={{
                textField: { fullWidth: true, size: 'small', sx: inputSx },
                popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } },
              }}
            />
            {renderHelper('Change the date of this trade')}
          </Box>
        </FormField>
      )}

      {/* Trade type — chip segmented control */}
      <FormField>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Trade type', true)}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {tradeTypeOptions.map((opt) => {
              const selected = newTrade.trade_type === opt.value;
              const tintedBg = alpha(opt.color, isDark ? 0.18 : 0.14);
              const tintedBorder = alpha(opt.color, isDark ? 0.4 : 0.32);
              return (
                <Box
                  key={opt.value}
                  onClick={() => {
                    const syntheticEvent = {
                      target: { value: opt.value },
                    } as any;
                    onTypeChange(syntheticEvent);
                  }}
                  sx={{
                    ...chipStyle(selected),
                    backgroundColor: selected ? tintedBg : surfaceInset,
                    color: selected ? opt.color : theme.palette.text.primary,
                    border: `1px solid ${selected ? tintedBorder : hairline}`,
                    px: 1.5,
                    '&:hover': {
                      backgroundColor: selected
                        ? tintedBg
                        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                    },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: opt.color,
                      mr: 0.5,
                    }}
                  />
                  {opt.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </FormField>

      {/* Amount */}
      {newTrade.trade_type === 'breakeven' ? (
        <FormField>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Amount')}
            <TextField
              type="number"
              value={0}
              fullWidth
              size="small"
              disabled
              sx={{
                ...numericInputSx,
                '& .MuiInputBase-input': {
                  pointerEvents: 'none',
                  fontFamily: 'inherit',
                },
              }}
            />
            {renderHelper('Breakeven trades have zero P&L')}
          </Box>
        </FormField>
      ) : !dynamicRiskSettings.risk_per_trade ||
      (dynamicRiskSettings.risk_per_trade && newTrade.partials_taken) ? (
        <FormField>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Amount', true)}
            <TextField
              type="number"
              value={newTrade.amount === 0 ? '' : newTrade.amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              fullWidth
              size="small"
              required
              sx={numericInputSx}
            />
            {dynamicRiskSettings.risk_per_trade && newTrade.partials_taken &&
              renderHelper('Manual entry for partial profits')}
          </Box>
        </FormField>
      ) : (
        <FormField>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {renderLabel('Amount (calculated from risk)')}
            <TextField
              type="number"
              value={calculateAmountFromRisk()}
              fullWidth
              size="small"
              disabled
              sx={{
                ...numericInputSx,
                '& .MuiInputBase-input': {
                  pointerEvents: 'none',
                  fontFamily: 'inherit',
                },
                '& .MuiOutlinedInput-root': {
                  ...(inputSx as Record<string, any>)['& .MuiOutlinedInput-root'],
                  backgroundColor: alpha(violet, isDark ? 0.08 : 0.06),
                },
              }}
            />
            {renderHelper(
              dynamicRiskSettings?.dynamic_risk_enabled &&
                dynamicRiskSettings.increased_risk_percentage &&
                dynamicRiskSettings.profit_threshold_percentage &&
                (Number(cumulativePnl) / Number(accountBalance) * 100) >=
                  dynamicRiskSettings.profit_threshold_percentage
                ? `Based on ${dynamicRiskSettings.increased_risk_percentage}% of account balance (INCREASED from ${dynamicRiskSettings.risk_per_trade}%)`
                : `Based on ${dynamicRiskSettings.risk_per_trade}% of account balance (${formatCurrency((Number(accountBalance) * (dynamicRiskSettings.risk_per_trade || 0)) / 100)})`,
            )}
          </Box>
        </FormField>
      )}

      {/* Partials checkbox */}
      {dynamicRiskSettings.risk_per_trade !== undefined && (
        <FormField>
          <MuiFormControlLabel
            control={
              <Checkbox
                checked={newTrade.partials_taken}
                onChange={onPartialsTakenChange}
                size="small"
                sx={{
                  color: alpha(theme.palette.text.secondary, 0.6),
                  '&.Mui-checked': { color: violet },
                }}
              />
            }
            label={
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
                Partials taken (allows manual amount entry)
              </Typography>
            }
            sx={{ ml: -0.75 }}
          />
        </FormField>
      )}

      {/* Risk to reward */}
      <FormField>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Risk to reward')}
          <TextField
            value={newTrade.risk_to_reward === 0 ? '' : newTrade.risk_to_reward}
            onChange={handleRiskToRewardChange}
            fullWidth
            size="small"
            type="number"
            placeholder="e.g. 2"
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
            sx={numericInputSx}
          />
        </Box>
      </FormField>

      {/* Session */}
      <FormField>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {renderLabel('Session', true)}
          <Select
            value={newTrade.session}
            onChange={onSessionChange}
            displayEmpty
            required
            fullWidth
            size="small"
            renderValue={(value) => {
              if (!value) {
                return (
                  <Typography component="span" sx={{ fontSize: '0.88rem', color: theme.palette.text.disabled }}>
                    Pick a session…
                  </Typography>
                );
              }
              return value as string;
            }}
            MenuProps={{
              sx: { zIndex: Z_INDEX.DIALOG_POPUP },
              PaperProps: {
                sx: {
                  borderRadius: 1.5,
                  border: `1px solid ${hairline}`,
                  boxShadow: getShadow(theme, 'lg'),
                  backgroundImage: 'none',
                  mt: 0.5,
                },
              },
            }}
            sx={inputSx}
          >
            <MenuItem value="" sx={{ fontSize: '0.88rem' }}>None</MenuItem>
            <MenuItem value="Asia" sx={{ fontSize: '0.88rem' }}>Asia</MenuItem>
            <MenuItem value="London" sx={{ fontSize: '0.88rem' }}>London</MenuItem>
            <MenuItem value="NY AM" sx={{ fontSize: '0.88rem' }}>NY AM</MenuItem>
            <MenuItem value="NY PM" sx={{ fontSize: '0.88rem' }}>NY PM</MenuItem>
          </Select>
        </Box>
      </FormField>

      {/* Tags + required-groups warning */}
      <FormField>
        {missingRequiredGroups.length > 0 && (
          <Box
            sx={{
              mb: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.12 : 0.08),
              border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.4 : 0.3)}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
            }}
          >
            <Typography sx={{ ...monoLabelSx, color: theme.palette.warning.main }}>
              Required tag groups
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}>
              Add at least one tag from each required group:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {missingRequiredGroups.map((group) => (
                <Box
                  key={group}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.25,
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: theme.palette.warning.main,
                    backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.14),
                    border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.4 : 0.32)}`,
                  }}
                >
                  {group}
                </Box>
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
        <Typography sx={{ fontSize: '0.72rem', color: alpha(theme.palette.text.secondary, 0.85), mt: 0.75, lineHeight: 1.4, display: 'block' }}>
          Tip: categorize tags as <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>Category:Tag</code> (e.g. <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>Strategy:Breakout</code>). Grouped tags cluster in charts so you can spot which setups perform best. One colon per tag.
        </Typography>
      </FormField>
      </TabPanel>

      <TabPanel value={activeTab} index={1} fullHeight>
        <ImageUploader
          pendingImages={newTrade.pending_images}
          uploadedImages={newTrade.uploaded_images}
          editingTrade={editingTrade !== null}
          onImageUpload={onImageUpload}
          onImageCaptionChange={onImageCaptionChange}
          onImageRemove={onImageRemove}
          onImagesReordered={onImagesReordered}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2} fullHeight>
        {/* Notes tab — mirrors the NoteEditorBody journal layout:
            generous centred column, sticky toolbar, no surrounding chrome. */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            maxWidth: 760,
            mx: 'auto',
            px: { xs: 0.5, md: 2 },
            py: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <RichTextEditor
            ref={editorRef}
            value={newTrade.notes}
            onChange={onNotesChange}
            placeholder="Write your trade journal — type /tag, /note, or /event to embed, or use the editor tool to insert a trade share link…"
            minHeight={320}
            maxHeight={520}
            maxLength={1024}
            toolbarVariant="sticky"
            stickyPosition="bottom"
            calendarId={calendarId}
            trades={trades}
            onOpenGalleryMode={onOpenGalleryMode}
            // Mention / note / event pickers — same wiring as NoteEditorBody
            availableTradeTags={allTags}
            onMentionStateChange={bumpMention}
            availableNotes={availableNotes}
            onNoteLinkStateChange={bumpMention}
            availableEvents={availableEvents}
            onEventLinkStateChange={bumpMention}
            // Toolbar "Insert trade link" button + clickable embedded chips
            onInsertTradeLink={onInsertTradeLink}
            onSharedTradeClick={onSharedTradeClick}
          />
        </Box>
      </TabPanel>

      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
        <button
          type="submit"
          style={{ display: 'none' }}
          disabled={isSubmitting}
        />
      </Box>

      {tradeLinkElements}
    </form>
  );
};

export default TradeForm;
