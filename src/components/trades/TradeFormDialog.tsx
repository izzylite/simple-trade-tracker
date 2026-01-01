import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import { endOfDay, format } from 'date-fns';
import { Trade, Calendar } from '../../types/dualWrite';
import { BaseDialog } from '../common';
import * as calendarService from '../../services/calendarService';
import { DayHeader, TradeForm, NewTradeForm } from './';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PAIRS_TAG_GROUP, PendingImage, TradeImage } from './TradeForm';
import { GridImage, GridPendingImage } from './ImageGrid';
import { createNewTradeData } from '../../pages/TradeCalendarPage';
import {
  calculateCumulativePnLToDateAsync,
  calculateEffectiveRiskPercentageAsync,
  calculateRiskAmount,
  DynamicRiskSettings
} from '../../utils/dynamicRiskUtils';
import { error, log, logger } from '../../utils/logger';
import { validateFiles, FILE_SIZE_LIMITS } from '../../utils/fileValidation';
import { formatTagsWithCapitalizedGroups } from '../../utils/tagColors';
import { Z_INDEX } from '../../styles/zIndex';
import { TradeRepository } from '../../services/repository/repositories/TradeRepository';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  newMainTrade?: NewTradeForm | null
  trade_date: Date;
  showForm: FormProps; 
  account_balance: number;

  onAddTrade?: (trade: Trade & { id?: string }) => Promise<void>;
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onDeleteTrades?: (tradeIds: string[]) => Promise<void>;
  onAccountBalanceChange?: (balance: number) => void;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  setNewMainTrade: (prev: (trade: NewTradeForm) => NewTradeForm | null) => void
  onCancel: () => void;
  dynamicRiskSettings: DynamicRiskSettings; 
  /** Calendar object with year_stats for cumulative P&L calculation */
  calendar: Calendar;
  tags: string[];
  requiredTagGroups?: string[];
  // Optional props for trade link navigation in notes
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Optional props for calendar selection (used when opened from Home.tsx)
  calendars?: Calendar[];
  onCalendarChange?: (calendarId: string) => void; 
}

interface FormProps {
  open: boolean;
  editTrade?: Trade | null;
  createTempTrade: boolean;
}




// Helper function to process tags
const processTagsForSubmission = (tags: string[]): string[] => {
  // Get any pending tag from the tags input field specifically (not the trade name input)
  const tagInput = document.getElementById('trade-tags-input') as HTMLInputElement;
  let pendingTag = '';
  if (tagInput && tagInput.value.trim()) {
    pendingTag = tagInput.value.trim();
  }

  if (pendingTag) {
    return [...tags, pendingTag];
  }
  return tags;
};

export const startOfNextDay = (trade_date: Date | string): Date => {
  const nextDay = new Date(trade_date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

export const createEditTradeData = (trade: Trade): NewTradeForm => {
  return {
    id: trade.id,
    name: trade.name ? trade.name.replace(/^📈 /, '') : '',
    amount: Math.abs(trade.amount),
    trade_type: trade.trade_type,
    entry_price: trade.entry_price || 0,
    trade_date: trade.trade_date,
    exit_price: trade.exit_price || 0,
    stop_loss: trade.stop_loss || 0,
    take_profit: trade.take_profit || 0,
    tags: trade.tags || [],
    risk_to_reward: trade.risk_to_reward || 0,
    partials_taken: trade.partials_taken || false,
    session: trade.session as '' | 'Asia' | 'London' | 'NY AM' | 'NY PM' || '',
    notes: trade.notes || '',
    pending_images: [],
    is_temporary: trade.is_temporary,
    economic_events: trade.economic_events || [],
    uploaded_images: trade.images ? trade.images.filter(img => img).map((img, index) => ({
      ...img,
      // Ensure ID is present - generate one if missing to prevent delete issues
      id: img.id || calendarService.generateImageId(),
      // Ensure layout properties are explicitly preserved
      row: img.row !== undefined ? img.row : index, // Each image gets its own row by default
      column: img.column !== undefined ? img.column : 0, // Always in first column by default
      column_width: img.column_width !== undefined ? img.column_width : 100 // Default to 100% for vertical layout
    })) : [],

  }
}

const TradeFormDialog: React.FC<FormDialogProps> = ({
  open,
  onClose,
  newMainTrade,
  setNewMainTrade,
  trade_date, 
  account_balance,
  showForm,
  onCancel,
  onAddTrade,
  onTagUpdated,
  onUpdateTradeProperty,
  onDeleteTrades,
  dynamicRiskSettings, 
  calendar,
  tags = [],
  requiredTagGroups = [],
  onOpenGalleryMode,
  calendars,
  onCalendarChange
}) => {

  // State

  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingEmptyTrade, setIsCreatingEmptyTrade] = useState(false);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showError, setShowError] = useState(false);

  // Pre-calculated cumulative P&L and effective risk (fetched async when dialog opens)
  const [precalculatedPnL, setPrecalculatedPnL] = useState<number>(0);
  const [precalculatedRiskPercentage, setPrecalculatedRiskPercentage] = useState<number>(0);
  const [isLoadingPrecalculatedValues, setIsLoadingPrecalculatedValues] = useState(false);
  const [dayTotalPnL, setDayTotalPnL] = useState<number>(0);

  // Original risk amount derived from editing trade (preserves historical calculation context)
  // For wins: riskAmount = amount / R:R, For losses: riskAmount = |amount|
  const [originalRiskAmount, setOriginalRiskAmount] = useState<number | null>(null);

  // Track if component is mounted for safe state updates after async operations
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Ref to guard against double invocation of createEmptyTrade (React StrictMode, etc.)
  const isCreatingEmptyTradeRef = useRef(false);

  

  // Check if calendar selection is required (when calendars prop is provided)
  const isCalendarSelectionMode = !!calendars;
  const isCalendarSelected = isCalendarSelectionMode ? !!(calendar?.id) : true;

  // Use primitive values for stable dependencies
  const tradeDateTimestamp = trade_date instanceof Date ? trade_date.getTime() : new Date(trade_date).getTime();
  const newTradeDateTimestamp = newTrade?.trade_date instanceof Date
    ? newTrade.trade_date.getTime()
    : newTrade?.trade_date ? new Date(newTrade.trade_date).getTime() : null;
  const calendarId = calendar?.id;

  // Pre-fetch cumulative P&L when dialog opens or trade_date changes
  useEffect(() => {
    const fetchPrecalculatedValues = async () => {
      if (!open || !calendar || !calendarId) return;

      const targetDate = newTrade?.trade_date || trade_date;

      setIsLoadingPrecalculatedValues(true);
      try {
        const [pnl, riskPct] = await Promise.all([
          calculateCumulativePnLToDateAsync(targetDate, calendar),
          calculateEffectiveRiskPercentageAsync(targetDate, calendar, dynamicRiskSettings)
        ]);
        if (isMountedRef.current) {
          setPrecalculatedPnL(pnl);
          setPrecalculatedRiskPercentage(riskPct);
        }
      } catch (err) {
        logger.error('Error fetching precalculated values:', err);
      } finally {
        if (isMountedRef.current) {
          setIsLoadingPrecalculatedValues(false);
        }
      }
    };

    fetchPrecalculatedValues();
  }, [open, calendarId, tradeDateTimestamp, newTradeDateTimestamp]);

  // Fetch day's total P&L when dialog opens or trade_date changes
  useEffect(() => {
    const fetchDayTotalPnL = async () => {
      if (!open || !calendar || !calendarId) return;

      try {
        const tradeRepo = new TradeRepository();
        const dayTrades = await tradeRepo.getTradesByDay(calendarId, trade_date, ['amount']);
        const total = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
        if (isMountedRef.current) {
          setDayTotalPnL(total);
        }
      } catch (error) {
        logger.error('Error fetching day total P&L:', error);
        if (isMountedRef.current) {
          setDayTotalPnL(0);
        }
      }
    };

    fetchDayTotalPnL();
  }, [open, tradeDateTimestamp, calendarId]);

  // Track previous showForm state to avoid unnecessary handleAddClick calls
  const prevShowFormRef = useRef<FormProps | null>(null);

  // Function to create empty trade - defined before useEffect that uses it
  const createEmptyTrade = useCallback(async () => {
    // Guard against double invocation (React StrictMode, rapid state changes)
    if (isCreatingEmptyTradeRef.current) {
      logger.warn('createEmptyTrade already in progress, skipping');
      return;
    }
    isCreatingEmptyTradeRef.current = true;

    setEditingTrade(null);
    setOriginalRiskAmount(null); // Clear original risk amount for new trades
    // Set creating empty trade state to true to disable cancel/close buttons
    setIsCreatingEmptyTrade(true);
    // Create a temporary trade object to display in the UI

    // Create an empty trade
    try {
      if (calendar?.id && onAddTrade) {

        // Update the form with the temporary trade ID and isTemporary flag
        const data = createNewTradeData();
        setNewTrade(() => ({
          ...data,
          is_temporary: true,
          name: 'New Trade',
          trade_date: trade_date // Initialize with the selected date from DayDialog
        }));

        const tradeData = await createFinalTradeData(data, trade_date);
        await onAddTrade({ ...tradeData, name: 'New Trade', is_temporary: true });
      } else {
        // Handle case where calendar_id or onAddTrade is missing
        throw new Error('Unable to create trade: Missing calendar ID or add trade function');
      }

    } catch (error) {
      logger.error('Error creating empty trade:', error);
      // We are no longer showing local snackbar for this, as the parent component handles global notifications
      // or we accept that this error is logged but not flashed to the user in the dialog context immediately.

      // Still show the form, but without the temporary trade
      setNewTrade(prev => ({
        ...prev!,
        is_temporary: false
      }));
    } finally {
      // Re-enable cancel/close buttons regardless of success or failure
      setIsCreatingEmptyTrade(false);
      isCreatingEmptyTradeRef.current = false;
    }
  }, [calendar?.id, onAddTrade, trade_date]);

  useEffect(() => {
    // Only call handleAddClick when showForm changes from not meeting conditions to meeting them
    const shouldCreateTempTrade = showForm.open && showForm.createTempTrade;
    const prevShouldCreateTempTrade = prevShowFormRef.current?.open && prevShowFormRef.current?.createTempTrade;

    if (shouldCreateTempTrade && (!prevShowFormRef.current || !prevShouldCreateTempTrade)) {
      createEmptyTrade();
    }
    else if (showForm.editTrade) {
      const prevEditTradeId = prevShowFormRef.current?.editTrade?.id;
      const currentEditTradeId = showForm.editTrade.id;
      const wasDialogClosed = !prevShowFormRef.current?.open;
      const isDialogOpening = wasDialogClosed && showForm.open;
      const isSwitchingTrade = prevEditTradeId !== currentEditTradeId;

      // Initialize form data when:
      // 1. Dialog is opening (from closed state) - need fresh data
      // 2. Switching to a different trade (by ID)
      //
      // Do NOT reinitialize when parent updates showForm.editTrade with fresh
      // database data during an active edit session - this would lose pending images
      if (isDialogOpening || isSwitchingTrade) {
        const trade = showForm.editTrade;
        setEditingTrade(trade);
        setNewTrade(createEditTradeData(trade));

        // Derive and store the original risk amount from the trade
        // This preserves the historical calculation context even if year_stats changed
        if (trade.risk_to_reward && trade.risk_to_reward > 0) {
          // For wins: riskAmount = amount / R:R
          // For losses: riskAmount = |amount|
          const derivedRiskAmount = trade.trade_type === 'win'
            ? Math.abs(trade.amount) / trade.risk_to_reward
            : Math.abs(trade.amount);
          setOriginalRiskAmount(derivedRiskAmount);
        } else {
          setOriginalRiskAmount(null);
        }
      }
    }

    // Update previous showForm ref
    prevShowFormRef.current = showForm;
  }, [showForm, createEmptyTrade]);

  useEffect(() => {
    if (newMainTrade) {
      setNewTrade(newMainTrade!);
    }
  }, [newMainTrade]);


  // Derived state 
  const allTags = useMemo(() => {
    return tags.filter((tag) => !tag.startsWith('Partials:'))
  }, [tags]);












  const showErrorSnackbar = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  const resetForm = () => {
    // Release object URLs to avoid memory leaks
    if (newTrade) {
      newTrade.pending_images.forEach(image => {
        URL.revokeObjectURL(image.preview);
      });
    }

    setEditingTrade(null);
    setOriginalRiskAmount(null); // Clear original risk amount
    setNewMainTrade(() => null);
  };



  // Function to update a specific property of a trade
  const handleUpdateTradeProperty = async (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => {
    if (!onUpdateTradeProperty) return;
    try {
      return onUpdateTradeProperty(tradeId, updateCallback, createIfNotExists);
    } catch (error) {
      logger.error('Error updating trade property:', error);
      // Removed local snackbar call, rely on global handling or specific error UI if needed
    }
  };

  // Form handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, name: e.target.value }));
  };

  const handleAmountChange = (amount: number) => {
    setNewTrade(prev => ({ ...prev!, amount: amount }));
  };

  const handleTypeChange = (e: any) => {
    setNewTrade(prev => ({ ...prev!, trade_type: e.target.value as 'win' | 'loss' | 'breakeven' }));
  };

  const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, entry_price: parseFloat(e.target.value) || 0 }));
  };

  const handleExitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, exit_price: parseFloat(e.target.value) || 0 }));
  };

  const handleStopLossChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, stop_loss: parseFloat(e.target.value) || 0 }));
  };

  const handleTakeProfitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, take_profit: parseFloat(e.target.value) || 0 }));
  };

  const handleDateChange = (newDate: Date | null) => {
    if (newDate) {
      setNewTrade(prev => ({ ...prev!, trade_date: newDate }));
    }
  };

  const handleRiskToRewardChange = (risk_to_reward: number) => {
    setNewTrade(prev => ({ ...prev!, risk_to_reward: risk_to_reward }));
  };


  const calculateFinalAmount = (trade: NewTradeForm): number => {
    // Only use risk-based calculation if risk per trade is enabled AND risk_to_reward is set AND not taking partials
    const isRiskPerTradeEnabled = dynamicRiskSettings.risk_per_trade && dynamicRiskSettings.risk_per_trade > 0;

    if (isRiskPerTradeEnabled && trade.risk_to_reward && trade.risk_to_reward > 0 && !trade.partials_taken) {
      const rr = trade.risk_to_reward;
      if (!isNaN(rr)) {
        // Use precalculated values from useEffect (no need to pass cumulativePnL)
        const calculatedAmount = calculateAmountFromRiskToReward(rr);

        // Apply sign based on trade type
        return trade.trade_type === 'loss' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
      }
    }

    // Otherwise use the amount from the form
    const amount = trade.amount || 0;
    return trade.trade_type === 'loss' ? -Math.abs(amount) : Math.abs(amount);
  };

  const createFinalTradeData = (newTrade: NewTradeForm, trade_date: Date): Trade => {
    let finalAmount = calculateFinalAmount(newTrade);
    logger.log(`trade final amount ${finalAmount}`)

    // Process tags to ensure proper formatting
    let finalTags = processTagsForSubmission([...newTrade.tags]);

    // Add Partials tag if partialsTaken is true
    if (newTrade.partials_taken) {
      // Remove any existing Partials tags
      finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
      finalTags.push('Partials:Yes');
    }

    const currentDate = new Date();

    // Use the trade's date if it exists (when editing), otherwise use the provided date
    const tradeDate = newTrade.trade_date || trade_date;

    // Note: Economic events are now automatically fetched by the TradeRepository layer
    // during trade creation/update based on session, date, and tags

    return {
      id: newTrade.id || uuidv4(),
      is_temporary: newTrade.is_temporary,
      trade_date: new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
        currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds()),
      trade_type: newTrade.trade_type,
      amount: finalAmount,
      ...(newTrade.name && { name: newTrade.name }),
      ...(newTrade.entry_price && { entry_price: newTrade.entry_price }),
      ...(newTrade.exit_price && { exit_price: newTrade.exit_price }),
      ...(newTrade.stop_loss && { stop_loss: newTrade.stop_loss }),
      ...(newTrade.take_profit && { take_profit: newTrade.take_profit }),
      ...(finalTags.length > 0 && { tags: finalTags }),
      ...(newTrade.risk_to_reward && { risk_to_reward: newTrade.risk_to_reward }),
      partials_taken: newTrade.partials_taken,
      session: newTrade.session || '', // Always include session
      ...(newTrade.notes && { notes: newTrade.notes }),
      images: newTrade.uploaded_images || [],
      // Economic events will be fetched automatically by TradeRepository
      ...(newTrade.economic_events && newTrade.economic_events.length > 0 && { economic_events: newTrade.economic_events }),
      calendar_id: calendar.id!,
      user_id: '', // Will be set by the service layer
      created_at: new Date(),
      updated_at: new Date()
    }
  }

  // Calculate amount based on risk per trade (as percentage of account balance) and risk-to-reward ratio
  // When editing: uses the original risk amount derived from the trade to preserve historical context
  // When creating: uses precalculated values from current cumulative P&L
  const calculateAmountFromRiskToReward = (risk_to_reward: number): number => {
    if (!newTrade || !risk_to_reward || !account_balance || newTrade.trade_type === 'breakeven') return 0;

    // Use original risk amount when editing (preserves the historical calculation context)
    // For new trades, calculate from current cumulative P&L
    let riskAmount: number;
    if (originalRiskAmount !== null) {
      // Editing: use the derived original risk amount
      riskAmount = originalRiskAmount;
    } else {
      // New trade: calculate from current state
      const effectiveRiskPercentage = precalculatedRiskPercentage || dynamicRiskSettings.risk_per_trade || 0;
      riskAmount = calculateRiskAmount(effectiveRiskPercentage, account_balance, precalculatedPnL);
    }

    // For win trades: risk amount * R:R
    // For loss trades: risk amount
    return newTrade.trade_type === 'win'
      ? Math.round(riskAmount * risk_to_reward)
      : Math.round(riskAmount);
  };




  const handlePartialsTakenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const partialsTaken = e.target.checked;
    setNewTrade(prev => ({ ...prev!, partialsTaken }));


  };

  const handleSessionChange = (e: any) => {
    setNewTrade(prev => ({ ...prev!, session: e.target.value }));
  };

  const handleNotesChange = (value: string) => {
    setNewTrade(prev => ({ ...prev!, notes: value }));
  };

  const handleTagsChange = (_event: React.SyntheticEvent, newValue: string[]) => {
    // Capitalize tag groups before saving
    const formattedTags = formatTagsWithCapitalizedGroups(newValue);
    setNewTrade(prev => ({ ...prev!, tags: formattedTags }));
  };




  const handleImageUpload = async (files: FileList) => {
    // Validate files using utility function
    const { validFiles, oversizedFiles, invalidTypeFiles } = validateFiles(files, FILE_SIZE_LIMITS.IMAGE_1MB);

    // Show error messages for rejected files
    const errorMessages: string[] = [];

    if (oversizedFiles.length > 0) {
      errorMessages.push(`The following files exceed the 1MB size limit: ${oversizedFiles.join(', ')}`);
    }

    if (invalidTypeFiles.length > 0) {
      errorMessages.push(`The following files are not supported image types: ${invalidTypeFiles.join(', ')}`);
    }

    if (errorMessages.length > 0) {
      // Log errors instead of showing snackbar
      logger.error('File validation errors:', errorMessages.join(' '));
    }

    // If no valid files, return early
    if (validFiles.length === 0) {
      return;
    }

    const getDimensions = (url: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
          });
        };
        img.src = url;
      });
    };

    const newPendingImages = await Promise.all(
      validFiles.map(async (file) => {
        const preview = URL.createObjectURL(file);
        const dimensions = await getDimensions(preview);

        return {
          id: calendarService.generateImageId(file),
          file,
          preview,
          caption: '',
          width: dimensions.width,
          height: dimensions.height
        };
      })
    );

    // Add the new images to the state with grid layout information
    let pending_images: PendingImage[] = []
    setNewTrade((prev) => {
      const existingPendingImages = prev!.pending_images;
      const existingUploadedImages = prev!.uploaded_images;

      // Find the highest row value to place new images below existing ones
      let maxRow = -1;

      [...existingPendingImages, ...existingUploadedImages].forEach(img => {
        if (img.row !== undefined && img.row > maxRow) maxRow = img.row;
      });

      // Assign row and column to new images - each in its own row
      const newImagesWithLayout = newPendingImages.map((img, index) => {
        // Place each new image in its own row below all existing images
        const newRow = maxRow + 1 + index;

        return {
          ...img,
          row: newRow,
          column: 0, // Always place in first column
          column_width: 100 // Full width for the row
        };
      });
      pending_images = [...existingPendingImages, ...newImagesWithLayout]
      return {
        ...prev!,
        pending_images: pending_images,
      };
    });

    // Start uploading the images if we have a temporary trade ID
    try {

      // First, ensure the trade exists in the database and is in the cached trades
      const trade = await handleUpdateTradeProperty(newTrade!.id!!, (trade) => {
        // Calculate row and column for new images
        const existingImages = trade.images || [];
        // Find the highest row value to place new images below existing ones
        let maxRow = -1;

        existingImages.forEach(img => {
          if (img.row !== undefined && img.row > maxRow) maxRow = img.row;
        });

        // Assign row and column to new images - each in its own row
        const newImages = newPendingImages.map((img, index) => {
          // Place each new image in its own row below all existing images
          const newRow = maxRow + 1 + index;

          return {
            url: img.preview,
            pending: true,
            calendar_id: calendar.id!,
            id: img.id,
            width: img.width,
            height: img.height,
            caption: img.caption,
            row: newRow,
            column: 0, // Always place in first column
            column_width: 100 // Full width for the row
          };
        });

        return {
          ...trade,
          images: [...existingImages, ...newImages]
        };
      },
        (tradeid: string) => {
          // setIsCreatingEmptyTrade(true);
          // Create a temporary trade object if it doesnt exist
          // Note: Economic events will be added later via async update 
          const currentDate = new Date();
          const tradeDate = newTrade!.trade_date || trade_date;
          const finalAmount = calculateFinalAmount(newTrade!);
          let finalTags = processTagsForSubmission([...newTrade!.tags]);

          if (newTrade!.partials_taken) {
            finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
            finalTags.push('Partials:Yes');
          }

          return {
            id: tradeid,
            is_temporary: true,
            trade_date: new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
              currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds()),
            trade_type: newTrade!.trade_type,
            amount: finalAmount,
            name: newTrade!.name || 'New Trade',
            ...(newTrade!.entry_price && { entry_price: newTrade!.entry_price }),
            ...(newTrade!.exit_price && { exit_price: newTrade!.exit_price }),
            ...(newTrade!.stop_loss && { stop_loss: newTrade!.stop_loss }),
            ...(newTrade!.take_profit && { take_profit: newTrade!.take_profit }),
            ...(finalTags.length > 0 && { tags: finalTags }),
            ...(newTrade!.risk_to_reward && { risk_to_reward: newTrade!.risk_to_reward }),
            partials_taken: newTrade!.partials_taken,
            session: newTrade!.session || '', // Always include session
            ...(newTrade!.notes && { notes: newTrade!.notes }),
            images: newTrade!.uploaded_images || [],
            calendar_id: calendar.id!,
            user_id: '', // Will be set by the service layer
            created_at: new Date(),
            updated_at: new Date()
          };
        });

      if (trade && trade.is_temporary) {
        setNewTrade(prev => {
          return {
            ...prev!,
            is_temporary: true
          };
        })
      }

      // Upload all images in parallel
      const uploadPromises = newPendingImages.map(image =>
        uploadImageAndTrackProgress(image, newTrade!.id!!, pending_images)
      );

      // Wait for all uploads to complete (success or fail)
      const uploadedResults = await Promise.all(uploadPromises);

      // Filter out successful uploads (non-null)
      const successfulUploads = uploadedResults.filter((img): img is TradeImage => img !== null);

      // If we have successful uploads, perform ONE batch update to the database
      if (successfulUploads.length > 0 && calendar?.id && newTrade!.id!!) {
        try {
          await handleUpdateTradeProperty(newTrade!.id!!, (trade) => {
            const existingImages = trade.images || [];

            // Create a map of updated images for O(1) lookup
            const updatedImagesMap = new Map(successfulUploads.map(img => [img.id, img]));

            // Create a set of existing image IDs for quick lookup
            const existingImageIds = new Set(existingImages.map(img => img.id));

            // Map over existing images: if it's one of the successfully uploaded ones, update it
            const mergedImages = existingImages.map(existingImg => {
              if (updatedImagesMap.has(existingImg.id)) {
                const updatedImg = updatedImagesMap.get(existingImg.id)!;
                return {
                  ...updatedImg,
                  // Preserve layout info (should already be in updatedImg but safety check)
                  row: existingImg.row !== undefined ? existingImg.row : updatedImg.row,
                  column: existingImg.column !== undefined ? existingImg.column : updatedImg.column,
                  column_width: existingImg.column_width !== undefined ? existingImg.column_width : updatedImg.column_width
                };
              }
              return existingImg;
            });

            // IMPORTANT: Add any uploaded images that aren't already in the database
            // This handles race conditions where the first update (adding pending images)
            // hasn't propagated to the database yet
            const newImagesToAdd = successfulUploads.filter(img => !existingImageIds.has(img.id));
            if (newImagesToAdd.length > 0) {
              logger.log(`Adding ${newImagesToAdd.length} images that weren't in database yet (race condition protection)`);
            }

            return {
              ...trade,
              images: [...mergedImages, ...newImagesToAdd]
            };
          });
          logger.log(`Updated trade with ${successfulUploads.length} uploaded images`);
        } catch (updateError) {
          logger.error('Error batch updating trade with new images:', updateError);
          // Removed local snackbar call
        }
      }

    } catch (error) {
      logger.error('Error processing image uploads:', error);
    }
  };

  // Function to upload a single image, update local state, AND return the uploaded image object
  // Does NOT update the database directly
  const uploadImageAndTrackProgress = async (image: PendingImage, tradeId: string, pending_images: PendingImage[]): Promise<TradeImage | null> => {
    try {
      // Upload the image
      const uploadedImage: TradeImage = await calendarService.uploadTradeImage(
        calendar.id!,
        image.id!!,
        image.file,
        image.width,
        image.height,
        image.caption
      );

      // Once upload is complete, move from pending_images to uploadedImages
      // Find the original pending image to get its layout information
      const originalPendingImage = pending_images.find(img => img.id === image.id);
      // Preserve layout information
      const updatedImage = {
        ...uploadedImage,
        caption: image.caption,
        row: originalPendingImage?.row || 0,
        column: originalPendingImage?.column || 0,
        column_width: originalPendingImage?.column_width || 100
      };

      // Update local state - but only if image wasn't deleted during upload
      let wasDeleted = false;
      setNewTrade(prev => {
        const newPendingImages = [...prev!.pending_images];
        // Check if the image still exists in pending_images
        const imageIndex = newPendingImages.findIndex(img => img.id === image.id);

        if (imageIndex === -1) {
          // Image was deleted during upload - don't add to uploaded_images
          wasDeleted = true;
          logger.log(`Image ${image.id} was deleted during upload, skipping`);
          return prev;
        }

        // Remove from pending_images
        newPendingImages.splice(imageIndex, 1);

        // Find the image where pending is true in the uploadedImages list
        // Setting pending to the image is useful for show shimmer in tradeDetail
        const newUploadedImages = [...prev!.uploaded_images];
        const uploadedIndex = newUploadedImages.findIndex(img => img.id === image.id);
        if (uploadedIndex !== -1 && newUploadedImages[uploadedIndex].pending) {
          newUploadedImages.splice(uploadedIndex, 1);
        }

        return {
          ...prev!,
          pending_images: newPendingImages,
          uploaded_images: [...newUploadedImages, updatedImage]
        };
      });

      // Return null if image was deleted so database update skips it
      return wasDeleted ? null : updatedImage;

    } catch (error) {
      logger.error(`Error uploading image ${image.id}:`, error);

      // Remove failed image from pending (local state)
      setNewTrade(prev => ({
        ...prev!,
        pending_images: prev!.pending_images.filter((img) => img.id !== image.id)
      }));

      // Also remove failed image from database
      if (newTrade?.id) {
        handleUpdateTradeProperty(newTrade.id, (trade) => ({
          ...trade,
          images: (trade.images || []).filter(img => img && img.id !== image.id)
        })).then(() => {
          logger.log(`Removed failed upload ${image.id} from database`);
        }).catch(err => {
          logger.error(`Failed to remove failed upload ${image.id} from database:`, err);
        });
      }

      return null;
    }
  };


  const handleImageCaptionChange = async (index: number, caption: string, isPending: boolean) => {
    try {
      if (isPending) {
        // Update caption for pending image
        setNewTrade(prev => ({
          ...prev!,
          pending_images: prev!.pending_images.map((img, i) =>
            i === index ? { ...img, caption } : img
          )
        }));
      } else {
        // Update caption for uploaded image
        setNewTrade(prev => ({
          ...prev!,
          uploaded_images: prev!.uploaded_images.map((img, i) =>
            i === index ? { ...img, caption } : img
          )
        }));
      }
    } catch (error) {
      logger.error('Error in handleImageCaptionChange:', error);
      // Don't show error to user for caption changes as it's not critical
    }
  };


  const handleImageRemove = async (index: number, isPending: boolean) => {
    try {
      // Guard against invalid index (can happen if image ID matching fails)
      if (index < 0) {
        logger.error('handleImageRemove called with invalid index:', index, 'isPending:', isPending);
        return;
      }

      if (isPending) {
        const image = newTrade!.pending_images[index];
        if (!image) {
          logger.error('Pending image not found at index:', index);
          return;
        }

        const imageId = image.id;

        // Release object URL to avoid memory leaks
        URL.revokeObjectURL(image.preview);

        // Update local state - remove from pending_images
        // When upload completes, it will see the image is gone and skip adding it
        setNewTrade(prev => ({
          ...prev!,
          pending_images: prev!.pending_images.filter((_, i) => i !== index)
        }));

        // Also remove from database - the image may have been added with pending:true
        if (imageId && newTrade?.id) {
          handleUpdateTradeProperty(newTrade.id, (trade) => ({
            ...trade,
            images: (trade.images || []).filter(img => img && img.id !== imageId)
          })).then(() => {
            logger.log(`Removed pending image ${imageId} from database`);
          }).catch(err => {
            logger.error(`Failed to remove pending image ${imageId} from database:`, err);
          });
        }
      } else {
        const image = newTrade!.uploaded_images[index];
        if (!image) {
          logger.error('Uploaded image not found at index:', index);
          return;
        }

        // Update local state for immediate UI feedback
        // The actual database update happens when user clicks Save
        // Edge function (handle-trade-changes) will clean up removed images from storage
        setNewTrade(prev => ({
          ...prev!,
          uploaded_images: prev!.uploaded_images.filter((_, i) => i !== index)
        }));

        logger.log(`Image ${image.id} removed from UI - will be deleted from storage on save`);
      }
    } catch (error) {
      logger.error('Error in handleImageRemove:', error);
      // showErrorSnackbar('Failed to remove image. Please try again.');
    }
  };
  // Handle image reordering
  const handleImagesReordered = async (images: Array<GridImage | GridPendingImage>) => {
    logger.log("handleImagesReordered called with images:",
      images.map(img => ({ id: img.id, row: img.row, column: img.column, column_width: img.column_width })));

    // Separate pending and uploaded images
    const pending_images = images.filter(img => 'file' in img) as GridPendingImage[];
    const uploadedImages = images.filter(img => !('file' in img)) as GridImage[];

    // Update local state
    setNewTrade(prev => ({
      ...prev!,
      pending_images: pending_images as PendingImage[],
      uploaded_images: uploadedImages
    }));

  };

  // Handle tag updates from the edit dialog
  const handleTagUpdated = async (oldTag: string, newTag: string) => {
    // Update the tags in the current form if needed
    if (newTrade && newTrade.tags.includes(oldTag)) {
      setNewTrade(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tags: prev.tags.map(tag => tag === oldTag ? newTag : tag).filter((tag: string) => tag !== '')
        };
      });
    }

    // Update the cached trades list
    if (onTagUpdated) {
      return await onTagUpdated(oldTag, newTag);
    }

    return { success: true, tradesUpdated: 0 };
  };

  const hasPendingUploads = (): boolean => newTrade!.pending_images.length > 0;

  // Check if all required tag groups are present in the trade's tags
  const validateRequiredTagGroups = (tags: string[]): { valid: boolean; missingGroups: string[] } => {
    // Automatically add "pair" to required tag groups if not already present
    const effectiveRequiredGroups = [...(requiredTagGroups || [])];
    if (!effectiveRequiredGroups.includes(DEFAULT_PAIRS_TAG_GROUP)) {
      effectiveRequiredGroups.push(DEFAULT_PAIRS_TAG_GROUP);
    }

    if (effectiveRequiredGroups.length === 0) {
      return { valid: true, missingGroups: [] };
    }

    // Get all groups present in the tags
    const presentGroups = new Set<string>();
    tags.forEach(tag => {
      if (tag.includes(':')) {
        const group = tag.split(':')[0];
        presentGroups.add(group);
      }
    });

    // Find missing required groups
    const missingGroups = effectiveRequiredGroups.filter(group => !presentGroups.has(group));

    return {
      valid: missingGroups.length === 0,
      missingGroups
    };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!onAddTrade) return;
    if (!newTrade) {
      logger.error('Form state not initialized');
      return;
    }

    // Prevent saving while precalculated values are loading (would result in incorrect amounts)
    if (isLoadingPrecalculatedValues) {
      logger.warn('Precalculated values still loading, prevented submission');
      showErrorSnackbar('Please wait for risk calculations to complete');
      return;
    }

    // Validate form
    if (!newTrade.amount) {
      logger.error('Validation error: Amount is required');
      showErrorSnackbar('Amount is required');
      return;
    }
    if (!newTrade.session) {
      logger.error('Validation error: Session is required');
      showErrorSnackbar('Session is required. Please select a trading session.');
      return;
    }
    if (!newTrade.risk_to_reward || newTrade.risk_to_reward <= 0) {
      logger.error('Validation error: Risk to reward is required');
      showErrorSnackbar('Risk to reward is required');
      return;
    }

    // Validate required tag groups
    const { valid, missingGroups } = validateRequiredTagGroups(newTrade.tags);
    if (!valid) {
      logger.error(`Validation error: Missing required tag groups: ${missingGroups.join(', ')}`);
      showErrorSnackbar(`Missing required tag groups: ${missingGroups.join(', ')}`);
      return;
    }

    // Check if there are any pending image uploads
    if (hasPendingUploads()) {
      logger.warn('Image uploads pending, prevented submission');
      showErrorSnackbar('Please wait for images to finish uploading');
      return;
    }

    // Capture all data needed BEFORE closing the dialog
    const tradeData = createFinalTradeData(newTrade!, trade_date);
    const isTemporary = newTrade!.is_temporary;
    const tradeId = newTrade!.id;

    // Close dialog immediately (optimistic approach)
    resetForm();
    onCancel();

    // Save in background
    try {
      if (isTemporary && tradeId) {
        await onUpdateTradeProperty?.(tradeId, () => ({
          ...tradeData,
          is_temporary: false,
          updated_at: new Date()
        }));
      } else {
        await onAddTrade(tradeData);
      }
      logger.log('Trade saved successfully');
    } catch (err) {
      error('Error in trade submission:', err);

      // Cleanup temporary trade on failure
      if (isTemporary && tradeId && onDeleteTrades) {
        try {
          await onDeleteTrades([tradeId]);
          log('Cleaned up temporary trade after failed update');
        } catch (cleanupError) {
          error('Failed to cleanup temporary trade:', cleanupError);
        }
      }

      // Show error only if component is still mounted
      if (isMountedRef.current) {
        // Parent component handles global notifications for failures
        logger.error(err instanceof Error ? err.message : 'Failed to save trade.');
      }
    }
  };

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTrade) return;
    if (!newTrade) {
      logger.error('Form state not initialized');
      return;
    }

    // Validate form
    if (!newTrade.amount) {
      logger.error('Validation error: Amount is required');
      showErrorSnackbar('Amount is required');
      return;
    }
    if (!newTrade.session) {
      logger.error('Validation error: Session is required');
      showErrorSnackbar('Session is required. Please select a trading session.');
      return;
    }

    // Validate required tag groups
    const { valid, missingGroups } = validateRequiredTagGroups(newTrade.tags);
    if (!valid) {
      logger.error(`Validation error: Missing required tag groups: ${missingGroups.join(', ')}`);
      showErrorSnackbar(`Missing required tag groups: ${missingGroups.join(', ')}`);
      return;
    }

    // Validate trade date is not in the future
    if (newTrade.trade_date && newTrade.trade_date > new Date()) {
      logger.error('Validation error: Trade date cannot be in the future');
      showErrorSnackbar('Trade date cannot be in the future');
      return;
    }

    // Check if there are any pending image uploads
    // Check if there are any pending image uploads
    if (hasPendingUploads()) {
      logger.warn('Image uploads pending, prevented update');
      showErrorSnackbar('Please wait for images to finish uploading');
      return;
    }

    // Capture all data needed BEFORE closing the dialog
    const tradeId = editingTrade.id;
    const finalAmount = calculateFinalAmount(newTrade!);
    let finalTags = processTagsForSubmission([...newTrade!.tags]);

    // Add Partials tag if partialsTaken is true
    if (newTrade!.partials_taken) {
      finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
      finalTags.push('Partials:Yes');
    } else {
      finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
    }

    // Prepare the images array with layout information
    const updatedImages = [
      ...newTrade!.pending_images.map(img => ({
        url: img.preview || '',
        id: img.id!,
        calendar_id: calendar.id!,
        pending: true,
        caption: img.caption || '',
        width: img.width || 0,
        height: img.height || 0,
        row: img.row !== undefined ? img.row : 0,
        column: img.column !== undefined ? img.column : 0,
        column_width: img.column_width !== undefined ? img.column_width : 100
      })),
      ...newTrade!.uploaded_images.map(img => ({
        url: img.url || '',
        id: img.id,
        calendar_id: calendar.id!,
        pending: img.pending,
        caption: img.caption || '',
        width: img.width || 0,
        height: img.height || 0,
        row: img.row !== undefined ? img.row : 0,
        column: img.column !== undefined ? img.column : 0,
        column_width: img.column_width !== undefined ? img.column_width : 100
      }))
    ];

    // Capture form values for background update
    const updateData = {
      trade_type: newTrade!.trade_type,
      amount: finalAmount,
      name: newTrade!.name || "",
      entry_price: newTrade!.entry_price || undefined,
      exit_price: newTrade!.exit_price || undefined,
      stop_loss: newTrade!.stop_loss || undefined,
      take_profit: newTrade!.take_profit || undefined,
      trade_date: newTrade!.trade_date,
      is_temporary: newTrade?.is_temporary && !newTrade.name,
      tags: finalTags || [],
      risk_to_reward: newTrade!.risk_to_reward || 1,
      partials_taken: newTrade!.partials_taken,
      session: newTrade!.session || "London",
      notes: newTrade!.notes || "",
      images: updatedImages
    };

    // Close dialog immediately (optimistic approach)
    resetForm();
    onCancel();

    // Update in background
    try {
      if (!tradeId) {
        throw new Error('Cannot update trade: Missing trade ID');
      }

      await onUpdateTradeProperty?.(tradeId, (trade) => {
        const currentDate = new Date();
        const tradeDate = updateData.trade_date || trade.trade_date;
        const updatedDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
          currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());

        return {
          ...trade,
          ...updateData,
          trade_date: updatedDate,
          updated_at: new Date()
        };
      });

      logger.log('Trade updated successfully');
    } catch (err) {
      logger.error('Error editing trade:', err);

      // Show error only if component is still mounted
      if (isMountedRef.current) {
        logger.error(err instanceof Error ? err.message : 'Failed to update trade.');
      }
    }
  };

  return (
    <>
      <BaseDialog
        open={open}
        onClose={() => {
          // Only allow closing if we're not in the process of creating an empty trade
          if (!isCreatingEmptyTrade) {
            if (editingTrade) {
              resetForm();
            }
            onClose();
          }
        }}
        title="Daily Trades"
        maxWidth="md"
        fullWidth
        hideCloseButton={isCreatingEmptyTrade} // Disable close button when creating empty trade
        primaryButtonText={(editingTrade ? 'Update Trade' : 'Add Trade')}
        primaryButtonAction={(editingTrade ?
          (e?: React.FormEvent) => handleEditSubmit(e) :
          (e?: React.FormEvent) => handleSubmit(e)
        )}
        isSubmitting={isSubmitting || isCreatingEmptyTrade || (!editingTrade && isLoadingPrecalculatedValues)} // Disable while creating empty trade or loading risk calculations (only for new trades)
        cancelButtonAction={() => {
          // Only allow canceling if we're not in the process of creating an empty trade
          if (!isCreatingEmptyTrade) {
            resetForm();
            onCancel();
          }
        }}
        hideFooterCancelButton={false}
        sx={{ zIndex: Z_INDEX.DIALOG_POPUP }} // Higher z-index to appear above TradeGalleryDialog
      >
        <Box sx={{ p: 3 }}>

          {/* Calendar Selection Dropdown (only shown when calendars prop is provided) */}
          {isCalendarSelectionMode && (
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth required>
                <InputLabel id="trade-calendar-select-label">Calendar</InputLabel>
                <Select
                  labelId="trade-calendar-select-label"
                  id="trade-calendar-select"
                  value={calendar?.id || ''}
                  label="Calendar"
                  onChange={(e) => onCalendarChange?.(e.target.value)}
                  disabled={isSubmitting || isCreatingEmptyTrade}
                  MenuProps={{
                    sx: { zIndex: Z_INDEX.DIALOG_POPUP }
                  }}
                >
                  {calendars?.map((calendar) => (
                    <MenuItem key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <DayHeader
            title={format(trade_date, 'EEEE, MMMM d, yyyy')}
            account_balance={account_balance + precalculatedPnL}
            formInputVisible={true}
            total_pnl={dayTotalPnL}
            onPrevDay={() => { }}
            onNextDay={() => { }}
          />

          <Box sx={{
            opacity: isCalendarSelected ? 1 : 0.5,
            pointerEvents: isCalendarSelected ? 'auto' : 'none'
          }}>
            <TradeForm
              accountBalance={account_balance}
              calculateCumulativePnl={() => precalculatedPnL}
              dynamicRiskSettings={dynamicRiskSettings}
              calendarId={calendar?.id || ''}
              requiredTagGroups={requiredTagGroups}
              onTagUpdated={handleTagUpdated}
              newTrade={newTrade!}
              editingTrade={editingTrade}
              allTags={allTags}
              isSubmitting={isSubmitting}
              isLoadingPrecalculatedValues={!editingTrade && isLoadingPrecalculatedValues}
              calculateAmountFromRiskToReward={calculateAmountFromRiskToReward}
              onNameChange={handleNameChange}
              onAmountChange={handleAmountChange}
              onTypeChange={handleTypeChange}
              onEntryChange={handleEntryChange}
              onExitChange={handleExitChange}
              onStopLossChange={handleStopLossChange}
              onTakeProfitChange={handleTakeProfitChange}
              onRiskToRewardChange={handleRiskToRewardChange}
              onPartialsTakenChange={handlePartialsTakenChange}
              onSessionChange={handleSessionChange}
              onNotesChange={handleNotesChange}
              onTagsChange={handleTagsChange}
              onDateChange={handleDateChange}
              onImageUpload={handleImageUpload}
              onImageCaptionChange={handleImageCaptionChange}
              onImageRemove={handleImageRemove}
              onImagesReordered={handleImagesReordered}
              onSubmit={editingTrade ? handleEditSubmit : handleSubmit}
              onOpenGalleryMode={onOpenGalleryMode}
            />


          </Box>
        </Box>
      </BaseDialog>

      {/* Error Snackbar */}
      <Snackbar
        open={showError}
        autoHideDuration={4000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: Z_INDEX.SNACKBAR }}
      >
        <Alert onClose={handleCloseError} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>

    </>
  );
};

export default TradeFormDialog;
