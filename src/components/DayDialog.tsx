import React, { useState, useMemo } from 'react';
import ImageZoomDialog from './ImageZoomDialog';
import TradeDetailExpanded from './TradeDetailExpanded';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Box,
  Stack,
  TextField,
  useTheme,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
  Alert,
  Autocomplete,
  Chip,
  CircularProgress,
  Input,
  Tooltip,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon, Delete as DeleteIcon, ChevronLeft, ChevronRight, AddPhotoAlternate, Note as NoteIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade } from '../types/trade';
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup } from '../utils/tagColors';
import {
  DialogTitleStyled,
  DialogContentStyled,
  DialogActionsStyled,
  FormField,
  TradeListItem,
  TradeInfo,
  TradeActions,
  JournalLink
} from './StyledComponents';
import {
  AnimatedSlideDown
} from './Animations';
import { alpha } from '@mui/material/styles';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
// TradeDetailDialog no longer needed
import { deleteImage, uploadImages } from '../services/calendarService';

interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  accountBalance: number;
  totalPnL: number;
  onDateChange: (date: Date) => void;
  onAddTrade?: (trade: Omit<Trade, 'id'>) => Promise<void>;
  onEditTrade?: (trade: Trade) => Promise<void>;
  onDeleteTrade?: (tradeId: string) => Promise<void>;
  onAccountBalanceChange: (balance: number) => void;
  allTrades?: Trade[];
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
}

interface NewTradeForm {
  amount: string;
  type: 'win' | 'loss';
  journalLink: string;
  tags: string[];
  riskToReward: string;
  partialsTaken: boolean;
  session: 'Asia' | 'London' | 'NY AM' | 'NY PM' | '';
  notes: string;
  pendingImages: Array<{
    file: File;
    preview: string;
    caption?: string;
    width?: number;
    height?: number;
  }>;
  uploadedImages: Array<{
    url: string;
    id: string;
    caption?: string;
    width?: number;
    height?: number;
  }>;
  imagesToRemove: string[];
}

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  accountBalance,

  onDateChange,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onAccountBalanceChange,
  allTrades = [],
  riskPerTrade,
  dynamicRiskEnabled,
  increasedRiskPercentage,
  profitThresholdPercentage
}) => {
  const [newTrade, setNewTrade] = useState<NewTradeForm>({
    amount: '',
    type: 'win',
    journalLink: '',
    tags: [],
    riskToReward: '',
    partialsTaken: false,
    session: '',
    notes: '',
    pendingImages: [],
    uploadedImages: [],
    imagesToRemove: []
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; tradeId: string | null }>({
    open: false,
    tradeId: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const theme = useTheme();

  const isFutureDate = isAfter(startOfDay(date), startOfDay(new Date()));

  // Calculate total profit/loss for the day
  const totalPnL = trades.reduce((sum, trade) => sum + trade.amount, 0);

  // Get all unique tags from all trades
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [allTrades]);

  const handlePreviousDay = () => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    onDateChange(prevDate);
  };

  const handleNextDay = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    onDateChange(nextDate);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewTrade(prev => ({ ...prev, amount: value }));
    }
  };

  const handleTypeChange = (e: SelectChangeEvent<'win' | 'loss'>) => {
    setNewTrade(prev => ({ ...prev, type: e.target.value as 'win' | 'loss' }));
  };

  const handleJournalLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty value or valid URL
    if (value === '' || isValidUrl(value)) {
      setNewTrade(prev => ({ ...prev, journalLink: value }));
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleRiskToRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewTrade(prev => ({ ...prev, riskToReward: value }));

      // If risk per trade is set and partials are not taken, automatically calculate and update the amount
      if (riskPerTrade && value && !newTrade.partialsTaken) {
        const rr = parseFloat(value);
        if (!isNaN(rr)) {
          const calculatedAmount = calculateAmountFromRiskToReward(rr);
          setNewTrade(prev => ({ ...prev, amount: calculatedAmount.toString() }));
        }
      }
    }
  };

  // Handle partials taken checkbox change
  const handlePartialsTakenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setNewTrade(prev => ({ ...prev, partialsTaken: checked }));
  };

  // Calculate amount based on risk per trade (as percentage of account balance) and risk-to-reward ratio
  const calculateAmountFromRiskToReward = (riskToReward: number): number => {
    if (!riskPerTrade || !riskToReward || !accountBalance) return 0;

    // Get the effective risk percentage (which may be increased due to dynamic risk)
    const effectiveRiskPercentage = getEffectiveRiskPercentage();

    // Calculate the risk amount based on the effective percentage of account balance
    const totalAccountValue = accountBalance + totalPnL;
    const riskAmount = (totalAccountValue * effectiveRiskPercentage) / 100;

    // For win trades: risk amount * R:R
    // For loss trades: risk amount
    return newTrade.type === 'win'
      ? riskAmount * riskToReward
      : riskAmount;
  };

  // Format the calculated amount for display
  const calculateAmountFromRisk = (): string => {
    if (!riskPerTrade || !newTrade.riskToReward) return '';

    const rr = parseFloat(newTrade.riskToReward);
    if (isNaN(rr)) return '';

    const amount = calculateAmountFromRiskToReward(rr);
    return amount.toString();
  };

  // Calculate the effective risk percentage based on dynamic risk settings
  const getEffectiveRiskPercentage = (): number => {
    if (!riskPerTrade) return 0;

    // Apply dynamic risk if enabled and profit threshold is met

    if (dynamicRiskEnabled &&
        increasedRiskPercentage &&
        profitThresholdPercentage &&
        accountBalance > 0) {
      const profitPercentage = (totalPnL / accountBalance * 100);
      if (profitPercentage >= profitThresholdPercentage) {
        return increasedRiskPercentage;
      }
    }

    return riskPerTrade;
  };

  // Format currency for display
  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSessionChange = (e: SelectChangeEvent<'Asia' | 'London' | 'NY AM' | 'NY PM' | ''>) => {
    setNewTrade(prev => ({ ...prev, session: e.target.value as 'Asia' | 'London' | 'NY AM' | 'NY PM' | '' }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev, notes: e.target.value }));
  };

  const handleImageUpload = async (file: File) => {
    // Create a preview URL for the image
    const preview = URL.createObjectURL(file);

    // Create a promise to get the image dimensions
    const getDimensions = (url: string): Promise<{width: number, height: number}> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height
          });
        };
        img.src = url;
      });
    };

    // Get the dimensions of the image
    const dimensions = await getDimensions(preview);

    // Add the file, preview, and dimensions to pendingImages
    setNewTrade(prev => ({
      ...prev,
      pendingImages: [...prev.pendingImages, {
        file,
        preview,
        caption: '',
        width: dimensions.width,
        height: dimensions.height
      }]
    }));
  };



  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
      }
    }
  };

  const handleRemoveImage = (index: number, isPending: boolean) => {
    if (isPending) {
      setNewTrade(prev => ({
        ...prev,
        pendingImages: prev.pendingImages.filter((_, i) => i !== index)
      }));
    } else {
      const imageToRemove = newTrade.uploadedImages[index];
      setNewTrade(prev => ({
        ...prev,
        uploadedImages: prev.uploadedImages.filter((_, i) => i !== index),
        imagesToRemove: [...prev.imagesToRemove, imageToRemove.id]
      }));
    }
  };

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    setNewTrade({
      amount: Math.abs(trade.amount).toString(),
      type: trade.type,
      journalLink: trade.journalLink || '',
      tags: trade.tags || [],
      riskToReward: trade.riskToReward?.toString() || '',
      partialsTaken: trade.partialsTaken || false, // Use existing value or default to false
      session: trade.session || '',
      notes: trade.notes || '',
      pendingImages: [],
      uploadedImages: trade.images || [],
      imagesToRemove: []
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = async (tradeId: string) => {
    if (!onDeleteTrade) return;

    setIsDeleting(true);
    try {

      // Delete the trade
      await onDeleteTrade(tradeId);
      setDeleteConfirmation({ open: false, tradeId: null });
    } catch (error) {
      console.error('Error deleting trade:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  const calculateFinalAmount = (trade: NewTradeForm): number => {
    if (riskPerTrade && trade.riskToReward && !trade.partialsTaken) {
      const rr = parseFloat(trade.riskToReward);
      const calculatedAmount = calculateAmountFromRiskToReward(rr);
      return trade.type === 'loss' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
    } else {
      const amount = parseFloat(trade.amount);
      return trade.type === 'loss' ? -Math.abs(amount) : Math.abs(amount);
    }
  };
  const getFinalTags = (newTrade: NewTradeForm): string[] => {
    const pendingTagText = document.querySelector<HTMLInputElement>('.MuiAutocomplete-input')?.value;
    const finalTags = [...newTrade.tags];
    if (pendingTagText && !finalTags.includes(pendingTagText)) {
      finalTags.push(pendingTagText.trim());
    }
    return finalTags;
  };

  const handleSubmit = async () => {
    // If using risk per trade and not taking partials, ensure we have a risk-to-reward ratio
    if (riskPerTrade && !newTrade.partialsTaken && !newTrade.riskToReward) {
      alert('Please enter a Risk to Reward ratio');
      return;
    }

    // If not using risk per trade or taking partials, ensure we have an amount
    if ((!riskPerTrade || (riskPerTrade && newTrade.partialsTaken)) && !newTrade.amount) {
      alert('Please enter an Amount');
      return;
    }

    if (!onAddTrade) return;

    setIsSubmitting(true);
    try {
      // Get any pending tag text from the Autocomplete input
      const finalTags = getFinalTags(newTrade);

      // Calculate the amount based on risk per trade if available and partials not taken
      let finalAmount = calculateFinalAmount(newTrade);

      // Upload any pending images
      let uploadedImages = [...newTrade.uploadedImages];
      if (newTrade.pendingImages.length > 0) {
        uploadedImages = await uploadImages(newTrade.pendingImages);
      }


      await onAddTrade({
        date,
        type: newTrade.type,
        amount: finalAmount,
        ...(newTrade.journalLink && { journalLink: newTrade.journalLink }),
        ...(finalTags.length > 0 && { tags: finalTags }),
        ...(newTrade.riskToReward && { riskToReward: parseFloat(newTrade.riskToReward) }),
        partialsTaken: newTrade.partialsTaken,
        ...(newTrade.session && { session: newTrade.session }),
        ...(newTrade.notes && { notes: newTrade.notes }),
        ...(uploadedImages.length > 0 && { images: uploadedImages })
      });

      setNewTrade({
        amount: '',
        type: 'win',
        journalLink: '',
        tags: [],
        riskToReward: '',
        partialsTaken: false,
        session: '',
        notes: '',
        pendingImages: [],
        uploadedImages: [],
        imagesToRemove: []
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding trade:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingTrade(null);
    setNewTrade({
      amount: '',
      type: 'win',
      journalLink: '',
      tags: [],
      riskToReward: '',
      partialsTaken: false,
      session: '',
      notes: '',
      pendingImages: [],
      uploadedImages: [],
      imagesToRemove: []
    });
  };

  const handleTradeClick = (trade: Trade) => {
    if (expandedTradeId === trade.id) {
      setExpandedTradeId(null); // Collapse if already expanded
    } else {
      setExpandedTradeId(trade.id); // Expand this trade
    }
  };

  const handleEditSubmit = async () => {
    if (!editingTrade || !newTrade.amount || !onEditTrade) return;

    setIsSubmitting(true);
    try {
      // Get any pending tag text from the Autocomplete input
      const finalTags = getFinalTags(newTrade);

      // Make amount negative for loss trades
      const finalAmount = calculateFinalAmount(newTrade);

      // Upload any pending images
      let uploadedImages = [...newTrade.uploadedImages];
      if (newTrade.pendingImages.length > 0) {
        const newUploadedImages = await uploadImages(newTrade.pendingImages);
        uploadedImages = [...uploadedImages, ...newUploadedImages];
      }

      // Remove images that were marked for deletion
      if (newTrade.imagesToRemove.length > 0) {
        await Promise.all(
          newTrade.imagesToRemove.map(async (imageId) => {
            await deleteImage(imageId);
          })
        );
      }

      await onEditTrade({
        ...editingTrade,
        type: newTrade.type,
        amount: finalAmount,
        journalLink: newTrade.journalLink,
        tags: finalTags || [],
        riskToReward: parseFloat(newTrade.riskToReward) || 1,
        partialsTaken: newTrade.partialsTaken,
        session: newTrade.session || "London",
        notes: newTrade.notes || "",
        images: uploadedImages || []
      });

      setEditingTrade(null);
      setNewTrade({
        amount: '',
        type: 'win',
        journalLink: '',
        tags: [],
        riskToReward: '',
        partialsTaken: false,
        session: '',
        notes: '',
        pendingImages: [],
        uploadedImages: [],
        imagesToRemove: []
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error updating trade:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        {...dialogProps}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
            maxHeight: '90vh',
            overflow: 'hidden',
            '& .MuiDialogContent-root': {
              ...scrollbarStyles(theme)
            }
          }
        }}
      >
        <DialogTitleStyled>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {format(date, 'MMMM d, yyyy')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={handlePreviousDay} size="small">
                <ChevronLeft />
              </IconButton>
              <IconButton onClick={handleNextDay} size="small">
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitleStyled>

        <DialogContentStyled onPaste={handlePaste}>
          <Box sx={{ mb: 3 }}>
            {isFutureDate ? (
              <Alert
                severity="info"
                sx={{
                  mt: 2,
                  borderRadius: theme.shape.borderRadius,
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.info.main, 0.1)
                    : alpha(theme.palette.info.main, 0.05),
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.info.main, 0.2)
                    : alpha(theme.palette.info.main, 0.1),
                  color: theme.palette.info.main,
                  '& .MuiAlert-icon': {
                    color: theme.palette.info.main
                  }
                }}
              >
                Cannot add trades for future dates
              </Alert>
            ) : !showAddForm ? (
              <Button
                variant="contained"
                color="primary"
                sx={{ mt: 2 }}
                fullWidth
                onClick={() => setShowAddForm(true)}
              >
                Add New Trade
              </Button>
            ) : (
              <AnimatedSlideDown>
                <Box sx={{ mb: 3, mt: 2 }}>

                  <form  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingTrade) {
                      handleEditSubmit();
                    } else {
                      handleSubmit();
                    }
                  }}>
                    {(!riskPerTrade || (riskPerTrade && newTrade.partialsTaken)) ? (
                      <FormField>
                        <TextField
                          label="Amount"
                          type="number"
                          value={newTrade.amount}
                          onChange={handleAmountChange}
                          fullWidth
                          required
                          helperText={riskPerTrade && newTrade.partialsTaken ? "Manual entry for partial profits" : undefined}
                        />
                      </FormField>
                    ) : (
                      <FormField>
                        <TextField
                          label="Amount (Calculated from Risk)"
                          type="number"
                          value={calculateAmountFromRisk()}
                          InputProps={{
                            readOnly: true,
                          }}
                          fullWidth
                          disabled
                          helperText={
                            dynamicRiskEnabled &&
                            increasedRiskPercentage &&
                            profitThresholdPercentage &&
                            (totalPnL / accountBalance * 100) >= profitThresholdPercentage
                              ? `Based on ${increasedRiskPercentage}% of account balance (INCREASED from ${riskPerTrade}%)`
                              : `Based on ${riskPerTrade}% of account balance (${formatCurrency((accountBalance * riskPerTrade) / 100)})`
                          }
                        />
                      </FormField>
                    )}
                    <FormField>
                      <FormControl fullWidth required>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={newTrade.type}
                          onChange={handleTypeChange}
                          label="Type"
                        >
                          <MenuItem value="win">Win</MenuItem>
                          <MenuItem value="loss">Loss</MenuItem>
                        </Select>
                      </FormControl>
                    </FormField>
                    <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                      <FormField sx={{ flex: 1 }}>
                        <TextField
                          label="Risk to Reward"
                          value={newTrade.riskToReward}
                          onChange={handleRiskToRewardChange}
                          fullWidth
                        />
                      </FormField>

                      {riskPerTrade && (
                        <FormField sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={newTrade.partialsTaken}
                                onChange={handlePartialsTakenChange}
                                color="primary"
                              />
                            }
                            label="Partials Taken"
                          />
                        </FormField>
                      )}
                    </Box>
                    <FormField>
                      <FormControl fullWidth>
                        <InputLabel>Session</InputLabel>
                        <Select
                          value={newTrade.session}
                          label="Session"
                          onChange={handleSessionChange}
                        >
                          <MenuItem value="">None</MenuItem>
                          <MenuItem value="Asia">Asia Session</MenuItem>
                          <MenuItem value="London">London Session</MenuItem>
                          <MenuItem value="NY AM">NY AM</MenuItem>
                          <MenuItem value="NY PM">NY PM</MenuItem>
                        </Select>
                      </FormControl>
                    </FormField>
                    <FormField>
                      <TextField
                        label="Journal Link (optional)"
                        value={newTrade.journalLink}
                        onChange={handleJournalLinkChange}
                        fullWidth
                        type="url"
                        placeholder="https://example.com"
                        inputProps={{
                          pattern: "https?://.*",
                        }}
                        helperText={newTrade.journalLink && !isValidUrl(newTrade.journalLink) ? "Please enter a valid URL" : ""}
                        error={newTrade.journalLink !== '' && !isValidUrl(newTrade.journalLink)}
                      />
                    </FormField>
                    <FormField>
                      <TextField
                        label="Notes (optional)"
                        value={newTrade.notes}
                        onChange={handleNotesChange}
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Add any notes about this trade..."
                      />
                    </FormField>
                    <FormField>
                      <Autocomplete
                        multiple
                        freeSolo
                        options={existingTags}
                        value={newTrade.tags}
                        onChange={(_, newValue) => {
                          setNewTrade(prev => ({ ...prev, tags: newValue }));
                        }}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={formatTagForDisplay(option, true)}
                              {...getTagProps({ index })}
                              sx={getTagChipStyles(option, theme)}
                              title={isGroupedTag(option) ? `Group: ${getTagGroup(option)}` : undefined}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Tags"
                            placeholder="Add tags..."
                            helperText="Type and press enter to add new tags. Use 'Group:Tag' format for grouping (e.g., 'Strategy:Volume')"
                          />
                        )}
                      />
                    </FormField>
                    <FormField>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button
                            component="label"
                            variant="outlined"
                            startIcon={<AddPhotoAlternate />}
                            disabled={isSubmitting}
                            sx={{ flex: 1 }}
                          >
                            Add Image
                            <Input
                              type="file"
                              inputProps={{ accept: 'image/*' }}
                              onChange={handleFileInputChange}
                              sx={{ display: 'none' }}
                            />
                          </Button>
                        </Box>

                        {(newTrade.pendingImages.length > 0 || newTrade.uploadedImages.length > 0) && (
                          <Stack spacing={2}>
                            {newTrade.pendingImages.map((image, index) => (
                              <Box
                                key={index}
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  height: 'auto',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  border: `1px solid ${theme.palette.divider}`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: 300,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    ...(image.width && image.height ? {
                                      paddingTop: `${(image.height / image.width) * 100}%`
                                    } : {})
                                  }}
                                >
                                  {image.width && image.height && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: theme => alpha(theme.palette.divider, 0.2),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <CircularProgress size={24} color="inherit" sx={{ opacity: 0.5 }} />
                                    </Box>
                                  )}
                                  <img
                                    src={image.preview}
                                    alt="Trade"
                                    style={{
                                      width: '100%',
                                      objectFit: 'contain',
                                      position: image.width && image.height ? 'absolute' : 'relative',
                                      top: 0,
                                      left: 0,
                                      height: image.width && image.height ? '100%' : 'auto',
                                    }}
                                    onLoad={(e) => {
                                      // Hide the placeholder when image is loaded
                                      const target = e.target as HTMLImageElement;
                                      const parent = target.parentElement;
                                      if (parent && parent.children.length > 1) {
                                        const placeholder = parent.children[0] as HTMLElement;
                                        if (placeholder) {
                                          placeholder.style.display = 'none';
                                        }
                                      }
                                    }}
                                  />
                                </Box>
                                <TextField
                                  size="small"
                                  placeholder="Add caption"
                                  value={image.caption || ''}
                                  multiline
                                  minRows={2}
                                  maxRows={10}
                                  onChange={(e) => {
                                    setNewTrade(prev => ({
                                      ...prev,
                                      pendingImages: prev.pendingImages.map((pendingImage, i) =>
                                        i === index ? { ...pendingImage, caption: e.target.value } : pendingImage
                                      )
                                    }));
                                  }}
                                  sx={{
                                    m: 1,
                                    width: 'calc(100% - 16px)',
                                    '& .MuiInputBase-input': {
                                      py: 0.5,
                                      px: 1,
                                      fontSize: '0.75rem',
                                      color: theme.palette.text.secondary,
                                      ...scrollbarStyles(theme)
                                    },
                                    '& .MuiInputBase-root': {
                                      height: 'auto'
                                    }
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveImage(index, true)}
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    color: 'white',
                                    '&:hover': {
                                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                    },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                            {newTrade.uploadedImages.map((image, index) => (
                              <Box
                                key={image.id}
                                sx={{
                                  position: 'relative',
                                  width: '100%',
                                  height: 'auto',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  border: `1px solid ${theme.palette.divider}`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                <Box sx={{ width: '100%', height: 'auto', maxHeight: 300, overflow: 'hidden' }}>
                                  <img
                                    src={image.url}
                                    alt="Trade"
                                    style={{
                                      width: '100%',
                                      objectFit: 'contain',
                                    }}
                                  />
                                </Box>
                                <TextField
                                  size="small"
                                  placeholder="Add caption"
                                  value={image.caption || ''}
                                  multiline
                                  minRows={2}
                                  maxRows={10}
                                  onChange={(e) => {
                                    setNewTrade(prev => ({
                                      ...prev,
                                      uploadedImages: prev.uploadedImages.map((uploadedImage, i) =>
                                        i === index ? { ...uploadedImage, caption: e.target.value } : uploadedImage
                                      )
                                    }));
                                  }}
                                  sx={{
                                    m: 1,
                                    width: 'calc(100% - 16px)',
                                    '& .MuiInputBase-input': {
                                      py: 0.5,
                                      px: 1,
                                      fontSize: '0.75rem',
                                    },
                                    '& .MuiInputBase-root': {
                                      height: 'auto'
                                    }
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveImage(index, false)}
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    color: 'white',
                                    '&:hover': {
                                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                    },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Stack>
                        )}

                        <Typography variant="caption" color="text.secondary">
                          You can also paste images directly (Ctrl+V)
                        </Typography>
                      </Box>
                    </FormField>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={isSubmitting}
                        sx={{
                          position: 'relative',
                          minWidth: 100,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        {editingTrade ? 'Update Trade' : 'Add Trade'}
                        {isSubmitting && (
                          <CircularProgress
                            size={20}
                            color="inherit"
                          />
                        )}
                      </Button>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={handleCancel}
                        fullWidth
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </form>
                </Box>
              </AnimatedSlideDown>
            )}
          </Box>

          {/* Only show trade list when not adding/editing a trade */}
          {!showAddForm && (
            trades.length > 0 ? (
              <Stack spacing={1}>
                {trades.map(trade => (
                  <Box key={trade.id}>
                    <TradeListItem
                      $type={trade.type}
                      onClick={() => handleTradeClick(trade)}
                      sx={{
                        cursor: 'pointer',
                        borderBottomLeftRadius: expandedTradeId === trade.id ? 0 : undefined,
                        borderBottomRightRadius: expandedTradeId === trade.id ? 0 : undefined,
                      }}
                    >
                      <TradeInfo>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body1" sx={{
                              fontWeight: 500,
                              color: trade.type === 'win' ? 'success.main' : 'error.main'
                            }}>
                              ${Math.abs(trade.amount).toLocaleString()}
                            </Typography>
                            {expandedTradeId === trade.id ?
                              <CollapseIcon fontSize="small" sx={{ color: 'text.secondary' }} /> :
                              <ExpandIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                            }
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                            {trade.riskToReward && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                RR {trade.riskToReward}
                              </Typography>
                            )}
                            {trade.session && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                • {trade.session}
                              </Typography>
                            )}
                            {trade.notes && (
                              <Tooltip title="Has notes">
                                <NoteIcon
                                  sx={{
                                    fontSize: 16,
                                    color: 'text.secondary',
                                    opacity: 0.7
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                         
                        </Box>
                        {trade.journalLink && (
                          <JournalLink
                            href={trade.journalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Journal
                          </JournalLink>
                        )}
                      </TradeInfo>
                      <TradeActions>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(trade);
                          }}
                          sx={{ color: 'text.secondary' }}
                          disabled={isFutureDate}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation({ open: true, tradeId: trade.id });
                          }}
                          sx={{ color: 'error.main' }}
                          disabled={isFutureDate}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TradeActions>
                    </TradeListItem>

                    {/* Expanded Trade Details */}
                    <TradeDetailExpanded
                      trade={trade}
                      isExpanded={expandedTradeId === trade.id}
                      setZoomedImage={setZoomedImage}
                    />
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" align="center">
                No trades for this day
              </Typography>
            )
          )}
        </DialogContentStyled>

        <DialogActionsStyled>
          <Button onClick={onClose}>Close</Button>
        </DialogActionsStyled>
      </Dialog>

      {/* TradeDetailDialog removed - now using inline expandable details */}

      {/* Image Zoom Dialog */}
      <ImageZoomDialog
        open={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        imageUrl={zoomedImage}
      />

      <Dialog
        open={deleteConfirmation.open}
        onClose={() => setDeleteConfirmation({ open: false, tradeId: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Trade</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this trade? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteConfirmation({ open: false, tradeId: null })}
            color="inherit"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (deleteConfirmation.tradeId && onDeleteTrade) {
                handleDeleteClick(deleteConfirmation.tradeId);
              }
            }}
            color="error"
            disabled={isDeleting}
            sx={{
              position: 'relative',
              minWidth: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            Delete
            {isDeleting && (
              <CircularProgress
                size={20}
                color="inherit"
              />
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DayDialog;