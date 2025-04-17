import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Snackbar,
  Alert
} from '@mui/material';
import { isAfter, startOfDay } from 'date-fns';
import { Trade } from '../../types/trade';
import { BaseDialog, ConfirmationDialog } from '../common';
import * as calendarService from '../../services/calendarService';
import { DayHeader, TradeForm, TradeList, NewTradeForm } from './';
import { v4 as uuidv4 } from 'uuid';
import { PendingImage } from './TradeForm';
import { GridImage, GridPendingImage } from './ImageGrid';
import { createNewTradeData } from '../TradeCalendar';
interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  newMainTrade?: NewTradeForm | null
  date: Date;
  showForm: boolean;
  trades: Trade[];
  accountBalance: number;
  onDateChange: (date: Date) => void;
  onAddTrade?: (trade: Trade & { id?: string }) => Promise<void>;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onAccountBalanceChange?: (balance: number) => void;
  setZoomedImage: (url: string) => void;
  setNewMainTrade: (prev: (trade: NewTradeForm) => NewTradeForm | null) => void
  allTrades?: Trade[];
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  calendarId: string;
}





// Helper function to process tags
const processTagsForSubmission = (tags: string[]): string[] => {

      // Get any pending tag from the input field (if it exists)
      const tagInput = document.querySelector('.MuiAutocomplete-input') as HTMLInputElement;
      let pendingTag = '';
      if (tagInput && tagInput.value.trim()) {
        pendingTag = tagInput.value.trim();
      }

      if (pendingTag) {
        return [... tags, pendingTag]
      }
      return tags;
};

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  showForm,
  newMainTrade,
  setNewMainTrade,
  date,
  trades,
  accountBalance,
  onDateChange,
  onAddTrade,
  onTagUpdated,
  onUpdateTradeProperty,
  setZoomedImage,
  allTrades = [],
  riskPerTrade,
  dynamicRiskEnabled,
  increasedRiskPercentage,
  profitThresholdPercentage,
  calendarId
}) => {

  // State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingEmptyTrade, setIsCreatingEmptyTrade] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);

  const calculateCumulativePnL = (date: Date) => {

    // Calculate total profit from all trades before the current date
    const total = allTrades.reduce((acc, trade) => {

      const tradeDate = new Date(trade.date);
      if (tradeDate < date) {
        acc += trade.amount;
      }
      return acc;
    }, 0);
    return total;
  };
  useEffect(() => {
    setShowAddForm(showForm);
  }, [showForm]);


  useEffect(() => {
    if (newMainTrade) {
      setNewTrade(newMainTrade!);
    }
  }, [newMainTrade]);

  // Derived state
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    allTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          if (!tag.startsWith('Partials:')) {
            tagsSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagsSet);
  }, [allTrades]);

  // Handlers
  const handlePrevDay = () => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  };
  const startOfNextDay = (): Date => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }
  const handleNextDay = () => {
    const nextDay = startOfNextDay();

    // Don't allow navigating to future dates
    if (!isAfter(nextDay, startOfDay(new Date()))) {
      onDateChange(nextDay);
    }
  };

  const handleTradeClick = (tradeId: string) => {
    setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
  };

  const handleAddClick = async () => {
    setShowAddForm(true);
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
  };




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
    setShowAddForm(false);
    setEditingTrade(null);
    setNewMainTrade(() => null);

  };



  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    setNewMainTrade(() => ({
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

    }));
    console.log(`Editing trade image: ${JSON.stringify(trade.images)}`);

  };

  const handleDeleteClick = (tradeId: string) => {

    setTradeToDelete(tradeId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (tradeToDelete) {
      setIsDeleting(true);
      try {
        await handleUpdateTradeProperty(tradeToDelete, (trade) => ({ ...trade, isDeleted: true }));
      } catch (error) {
        console.error('Error deleting trade:', error);
        showErrorSnackbar('Failed to delete trade. Please try again.');
      } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setTradeToDelete(null);
      }
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setTradeToDelete(null);
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
    if (riskPerTrade && trade.riskToReward && !trade.partialsTaken) {
      const rr = parseFloat(trade.riskToReward);
      if (!isNaN(rr)) {
        const calculatedAmount = calculateAmountFromRiskToReward(rr, calculateCumulativePnL(trade.date || date));
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
    if (!newTrade || !riskPerTrade || !riskToReward || !accountBalance || newTrade.type === 'breakeven') return 0;

    // Get the effective risk percentage (which may be increased due to dynamic risk)

    const effectiveRiskPercentage = getEffectiveRiskPercentage(cumulativePnL);

    // Calculate the risk amount based on the effective percentage of account balance
    const totalAccountValue = accountBalance + cumulativePnL;
    const riskAmount = (totalAccountValue * effectiveRiskPercentage) / 100;

    // For win trades: risk amount * R:R
    // For loss trades: risk amount
    return newTrade.type === 'win'
      ? Math.round(riskAmount * riskToReward)
      : Math.round(riskAmount);
  };


  // Calculate the effective risk percentage based on dynamic risk settings
  const getEffectiveRiskPercentage = (cumulativePnL: number): number => {
    if (!riskPerTrade) return 0;

    // Apply dynamic risk if enabled and profit threshold is met

    if (dynamicRiskEnabled &&
      increasedRiskPercentage &&
      profitThresholdPercentage &&
      accountBalance > 0) {
      const profitPercentage = (cumulativePnL / accountBalance * 100);
      if (profitPercentage >= profitThresholdPercentage) {
        return increasedRiskPercentage;
      }
    }

    return riskPerTrade;
  };

  const handlePartialsTakenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const partialsTaken = e.target.checked;
    setNewTrade(prev => ({ ...prev!, partialsTaken }));


  };

  const handleSessionChange = (e: any) => {
    setNewTrade(prev => ({ ...prev!, session: e.target.value }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTrade(prev => ({ ...prev!, notes: e.target.value }));
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
          setIsCreatingEmptyTrade(true);
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
        setIsCreatingEmptyTrade(false);
      }


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
          tags: prev.tags.map(tag => tag === oldTag ? newTag : tag)
        };
      });
    }

    // Update the cached trades list
    if(onTagUpdated){
      onTagUpdated(oldTag,newTag);

    }

  };

  const hasPendingUploads = (): boolean => newTrade!.pendingImages.some(img =>
    img.uploadProgress !== undefined && img.uploadProgress < 100 && img.uploadProgress >= 0
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!onAddTrade) return;

    setIsSubmitting(true);
    // Clear any previous errors

    try {
      // Validate form
      if (!newTrade!.amount) {
        throw new Error('Amount is required');
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
      let tradeData = createFinalTradeData(newTrade!, date);
      // Update the temporary trade with the final data
      if (newTrade!.isTemporary && newTrade!.id) {
        await handleUpdateTradeProperty(newTrade!.id, () => ({ ...tradeData, isTemporary: false })); // Mark as a permanent trade

      }
      else {
        await onAddTrade(tradeData);
      }

      resetForm();

    } catch (error) {
      showErrorSnackbar(error instanceof Error ? error.message : 'Failed to add trade. Please try again.');
      if(newTrade!.isTemporary){
        console.error('Error updating temporary trade:', error);
        throw new Error(`Failed to update temporary trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      else {
        console.error('Error adding new trade:', error);
        throw new Error(`Failed to add new trade: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

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
        primaryButtonText={showAddForm ? (editingTrade ? 'Update Trade' : 'Add Trade') : 'Add Trade'}
        primaryButtonAction={showAddForm ?
          (editingTrade ?
            (e?: React.FormEvent) => handleEditSubmit(e) :
            (e?: React.FormEvent) => handleSubmit(e)
          ) :
          () => handleAddClick()
        }
        isSubmitting={isSubmitting || isCreatingEmptyTrade} // Show loading state when creating empty trade
        cancelButtonAction={showAddForm ? () => {
          // Only allow canceling if we're not in the process of creating an empty trade
          if (!isCreatingEmptyTrade) {
            setShowAddForm(false);
            resetForm();
          }
        } : undefined}
        hideFooterCancelButton={!showAddForm}
      >
        <Box sx={{ p: 3 }}>

          <DayHeader
            date={date}
            accountBalance={accountBalance + calculateCumulativePnL(startOfNextDay())}
            formInputVisible={showAddForm}
            totalPnL={trades.reduce((sum, trade) => sum + trade.amount, 0)}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          {showAddForm ? (
            <Box>
              <TradeForm
                accountBalance={accountBalance}
                calculateCumulativePnl={(newTrade) => calculateCumulativePnL(newTrade?.date || new Date())}
                dynamicRiskEnabled={dynamicRiskEnabled}
                increasedRiskPercentage={increasedRiskPercentage}
                profitThresholdPercentage={profitThresholdPercentage}
                calendarId={calendarId}
                onTagUpdated={handleTagUpdated}
                newTrade={newTrade!}
                editingTrade={editingTrade}
                allTags={allTags}
                isSubmitting={isSubmitting}
                riskPerTrade={riskPerTrade}
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
              />


            </Box>
          ) : (
            <>
              <TradeList
                trades={trades}
                expandedTradeId={expandedTradeId}
                onTradeClick={handleTradeClick}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onZoomedImage={setZoomedImage}
                onUpdateTradeProperty={handleUpdateTradeProperty}
              />


            </>
          )}
        </Box>
      </BaseDialog>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title="Delete Trade"
        message="Are you sure you want to delete this trade? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isSubmitting={isDeleting}
        confirmColor="error"
      />

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

export default DayDialog;

