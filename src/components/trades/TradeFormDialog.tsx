import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  calculateEffectiveRiskPercentage,
  calculateCumulativePnLToDate,
  calculateRiskAmount,
  DynamicRiskSettings
} from '../../utils/dynamicRiskUtils';
import { error, log, logger } from '../../utils/logger';
import { validateFiles, FILE_SIZE_LIMITS } from '../../utils/fileValidation';
import { formatTagsWithCapitalizedGroups } from '../../utils/tagColors';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  newMainTrade?: NewTradeForm | null
  trade_date: Date;
  showForm: FormProps;
  trades: Trade[];
  account_balance: number;

  onAddTrade?: (trade: Trade & { id?: string }) => Promise<void>;
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onDeleteTrades?: (tradeIds: string[]) => Promise<void>;
  onAccountBalanceChange?: (balance: number) => void;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  setNewMainTrade: (prev: (trade: NewTradeForm) => NewTradeForm | null) => void
  onCancel: () => void;
  allTrades?: Trade[];
  dynamicRiskSettings: DynamicRiskSettings;
  calendar_id?: string; // Made optional for Home.tsx usage
  tags: string[];
  requiredTagGroups?: string[];
  // Optional props for trade link navigation in notes
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Optional props for calendar selection (used when opened from Home.tsx)
  calendars?: Calendar[];
  onCalendarChange?: (calendarId: string) => void;
  selectedCalendarId?: string;
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

// Calculate cumulative PnL up to a given date (using centralized utility)
export const calculateCumulativePnL = (trade_date: Date, allTrades: Trade[]) => {
  return calculateCumulativePnLToDate(trade_date, allTrades);
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
    uploaded_images: trade.images ? trade.images.map((img, index) => ({
      ...img,
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
  trades,
  account_balance,
  showForm,
  onCancel,
  onAddTrade,
  onTagUpdated,
  onUpdateTradeProperty,
  onDeleteTrades,
  allTrades = [],
  dynamicRiskSettings,
  calendar_id,
  tags = [],
  requiredTagGroups = [],
  onOpenGalleryMode,
  calendars,
  onCalendarChange,
  selectedCalendarId
}) => {

  // State

  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingEmptyTrade, setIsCreatingEmptyTrade] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);

  // Determine the effective calendar_id (from prop or selected calendar)
  const effectiveCalendarId = calendar_id || selectedCalendarId;

  // Check if calendar selection is required (when calendars prop is provided)
  const isCalendarSelectionMode = !!calendars;
  const isCalendarSelected = isCalendarSelectionMode ? !!effectiveCalendarId : true;



  // Track previous showForm state to avoid unnecessary handleAddClick calls
  const prevShowFormRef = useRef<FormProps | null>(null);

  // Function to create empty trade - defined before useEffect that uses it
  const createEmptyTrade = useCallback(async () => {
    setEditingTrade(null);
    // Set creating empty trade state to true to disable cancel/close buttons
    setIsCreatingEmptyTrade(true);
    // Create a temporary trade object to display in the UI

    // Create an empty trade
    try {
      if (effectiveCalendarId && onAddTrade) {

        // Update the form with the temporary trade ID and isTemporary flag
        const data = createNewTradeData();
        setNewTrade(() => ({
          ...data,
          is_temporary: true,
          name: 'New Trade'
        }));

        const tradeData = await createFinalTradeData(data, trade_date);
        await onAddTrade({ ...tradeData, name: 'New Trade', is_temporary: true });
      } else {
        // Handle case where calendar_id or onAddTrade is missing
        throw new Error('Unable to create trade: Missing calendar ID or add trade function');
      }

    } catch (error) {
      logger.error('Error creating empty trade:', error);
      showErrorSnackbar(error instanceof Error ?
        `Failed to create temporary trade: ${error.message}` :
        'Failed to create temporary trade. Please try again.');

      // Still show the form, but without the temporary trade
      setNewTrade(prev => ({
        ...prev!,
        is_temporary: false
      }));
    } finally {
      // Re-enable cancel/close buttons regardless of success or failure
      setIsCreatingEmptyTrade(false);
    }
  }, [effectiveCalendarId, onAddTrade, trade_date]);

  useEffect(() => {
    // Only call handleAddClick when showForm changes from not meeting conditions to meeting them
    const shouldCreateTempTrade = showForm.open && showForm.createTempTrade;
    const prevShouldCreateTempTrade = prevShowFormRef.current?.open && prevShowFormRef.current?.createTempTrade;

    if (shouldCreateTempTrade && (!prevShowFormRef.current || !prevShouldCreateTempTrade)) {
      createEmptyTrade();
    }
    else if (showForm.editTrade) {
      setEditingTrade(showForm.editTrade);
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










  // Function to show error messages in a Snackbar
  const showErrorSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // Function to handle Snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const resetForm = () => {
    // Release object URLs to avoid memory leaks
    if (newTrade) {
      newTrade.pending_images.forEach(image => {
        URL.revokeObjectURL(image.preview);
      });
    }

    setEditingTrade(null);
    setNewMainTrade(() => null);


  };



  // Function to update a specific property of a trade
  const handleUpdateTradeProperty = async (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => {
    if (!onUpdateTradeProperty) return;
    try {
      return onUpdateTradeProperty(tradeId, updateCallback, createIfNotExists);
    } catch (error) {
      logger.error('Error updating trade property:', error);
      showErrorSnackbar(error instanceof Error ? error.message : 'Failed to update trade property. Please try again.');
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
        const calculatedAmount = calculateAmountFromRiskToReward(rr, calculateCumulativePnL(trade.trade_date || endOfDay(trade_date), allTrades));

        // Apply sign based on trade type
        return trade.trade_type === 'loss' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
      }
    }

    // Otherwise use the amount from the form
    const amount = trade.amount || 0;
    return trade.trade_type === 'loss' ? -Math.abs(amount) : Math.abs(amount);
  };

  const createFinalTradeData =   (newTrade: NewTradeForm, trade_date: Date) : Trade => {
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
      ...(newTrade.session && { session: newTrade.session }),
      ...(newTrade.notes && { notes: newTrade.notes }),
      images: newTrade.uploaded_images || [],
      // Economic events will be fetched automatically by TradeRepository
      ...(newTrade.economic_events && newTrade.economic_events.length > 0 && { economic_events: newTrade.economic_events }),
      calendar_id: effectiveCalendarId!,
      user_id: '', // Will be set by the service layer
      created_at: new Date(),
      updated_at: new Date()
    }
  }

  // Calculate amount based on risk per trade (as percentage of account balance) and risk-to-reward ratio
  const calculateAmountFromRiskToReward = (risk_to_reward: number, cumulativePnL: number): number => {
    if (!newTrade || !risk_to_reward || !account_balance || newTrade.trade_type === 'breakeven') return 0;

    
    const tradeDate = newTrade.trade_date || trade_date;
    const effectiveRiskPercentage = calculateEffectiveRiskPercentage(tradeDate, allTrades, dynamicRiskSettings);
    const riskAmount = calculateRiskAmount(effectiveRiskPercentage, account_balance, cumulativePnL);

  

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
      showErrorSnackbar(errorMessages.join(' '));
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
          id: calendarService.generateImageId(),
          file,
          preview,
          caption: '',
          width: dimensions.width,
          height: dimensions.height,
          upload_progress: 0
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
            calendar_id: effectiveCalendarId!,
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
            ...(newTrade!.session && { session: newTrade!.session }),
            ...(newTrade!.notes && { notes: newTrade!.notes }),
            images: newTrade!.uploaded_images || [],
            calendar_id: effectiveCalendarId!,
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
      if (successfulUploads.length > 0 && effectiveCalendarId && newTrade!.id!!) {
        try {
          await handleUpdateTradeProperty(newTrade!.id!!, (trade) => {
            const existingImages = trade.images || [];
            
            // Create a map of updated images for O(1) lookup
            const updatedImagesMap = new Map(successfulUploads.map(img => [img.id, img]));

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

            return {
              ...trade,
              images: mergedImages
            };
          });
          logger.log(`Updated trade with ${successfulUploads.length} uploaded images`);
        } catch (updateError) {
          logger.error('Error batch updating trade with new images:', updateError);
          showErrorSnackbar('Failed to save images to trade. They are uploaded but not saved to the trade.');
        }
      }

    } catch (error) {
      logger.error('Error processing image uploads:', error);
    }
  };

  // Function to upload a single image, track progress, update local state, AND return the uploaded image object
  // Does NOT update the database directly
  const uploadImageAndTrackProgress = async (image: PendingImage, tradeId: string, pending_images: PendingImage[]): Promise<TradeImage | null> => {
    try {
      // Update progress to show upload has started
      setNewTrade(prev => ({
        ...prev!,
        pending_images: prev!.pending_images.map((img) =>
          img.id === image.id ? { ...img, upload_progress: 1 } : img
        )
      }));

      // Upload the image with progress tracking
      const uploadedImage: TradeImage = await calendarService.uploadTradeImage(
        effectiveCalendarId!,
        image.id!!,
        image.file,
        image.width,
        image.height,
        image.caption,
        (progress: number) => {
          // Update progress in the UI
          setNewTrade(prev => ({
            ...prev!,
            pending_images: prev!.pending_images.map((img) =>
              img.id === image.id ? { ...img, upload_progress: progress } : img
            )
          }));
        }
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

      // Update local state
      setNewTrade(prev => {
        const newPendingImages = [...prev!.pending_images];
        // Remove the uploaded image from pending_images
        let imageIndex = newPendingImages.findIndex(img => img.id === image.id);
        if (imageIndex !== -1) {
          newPendingImages.splice(imageIndex, 1);
        }
        // Find the image where pending is true in the uploadedImages list
        // Setting pending to the image is useful for show shimmer in tradeDetail
        const newUploadedImages = [...prev!.uploaded_images];
        imageIndex = newUploadedImages.findIndex(img => img.id === image.id);
        if (imageIndex !== -1 && newUploadedImages[imageIndex].pending) {
          newUploadedImages.splice(imageIndex, 1);
        }

        return {
          ...prev!,
          pending_images: newPendingImages,
          uploaded_images: [...newUploadedImages, updatedImage]
        };
      });

      return updatedImage;

    } catch (error) {
      logger.error(`Error uploading image ${image.id}:`, error);

      // Update UI to show upload failed
      setNewTrade(prev => ({
        ...prev!,
        pending_images: prev!.pending_images.map((img) =>
          img.id === image.id ? { ...img, upload_progress: -1 } : img
        )
      }));

      return null;
    }
  };


  const handleImageCaptionChange = async (index: number, caption: string, isPending: boolean) => {
    try {
      if (isPending) {
        // Check if the image is currently being uploaded
        const image = newTrade!.pending_images[index];
        if (image.upload_progress !== undefined && image.upload_progress > 0 && image.upload_progress < 100) {
          // Image is currently uploading, we shouldn't allow caption changes
          // This is a fallback in case the UI field wasn't disabled properly
          logger.warn('Attempted to change caption of an image that is currently uploading');
          return;
        }

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
      if (isPending) {
        // Check if the image is currently being uploaded
        const image = newTrade!.pending_images[index];
        if (image.upload_progress !== undefined && image.upload_progress > 0 && image.upload_progress < 100) {
          // Image is currently uploading, we shouldn't allow deletion
          // This is a fallback in case the UI button wasn't hidden properly
          logger.warn('Attempted to delete an image that is currently uploading');
          showErrorSnackbar('Cannot delete an image while it\'s uploading. Please wait for the upload to complete.');
          return;
        }

        // Release object URL to avoid memory leaks
        URL.revokeObjectURL(image.preview);

        // Update local state
        setNewTrade(prev => ({
          ...prev!,
          pending_images: prev!.pending_images.filter((_, i) => i !== index)
        }));
      } else {
        const image = newTrade!.uploaded_images[index];

        // Update local state first for immediate UI feedback
        setNewTrade(prev => ({
          ...prev!,
          uploaded_images: prev!.uploaded_images.filter((_, i) => i !== index)
        }));

        //delete the image and update the trade in the background
        try {
          await handleUpdateTradeProperty(newTrade!.id, (trade) => ({
            ...trade,
            images: (trade.images || []).filter(img => img.id !== image.id)
          }));

          logger.log(`Image ${image.id} deleted and trade updated successfully`);
        } catch (deleteError) {
          logger.error('Error deleting image or updating trade:', deleteError);
          // Don't show error to user since the image is already removed from UI
          // and will be properly cleaned up when the form is submitted
        }
      }
    } catch (error) {
      logger.error('Error in handleImageRemove:', error);
      showErrorSnackbar('Failed to remove image. Please try again.');
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

  const hasPendingUploads = (): boolean => newTrade!.pending_images.some(img =>
    img.upload_progress !== undefined && img.upload_progress < 100 && img.upload_progress >= 0
  );

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


    try {
      // Validate form
      if (!newTrade!.amount) {
        showErrorSnackbar('Amount is required');
        return;
      }
      if (!newTrade!.session) {
        showErrorSnackbar('Session is required');
        return;
      }
      if (!newTrade!.risk_to_reward || newTrade!.risk_to_reward <= 0) {
        showErrorSnackbar('Risk to reward is required');
        return;
      }

      // Validate required tag groups
      const { valid, missingGroups } = validateRequiredTagGroups(newTrade!.tags);
      if (!valid) {
        showErrorSnackbar(`Missing required tag groups: ${missingGroups.join(', ')}. Each trade must include at least one tag from these groups.`);
        return;
      }

      // Check if there are any pending image uploads
      // If there are pending uploads, wait for them to complete
      if (hasPendingUploads()) {
        // Just show the loading indicator and let the uploads continue
        // The trade will be updated automatically when all uploads are complete
        showErrorSnackbar('Please wait for image uploads to complete...');
        return;
      }
      setIsSubmitting(true);
      // Prepare data
      let tradeData =  createFinalTradeData(newTrade!, trade_date);

      try {
        // Update the temporary trade with the final data
        if (newTrade!.is_temporary && newTrade!.id) {
          await handleUpdateTradeProperty(newTrade!.id, () => ({
            ...tradeData,
            is_temporary: false,
            updatedAt: new Date() // Set updatedAt when making trade permanent
          })); // Mark as a permanent trade
        }
        else {
          await onAddTrade(tradeData);
        }

        // Only reset and close if the operation was successful
        resetForm();
        onCancel();

      } catch (dbError) {
        // If it's a temporary trade that failed to update, we should clean it up
        if (newTrade!.is_temporary && newTrade!.id && onDeleteTrades) {
          try {
            // Delete the temporary trade that failed to be made permanent
            await onDeleteTrades([newTrade!.id]);
            log('Cleaned up temporary trade after failed update');
          } catch (cleanupError) {
            error('Failed to cleanup temporary trade:', cleanupError);
          }
        }

        // Re-throw the original error
        throw dbError;
      }

    } catch (err) {
      error('Error in trade submission:', err);
      showErrorSnackbar(err instanceof Error ? err.message : 'Failed to add trade. Please try again.');

      // Don't close the dialog on error - let the user try again or cancel manually

    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTrade) return;

    setIsSubmitting(true);
    // Clear any previous errors

    try {
      // Validate form
      if (!newTrade!.amount) {
        throw new Error('Amount is required');
      }
      if (!newTrade!.session) {
        throw new Error('Session is required');
      }

      // Validate required tag groups
      const { valid, missingGroups } = validateRequiredTagGroups(newTrade!.tags);
      if (!valid) {
        throw new Error(`Missing required tag groups: ${missingGroups.join(', ')}. Each trade must include at least one tag from these groups.`);
      }

      // Check if there are any pending image uploads

      // If there are pending uploads, wait for them to complete
      if (hasPendingUploads()) {
        // Just show the loading indicator and let the uploads continue
        // The trade will be updated automatically when all uploads are complete
        showErrorSnackbar('Please wait for image uploads to complete...');
        setIsSubmitting(false);
        return;
      }


      // Prepare data
      let finalAmount = calculateFinalAmount(newTrade!);

      // Process tags to ensure proper formatting
      let finalTags = processTagsForSubmission([...newTrade!.tags]);

      // Add Partials tag if partialsTaken is true
      if (newTrade!.partials_taken) {
        // Remove any existing Partials tags
        finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
        finalTags.push('Partials:Yes');
      } else {
        // Remove any existing Partials tags
        finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
      }


      // Update trade
      try {
        // Verify the trade still exists
        if (editingTrade.id) {
          const existingTrade = await calendarService.getTrade(effectiveCalendarId!, editingTrade.id);

          if (!existingTrade) {
            throw new Error(`Trade with ID ${editingTrade.id} not found. It may have been deleted.`);
          }
          // Prepare the images array with layout information
          const updatedImages = [
            ...newTrade!.pending_images.map(img => ({
              url: img.preview || '',
              id: img.id!,
              calendar_id: effectiveCalendarId!,
              pending: true,
              caption: img.caption || '',
              width: img.width || 0,
              height: img.height || 0,
              row: img.row !== undefined ? img.row : 0,
              column: img.column !== undefined ? img.column : 0,
              column_width: img.column_width !== undefined ? img.column_width : 100 // Default to 100% for vertical layout
            })),
            ...newTrade!.uploaded_images.map(img => ({
              url: img.url || '',
              id: img.id,
              calendar_id: effectiveCalendarId!,
              pending: img.pending,
              caption: img.caption || '',
              width: img.width || 0,
              height: img.height || 0,
              row: img.row !== undefined ? img.row : 0,
              column: img.column !== undefined ? img.column : 0,
              column_width: img.column_width !== undefined ? img.column_width : 100 // Default to 100% for vertical layout
            }))
          ];

          // Debug what's being saved
          // logger.log("Saving images with layout info in handleEditSubmit:",
          //   updatedImages.map(img => ({ id: img.id, row: img.row, column: img.column, column_width: img.column_width })));

          await handleUpdateTradeProperty(editingTrade.id, (trade) => {
            // Use the new date if it was changed, otherwise keep the original date
            const currentDate = new Date();
            const tradeDate = newTrade!.trade_date || trade.trade_date;
            const updatedDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
              currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());

            return {
              ...trade,
              trade_type: newTrade!.trade_type,
              amount: finalAmount,
              name: newTrade!.name || "",
              entry_price: newTrade!.entry_price || undefined,
              exit_price: newTrade!.exit_price || undefined,
              stop_loss: newTrade!.stop_loss || undefined,
              take_profit: newTrade!.take_profit || undefined,
              trade_date: updatedDate,
              is_temporary: newTrade?.is_temporary && !newTrade.name,
              tags: finalTags || [],
              risk_to_reward: newTrade!.risk_to_reward || 1,
              partials_taken: newTrade!.partials_taken,
              session: newTrade!.session || "London",
              notes: newTrade!.notes || "",
              images: updatedImages,
              updated_at: new Date() // Set updated_at when editing trades
            };
          });

          // Note: Economic events are now automatically fetched and updated by the TradeRepository layer
          // during trade updates based on session, date, and tags changes

          logger.log('Trade updated successfully');
        } else {
          throw new Error('Cannot update trade: Missing trade ID');
        }
      } catch (editError) {
        logger.error('Error updating trade:', editError);
        throw new Error(`Failed to update trade: ${editError instanceof Error ? editError.message : 'Unknown error'}`);
      }

      // Reset form
      resetForm();
      onCancel();

      // No need to explicitly recalculate cumulative PnL
      // It will be calculated directly in the DayHeader component
    } catch (error) {
      logger.error('Error editing trade:', error);
      showErrorSnackbar(error instanceof Error ? error.message : 'Failed to edit trade. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        isSubmitting={isSubmitting || isCreatingEmptyTrade} // Show loading state when creating empty trade
        cancelButtonAction={() => {
          // Only allow canceling if we're not in the process of creating an empty trade
          if (!isCreatingEmptyTrade) {
            resetForm();
            onCancel();
          }
        }}
        hideFooterCancelButton={false}
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
                  value={selectedCalendarId || ''}
                  label="Calendar"
                  onChange={(e) => onCalendarChange?.(e.target.value)}
                  disabled={isSubmitting || isCreatingEmptyTrade}
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
            account_balance={account_balance + calculateCumulativePnL(startOfNextDay(trade_date), allTrades)}
            formInputVisible={true}
            total_pnl={trades.reduce((sum, trade) => sum + trade.amount, 0)}
            onPrevDay={() => { }}
            onNextDay={() => { }}
          />

          <Box sx={{
            opacity: isCalendarSelected ? 1 : 0.5,
            pointerEvents: isCalendarSelected ? 'auto' : 'none'
          }}>
            <TradeForm
              accountBalance={account_balance}
              calculateCumulativePnl={(newTrade) => calculateCumulativePnL(newTrade?.trade_date || endOfDay(trade_date), allTrades)}
              dynamicRiskSettings={dynamicRiskSettings}
              calendarId={effectiveCalendarId || ''}
              requiredTagGroups={requiredTagGroups}
              onTagUpdated={handleTagUpdated}
              newTrade={newTrade!}
              editingTrade={editingTrade}
              allTags={allTags}
              allTrades={allTrades}
              isSubmitting={isSubmitting}
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
              trades={allTrades}
              onOpenGalleryMode={onOpenGalleryMode}
            />


          </Box>
        </Box>
      </BaseDialog>



      {/* Snackbar for error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>

  );
};

export default TradeFormDialog;
