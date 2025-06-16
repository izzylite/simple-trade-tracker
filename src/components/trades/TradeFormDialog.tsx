import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Snackbar,
  Alert
} from '@mui/material';
import { endOfDay, format } from 'date-fns';
import { Trade } from '../../types/trade';
import { BaseDialog } from '../common';
import * as calendarService from '../../services/calendarService';
import { DayHeader, TradeForm, NewTradeForm } from './';
import { v4 as uuidv4 } from 'uuid';
import { PendingImage } from './TradeForm';
import { GridImage, GridPendingImage } from './ImageGrid';
import { createNewTradeData } from '../TradeCalendar';
import {
  calculateEffectiveRiskPercentage,
  calculateCumulativePnLToDate,
  calculateRiskAmount,
  DynamicRiskSettings
} from '../../utils/dynamicRiskUtils';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  newMainTrade?: NewTradeForm | null
  date: Date;
  showForm: FormProps;
  trades: Trade[];
  accountBalance: number;

  onAddTrade?: (trade: Trade & { id?: string }) => Promise<void>;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onAccountBalanceChange?: (balance: number) => void;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  setNewMainTrade: (prev: (trade: NewTradeForm) => NewTradeForm | null) => void
  onCancel: () => void;
  allTrades?: Trade[];
  dynamicRiskSettings: DynamicRiskSettings;
  calendarId: string;
  tags: string[];
  requiredTagGroups?: string[];
  // Optional props for trade link navigation in notes
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
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
export const calculateCumulativePnL = (date: Date, allTrades: Trade[]) => {
  return calculateCumulativePnLToDate(date, allTrades);
};

export const startOfNextDay = (date: Date | string): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

export const createEditTradeData = (trade: Trade): NewTradeForm => {
  return {
    id: trade.id,
    name: trade.name ? trade.name.replace(/^📈 /, '') : '',
    amount: Math.abs(trade.amount).toString(),
    type: trade.type,
    entry: trade.entry || '',
    date: trade.date,
    exit: trade.exit || '',
    tags: trade.tags || [],
    riskToReward: trade.riskToReward?.toString() || '',
    partialsTaken: trade.partialsTaken || false,
    session: trade.session || '',
    notes: trade.notes || '',
    pendingImages: [],
    isTemporary: trade.isTemporary,
    uploadedImages: trade.images ? trade.images.map((img, index) => ({
      ...img,
      // Ensure layout properties are explicitly preserved
      row: img.row !== undefined ? img.row : index, // Each image gets its own row by default
      column: img.column !== undefined ? img.column : 0, // Always in first column by default
      columnWidth: img.columnWidth !== undefined ? img.columnWidth : 100 // Default to 100% for vertical layout
    })) : [],

  }
}

const TradeFormDialog: React.FC<FormDialogProps> = ({
  open,
  onClose,
  newMainTrade,
  setNewMainTrade,
  date,
  trades,
  accountBalance,
  showForm,
  onCancel,
  onAddTrade,
  onTagUpdated,
  onUpdateTradeProperty,
  allTrades = [],
  dynamicRiskSettings,
  calendarId,
  tags = [],
  requiredTagGroups = [],
  onOpenGalleryMode
}) => {

  // State

  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingEmptyTrade, setIsCreatingEmptyTrade] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);



  // Track previous showForm state to avoid unnecessary handleAddClick calls
  const prevShowFormRef = useRef<FormProps | null>(null);

  // Function to create empty trade - defined before useEffect that uses it
  const createEmptyTrade = useCallback(async () => {
    setEditingTrade(null);
    // Set creating empty trade state to true to disable cancel/close buttons
    setIsCreatingEmptyTrade(true);
    // Create a temporary trade object to display in the UI

    // Create an empty trade in Firebase
    try {
      if (calendarId && onAddTrade) {

        // Update the form with the temporary trade ID and isTemporary flag
        const data = createNewTradeData();
        setNewTrade(() => ({
          ...data,
          isTemporary: true,
          name: 'New Trade'
        }));

        await onAddTrade({ ...createFinalTradeData(data, date), name: 'New Trade', isTemporary: true });
      } else {
        // Handle case where calendarId or onAddTrade is missing
        throw new Error('Unable to create trade: Missing calendar ID or add trade function');
      }

    } catch (error) {
      console.error('Error creating empty trade:', error);
      showErrorSnackbar(error instanceof Error ?
        `Failed to create temporary trade: ${error.message}` :
        'Failed to create temporary trade. Please try again.');

      // Still show the form, but without the temporary trade
      setNewTrade(prev => ({
        ...prev!,
        isTemporary: false
      }));
    } finally {
      // Re-enable cancel/close buttons regardless of success or failure
      setIsCreatingEmptyTrade(false);
    }
  }, [calendarId, onAddTrade, date]);

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
      newTrade.pendingImages.forEach(image => {
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
      console.error('Error updating trade property:', error);
      showErrorSnackbar(error instanceof Error ? error.message : 'Failed to update trade property. Please try again.');
    }
  };

  // Form handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, name: e.target.value }));
  };

  const handleAmountChange = (amount: string) => {
    setNewTrade(prev => ({ ...prev!, amount: amount }));
  };

  const handleTypeChange = (e: any) => {
    setNewTrade(prev => ({ ...prev!, type: e.target.value as 'win' | 'loss' | 'breakeven' }));
  };

  const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, entry: e.target.value }));
  };

  const handleExitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, exit: e.target.value }));
  };

  const handleDateChange = (newDate: Date | null) => {
    if (newDate) {
      setNewTrade(prev => ({ ...prev!, date: newDate }));
    }
  };

  const handleRiskToRewardChange = (riskToReward: string) => {
    setNewTrade(prev => ({ ...prev!, riskToReward: riskToReward }));
  };


  const calculateFinalAmount = (trade: NewTradeForm): number => {
    // If using risk-based calculation and not taking partials, recalculate the amount
    if (trade.riskToReward && !trade.partialsTaken) {
      const rr = parseFloat(trade.riskToReward);
      if (!isNaN(rr)) {
        const calculatedAmount = calculateAmountFromRiskToReward(rr, calculateCumulativePnL(trade.date || endOfDay(date), allTrades));
        // Apply sign based on trade type
        return trade.type === 'loss' ? -Math.abs(calculatedAmount) : Math.abs(calculatedAmount);
      }
    }

    // Otherwise use the amount from the form
    const amount = parseFloat(trade.amount || "0");
    return trade.type === 'loss' ? -Math.abs(amount) : Math.abs(amount);
  };

  const createFinalTradeData = (newTrade: NewTradeForm, date: Date) => {
    let finalAmount = calculateFinalAmount(newTrade);
    console.log(`trade final amount ${finalAmount}`)

    // Process tags to ensure proper formatting
    let finalTags = processTagsForSubmission([...newTrade.tags]);

    // Add Partials tag if partialsTaken is true
    if (newTrade.partialsTaken) {
      // Remove any existing Partials tags
      finalTags = finalTags.filter((tag: string) => !tag.startsWith('Partials:'));
      finalTags.push('Partials:Yes');
    }

    const currentDate = new Date();

    // Use the trade's date if it exists (when editing), otherwise use the provided date
    const tradeDate = newTrade.date || date;

    return {
      id: newTrade.id || uuidv4(),
      isTemporary: newTrade.isTemporary,
      date: new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
        currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds()),
      type: newTrade.type,
      amount: finalAmount,
      isDeleting: false,
      ...(newTrade.name && { name: newTrade.name }),
      ...(newTrade.entry && { entry: newTrade.entry }),
      ...(newTrade.exit && { exit: newTrade.exit }),
      ...(finalTags.length > 0 && { tags: finalTags }),
      ...(newTrade.riskToReward && { riskToReward: parseFloat(newTrade.riskToReward) }),
      partialsTaken: newTrade.partialsTaken,
      ...(newTrade.session && { session: newTrade.session }),
      ...(newTrade.notes && { notes: newTrade.notes }),
      images: newTrade.uploadedImages || [],
    }
  }

  // Calculate amount based on risk per trade (as percentage of account balance) and risk-to-reward ratio
  const calculateAmountFromRiskToReward = (riskToReward: number, cumulativePnL: number): number => {
    if (!newTrade || !riskToReward || !accountBalance || newTrade.type === 'breakeven') return 0;


    const tradeDate = newTrade.date || date;
    const effectiveRiskPercentage = calculateEffectiveRiskPercentage(tradeDate, allTrades, dynamicRiskSettings);
    const riskAmount = calculateRiskAmount(effectiveRiskPercentage, accountBalance, cumulativePnL);
    // For win trades: risk amount * R:R
    // For loss trades: risk amount
    return newTrade.type === 'win'
      ? Math.round(riskAmount * riskToReward)
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
    setNewTrade(prev => ({ ...prev!, tags: newValue }));
  };




  const handleImageUpload = async (files: FileList) => {
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
      Array.from(files).map(async (file) => {
        const preview = URL.createObjectURL(file);
        const dimensions = await getDimensions(preview);

        return {
          id: calendarService.generateImageId(file),
          file,
          preview,
          caption: '',
          width: dimensions.width,
          height: dimensions.height,
          uploadProgress: 0
        };
      })
    );

    // Add the new images to the state with grid layout information
    setNewTrade((prev) => {
      const existingPendingImages = prev!.pendingImages;
      const existingUploadedImages = prev!.uploadedImages;

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
          columnWidth: 100 // Full width for the row
        };
      });

      return {
        ...prev!,
        pendingImages: [...existingPendingImages, ...newImagesWithLayout],
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
            calendarId: calendarId,
            id: img.id,
            width: img.width,
            height: img.height,
            caption: img.caption,
            row: newRow,
            column: 0, // Always place in first column
            columnWidth: 100 // Full width for the row
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
          return {
            ...createFinalTradeData(newTrade!, date), id: tradeid, name: newTrade!.name || 'New Trade', isTemporary: true
          };
        });

      if (trade && trade.isTemporary) {
        setNewTrade(prev => {
          return {
            ...prev!,
            isTemporary: true
          };
        })
      }
      // if (isCreatingEmptyTrade){
      //    setIsCreatingEmptyTrade(false);
      // }



      for (const image of newPendingImages) {
        await startImageUpload(image, newTrade!.id!!);
      }
    }
    catch (error) {
      console.error('Error creating empty trade:', error);
    }
  };
  // Function to start uploading an image
  const startImageUpload = async (image: PendingImage, tradeId: string): Promise<void> => {
    try {
      // Update progress to show upload has started
      setNewTrade(prev => ({
        ...prev!,
        pendingImages: prev!.pendingImages.map((img) =>
          img.id === image.id ? { ...img, uploadProgress: 1 } : img
        )
      }));

      // Upload the image with progress tracking
      const uploadedImage = await calendarService.uploadImage(
        calendarId,
        image.id!!,
        image.file,
        image.width,
        image.height,
        image.caption,
        (progress) => {
          // Update progress in the UI
          setNewTrade(prev => ({
            ...prev!,
            pendingImages: prev!.pendingImages.map((img) =>
              img.id === image.id ? { ...img, uploadProgress: progress } : img
            )
          }));
        }
      );

      // Once upload is complete, move from pendingImages to uploadedImages
      // Find the original pending image to get its layout information
      const originalPendingImage = newTrade!.pendingImages.find(img => img.id === image.id);

      // Preserve layout information
      const updatedImage = {
        ...uploadedImage,
        caption: image.caption,
        row: originalPendingImage?.row || newTrade!.pendingImages.indexOf(originalPendingImage!!),
        column: originalPendingImage?.column || 0,
        columnWidth: originalPendingImage?.columnWidth || 100
      };

      // Update local state
      setNewTrade(prev => {
        const newPendingImages = [...prev!.pendingImages];
        // Remove the uploaded image from pendingImages
        let imageIndex = newPendingImages.findIndex(img => img.id === image.id);
        if (imageIndex !== -1) {
          newPendingImages.splice(imageIndex, 1);
        }
        // Find the image where pending is true in the uploadedImages list
        // Setting pending to the image is useful for show shimmer in tradeDetail
        const newUploadedImages = [...prev!.uploadedImages];
        imageIndex = newUploadedImages.findIndex(img => img.id === image.id);
        if (imageIndex !== -1 && newUploadedImages[imageIndex].pending) {
          newUploadedImages.splice(imageIndex, 1);
        }

        return {
          ...prev!,
          pendingImages: newPendingImages,
          uploadedImages: [...newUploadedImages, updatedImage]
        };


      });

      // Update Firebase document if we have a temporary trade ID
      if (calendarId && tradeId) {
        try {
          // Use transaction to add the image to the trade

          await handleUpdateTradeProperty(tradeId, (trade) => {
            // Find the existing image in the trade to preserve any layout information
            const existingImage = trade.images?.find(img => img.id === updatedImage.id);

            // Create the updated image with layout information
            const finalUpdatedImage = {
              ...updatedImage,
              // Preserve existing layout information if available
              row: existingImage?.row !== undefined ? existingImage.row : updatedImage.row,
              column: existingImage?.column !== undefined ? existingImage.column : updatedImage.column,
              columnWidth: existingImage?.columnWidth !== undefined ? existingImage.columnWidth : updatedImage.columnWidth
            };

            return {
              ...trade,
              images: (trade.images || [finalUpdatedImage]).map(img =>
                img.id === finalUpdatedImage.id ? finalUpdatedImage : img)
            };
          });



        } catch (updateError) {
          console.error('Error updating trade with new image:', updateError);

          // Show error message to the user
          showErrorSnackbar(updateError instanceof Error ?
            `Failed to save image to trade: ${updateError.message}` :
            'Failed to save image to trade. The image is saved locally but may be lost if you refresh the page.');

          // Continue execution - we'll still have the image in local state
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);

      // Update UI to show upload failed
      setNewTrade(prev => ({
        ...prev!,
        pendingImages: prev!.pendingImages.map((img) =>
          img.id === image.id ? { ...img, uploadProgress: -1 } : img
        )
      }));
    }
  };


  const handleImageCaptionChange = async (index: number, caption: string, isPending: boolean) => {
    try {
      if (isPending) {
        // Check if the image is currently being uploaded
        const image = newTrade!.pendingImages[index];
        if (image.uploadProgress !== undefined && image.uploadProgress > 0 && image.uploadProgress < 100) {
          // Image is currently uploading, we shouldn't allow caption changes
          // This is a fallback in case the UI field wasn't disabled properly
          console.warn('Attempted to change caption of an image that is currently uploading');
          return;
        }

        // Update caption for pending image
        setNewTrade(prev => ({
          ...prev!,
          pendingImages: prev!.pendingImages.map((img, i) =>
            i === index ? { ...img, caption } : img
          )
        }));
      } else {
        // Update caption for uploaded image
        setNewTrade(prev => ({
          ...prev!,
          uploadedImages: prev!.uploadedImages.map((img, i) =>
            i === index ? { ...img, caption } : img
          )
        }));
      }
    } catch (error) {
      console.error('Error in handleImageCaptionChange:', error);
      // Don't show error to user for caption changes as it's not critical
    }
  };


  const handleImageRemove = async (index: number, isPending: boolean) => {
    try {
      if (isPending) {
        // Check if the image is currently being uploaded
        const image = newTrade!.pendingImages[index];
        if (image.uploadProgress !== undefined && image.uploadProgress > 0 && image.uploadProgress < 100) {
          // Image is currently uploading, we shouldn't allow deletion
          // This is a fallback in case the UI button wasn't hidden properly
          console.warn('Attempted to delete an image that is currently uploading');
          showErrorSnackbar('Cannot delete an image while it\'s uploading. Please wait for the upload to complete.');
          return;
        }

        // Release object URL to avoid memory leaks
        URL.revokeObjectURL(image.preview);

        // Update local state
        setNewTrade(prev => ({
          ...prev!,
          pendingImages: prev!.pendingImages.filter((_, i) => i !== index)
        }));
      } else {
        const image = newTrade!.uploadedImages[index];

        // Update local state first for immediate UI feedback
        setNewTrade(prev => ({
          ...prev!,
          uploadedImages: prev!.uploadedImages.filter((_, i) => i !== index)
        }));

        //delete the image and update the trade in the background
        try {
          await handleUpdateTradeProperty(newTrade!.id, (trade) => ({
            ...trade,
            images: (trade.images || []).filter(img => img.id !== image.id)
          }));

          console.log(`Image ${image.id} deleted and trade updated successfully`);
        } catch (deleteError) {
          console.error('Error deleting image or updating trade:', deleteError);
          // Don't show error to user since the image is already removed from UI
          // and will be properly cleaned up when the form is submitted
        }
      }
    } catch (error) {
      console.error('Error in handleImageRemove:', error);
      showErrorSnackbar('Failed to remove image. Please try again.');
    }
  };
  // Handle image reordering
  const handleImagesReordered = async (images: Array<GridImage | GridPendingImage>) => {
    console.log("handleImagesReordered called with images:",
      images.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })));

    // Separate pending and uploaded images
    const pendingImages = images.filter(img => 'file' in img) as GridPendingImage[];
    const uploadedImages = images.filter(img => !('file' in img)) as GridImage[];

    // Update local state
    setNewTrade(prev => ({
      ...prev!,
      pendingImages: pendingImages as PendingImage[],
      uploadedImages: uploadedImages
    }));

  };

  // Handle tag updates from the edit dialog
  const handleTagUpdated = (oldTag: string, newTag: string) => {
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
      onTagUpdated(oldTag, newTag);
    }
  };

  const hasPendingUploads = (): boolean => newTrade!.pendingImages.some(img =>
    img.uploadProgress !== undefined && img.uploadProgress < 100 && img.uploadProgress >= 0
  );

  // Check if all required tag groups are present in the trade's tags
  const validateRequiredTagGroups = (tags: string[]): { valid: boolean; missingGroups: string[] } => {
    if (!requiredTagGroups || requiredTagGroups.length === 0) {
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
    const missingGroups = requiredTagGroups.filter(group => !presentGroups.has(group));

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
      if (!newTrade!.riskToReward) {
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
      let tradeData = createFinalTradeData(newTrade!, date);

      try {
        // Update the temporary trade with the final data
        if (newTrade!.isTemporary && newTrade!.id) {
          await handleUpdateTradeProperty(newTrade!.id, () => ({ ...tradeData, isTemporary: false })); // Mark as a permanent trade
        }
        else {
          await onAddTrade(tradeData);
        }

        // Only reset and close if the operation was successful
        resetForm();
        onCancel();

      } catch (dbError) {
        // If it's a temporary trade that failed to update, we should clean it up
        if (newTrade!.isTemporary && newTrade!.id) {
          try {
            // Delete the temporary trade that failed to be made permanent
            await handleUpdateTradeProperty(newTrade!.id, (trade) => ({
              ...trade,
              isDeleted: true
            }));
            console.log('Cleaned up temporary trade after failed update');
          } catch (cleanupError) {
            console.error('Failed to cleanup temporary trade:', cleanupError);
          }
        }

        // Re-throw the original error
        throw dbError;
      }

    } catch (error) {
      console.error('Error in trade submission:', error);
      showErrorSnackbar(error instanceof Error ? error.message : 'Failed to add trade. Please try again.');

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
      if (newTrade!.partialsTaken) {
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
          const existingTrade = await calendarService.getTrade(calendarId, editingTrade.id);

          if (!existingTrade) {
            throw new Error(`Trade with ID ${editingTrade.id} not found. It may have been deleted.`);
          }
          // Prepare the images array with layout information
          const updatedImages = [
            ...newTrade!.pendingImages.map(img => ({
              url: img.preview || '',
              id: img.id!,
              calendarId: calendarId,
              pending: true,
              caption: img.caption || '',
              width: img.width || 0,
              height: img.height || 0,
              row: img.row !== undefined ? img.row : 0,
              column: img.column !== undefined ? img.column : 0,
              columnWidth: img.columnWidth !== undefined ? img.columnWidth : 100 // Default to 100% for vertical layout
            })),
            ...newTrade!.uploadedImages.map(img => ({
              url: img.url || '',
              id: img.id,
              calendarId: calendarId,
              pending: img.pending,
              caption: img.caption || '',
              width: img.width || 0,
              height: img.height || 0,
              row: img.row !== undefined ? img.row : 0,
              column: img.column !== undefined ? img.column : 0,
              columnWidth: img.columnWidth !== undefined ? img.columnWidth : 100 // Default to 100% for vertical layout
            }))
          ];

          // Debug what's being saved to Firebase
          // console.log("Saving images to Firebase with layout info in handleEditSubmit:",
          //   updatedImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })));

          await handleUpdateTradeProperty(editingTrade.id, (trade) => {
            // Use the new date if it was changed, otherwise keep the original date
            const currentDate = new Date();
            const tradeDate = newTrade!.date || trade.date;
            const updatedDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(),
              currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());

            return {
              ...trade,
              type: newTrade!.type,
              amount: finalAmount,
              name: newTrade!.name || "",
              entry: newTrade!.entry || "",
              exit: newTrade!.exit || "",
              date: updatedDate,
              isTemporary: newTrade?.isTemporary && !newTrade.name,
              tags: finalTags || [],
              riskToReward: parseFloat(newTrade!.riskToReward) || 1,
              partialsTaken: newTrade!.partialsTaken,
              session: newTrade!.session || "London",
              notes: newTrade!.notes || "",
              images: updatedImages
            };
          });
          console.log('Trade updated successfully');
        } else {
          throw new Error('Cannot update trade: Missing trade ID');
        }
      } catch (editError) {
        console.error('Error updating trade:', editError);
        throw new Error(`Failed to update trade: ${editError instanceof Error ? editError.message : 'Unknown error'}`);
      }

      // Reset form
      resetForm();
      onCancel();

      // No need to explicitly recalculate cumulative PnL
      // It will be calculated directly in the DayHeader component
    } catch (error) {
      console.error('Error editing trade:', error);
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

          <DayHeader
            title={format(date, 'EEEE, MMMM d, yyyy')}
            accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay(date), allTrades)}
            formInputVisible={true}
            totalPnL={trades.reduce((sum, trade) => sum + trade.amount, 0)}
            onPrevDay={() => { }}
            onNextDay={() => { }}
          />

          <Box>
            <TradeForm
              accountBalance={accountBalance}
              calculateCumulativePnl={(newTrade) => calculateCumulativePnL(newTrade?.date || endOfDay(date), allTrades)}
              dynamicRiskSettings={dynamicRiskSettings}
              calendarId={calendarId}
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

