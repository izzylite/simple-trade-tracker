import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, TextField, CircularProgress, Typography, keyframes } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { PendingImage, TradeImage } from './TradeForm'; // Assuming these are defined elsewhere

// Extended TradeImage interface with grid positioning properties
export interface GridImage extends TradeImage {
  id: string; // Ensure ID is present
  url: string;
  caption?: string;
  width?: number;
  height?: number;
  row?: number;
  column?: number;
  columnWidth?: number; // Width as percentage (0-100)
}

// Extended PendingImage interface with grid positioning properties
export interface GridPendingImage extends Partial<PendingImage> {
  id: string; // Ensure ID is present
  file?: File;
  preview?: string;
  caption?: string;
  width?: number;
  height?: number;
  uploadProgress?: number;
  row?: number;
  column?: number;
  columnWidth?: number; // Width as percentage (0-100)
}

interface ImageGridProps {
  pendingImages: Array<PendingImage>;
  uploadedImages: Array<TradeImage>;
  editingTrade: boolean; // This prop seems unused in the provided snippet, but kept it
  onImageCaptionChange: (index: number, caption: string, isPending: boolean) => void;
  onImageRemove: (index: number, isPending: boolean) => void;
  onImagesReordered?: (images: Array<GridImage | GridPendingImage>) => void; // Re-using this for layout changes
}

// --- Default values ---
const DEFAULT_COL_WIDTH = 100;
const MIN_COL_WIDTH_PERCENT = 10; // Minimum width for a column

// Helper function to organize images into rows
const organizeImagesIntoRows = (
  pendingImages: Array<PendingImage>,
  uploadedImages: Array<TradeImage>
): Array<Array<GridImage | GridPendingImage>> => {
  console.log("Input to organizeImagesIntoRows:",
    "Pending:", pendingImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })),
    "Uploaded:", uploadedImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })));

  // Combine and ensure basic grid properties exist
  const allImages: Array<GridImage | GridPendingImage> = [
    ...pendingImages.map((img, i) => {
      const result = {
        ...img,
        id: img.id ?? `pending-${i}`, // Ensure ID is present
        isPending: true, // Add flag for easier type checking later
        row: img.row !== undefined ? img.row : undefined,
        column: img.column !== undefined ? img.column : undefined,
        columnWidth: img.columnWidth !== undefined ? img.columnWidth : undefined,
      };
      console.log(`Processed pending image ${i}:`, result.id, result.row, result.column, result.columnWidth);
      return result;
    }),
    ...uploadedImages.map((img, i) => {
      const result = {
        ...img,
        id: img.id ?? `uploaded-${i}`, // Ensure ID is present
        isPending: false,
        row: img.row !== undefined ? img.row : undefined,
        column: img.column !== undefined ? img.column : undefined,
        columnWidth: img.columnWidth !== undefined ? img.columnWidth : undefined,
      };
      console.log(`Processed uploaded image ${i}:`, result.id, result.row, result.column, result.columnWidth);
      return result;
    }),
  ];

  // Group by row, handling undefined rows
  const rowMap: { [key: number]: Array<GridImage | GridPendingImage> } = {};
  let maxDefinedRow = -1;
  allImages.forEach((image) => {
    if (image.row !== undefined) {
      if (!rowMap[image.row]) {
        rowMap[image.row] = [];
      }
      rowMap[image.row].push(image);
      maxDefinedRow = Math.max(maxDefinedRow, image.row);
    }
  });

  // Place images with undefined rows into a vertical layout (one per row)
  let nextRowIndex = maxDefinedRow + 1;

  // Filter images with undefined rows
  const unassignedImages = allImages.filter(image => image.row === undefined);

  // Assign rows and columns to unassigned images - always in vertical layout
  unassignedImages.forEach((image, index) => {
    // Each image gets its own row in vertical layout
    const newRow = nextRowIndex + index;

    // Assign row and column
    image.row = newRow;
    image.column = 0; // Always place in first column
    image.columnWidth = 100; // Full width for vertical layout

    // Add to row map
    if (!rowMap[image.row]) {
      rowMap[image.row] = [];
    }
    rowMap[image.row].push(image);
  });

   // Convert map to array and sort rows by index
   const rows: Array<Array<GridImage | GridPendingImage>> = Object.entries(rowMap)
   .sort(([a], [b]) => Number(a) - Number(b))
   .map(([rowIndex, images]) => {
     console.log(`Processing row ${rowIndex} with ${images.length} images`);
     return images;
   });

  // Sort images within each row by column, assign defaults if needed
  rows.forEach((row, rIndex) => {
     // Assign row index if somehow missing (shouldn't happen with above logic)
     row.forEach(img => img.row = rIndex);

     // Sort by column, putting undefined columns last
     row.sort((a, b) => {
       const colA = a.column ?? Infinity;
       const colB = b.column ?? Infinity;
       return colA - colB;
     });

     // Assign column index and default width if needed
     let totalDefinedWidth = 0;
     let undefinedWidthCount = 0;
     row.forEach((image, cIndex) => {
       image.column = cIndex; // Ensure column indices are sequential
       if (image.columnWidth === undefined) {
         undefinedWidthCount++;
       } else {
         totalDefinedWidth += image.columnWidth;
       }
     });

     // Distribute remaining width among columns that didn't have it defined
     if (undefinedWidthCount > 0) {
       const remainingWidth = Math.max(0, 100 - totalDefinedWidth);
       const widthPerUndefined = remainingWidth / undefinedWidthCount;
       row.forEach((image) => {
         if (image.columnWidth === undefined) {
           image.columnWidth = widthPerUndefined;
         }
       });
     } else if (row.length > 0 && Math.abs(totalDefinedWidth - 100) > 0.1) {
        // Adjust existing widths proportionally if they don't add up to 100
        const scaleFactor = 100 / totalDefinedWidth;
        row.forEach(image => {
            image.columnWidth = (image.columnWidth ?? 0) * scaleFactor;
        });
     } else if (row.length > 0 && totalDefinedWidth === 0) {
        // If all widths were 0 somehow, distribute equally
        const equalWidth = 100 / row.length;
         row.forEach(image => {
            image.columnWidth = equalWidth;
        });
     }
  });

  // Remove empty rows just in case
  const finalRows = rows.filter((row) => row && row.length > 0);

  // Log the final organized rows
  console.log("Final organized rows:", finalRows.map((row, i) =>
    `Row ${i}: ` + row.map(img => `(id: ${img.id}, col: ${img.column}, width: ${img.columnWidth}%)`).join(', ')
  ));

  return finalRows;
};


const ImageGrid: React.FC<ImageGridProps> = ({
  pendingImages,
  uploadedImages,
  editingTrade, // Used to determine if we should show shimmer for pending images
  onImageCaptionChange,
  onImageRemove,
  onImagesReordered,
}) => {
  const theme = useTheme();
  const [rows, setRows] = useState<Array<Array<GridImage | GridPendingImage>>>([]);
  const [draggingImage, setDraggingImage] = useState<GridImage | GridPendingImage | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  // dragDirection state removed as it's no longer needed

  // --- Resizing State ---
  const [resizingState, setResizingState] = useState<{
    rowIndex: number;
    dividerIndex: number; // Index of the divider (0 means between col 0 and 1)
    startX: number;
    rowElementWidth: number;
    initialWidths: number[]; // Initial widths of all items in the row
  } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null); // Ref for the main container
  const dragImageRef = useRef<HTMLElement | null>(null); // Ref to track drag image for cleanup


  // Organize images into rows when inputs change
  useEffect(() => {
    const newRows = organizeImagesIntoRows(pendingImages, uploadedImages);
    // Debug the layout information
    console.log("Organizing images with layout info:",
      pendingImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })),
      uploadedImages.map(img => ({ id: img.id, row: img.row, column: img.column, columnWidth: img.columnWidth })));
    // console.log("Organized Rows:", JSON.stringify(newRows, null, 2)); // Debugging
    setRows(newRows);
  }, [pendingImages, uploadedImages]);

  // Helper to check if an image is PendingImage (using the flag added in organize)
  const isPendingImage = (image: GridImage | GridPendingImage): boolean => {
    // Check based on the structure or the added flag
    return 'isPending' in image ? !!(image as any).isPending : 'file' in image;
  };

  // Helper to check if any image is currently uploading
  const isAnyImageUploading = (): boolean => {
    return pendingImages.some(img =>
      img.uploadProgress !== undefined &&
      img.uploadProgress >= 0 && // default uploadProgress state is -1 or undefined 
      img.uploadProgress < 100
    );
  };

  // --- Drag and Drop (Reordering) Handlers ---
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    image: GridImage | GridPendingImage,
    rowIndex: number,
    columnIndex: number
  ) => {
    // Prevent initiating drag if resize is active or any image is uploading
    if (resizingState || isAnyImageUploading()) {
      e.preventDefault();
      return;
    }
    setDraggingImage(image);
    // console.log("Drag Start:", image.id, `Row: ${rowIndex}`, `Col: ${columnIndex}`); // Debug
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: image.id, // Use image id for identification
      isPending: isPendingImage(image),
      sourceRowIndex: rowIndex,
      sourceColumnIndex: columnIndex
    }));
    e.dataTransfer.effectAllowed = "move";

    // Custom drag image with improved cleanup
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const dragImage = element.cloneNode(true) as HTMLElement;

    // Apply styles to cloned drag image
    dragImage.style.width = `${rect.width}px`;
    dragImage.style.height = `${rect.height}px`;
    dragImage.style.opacity = '0.7';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.pointerEvents = 'none';
    dragImage.style.zIndex = '1000';

    // Store reference for reliable cleanup
    dragImageRef.current = dragImage;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);

    // Use a longer timeout for more reliable cleanup
    setTimeout(() => {
        cleanupDragImage();
    }, 100);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    rowIndex: number,
    columnIndex: number | null // Allow null for dropping on row container
  ) => {
    e.preventDefault(); // Necessary to allow drop
    e.dataTransfer.dropEffect = "move";
    if (draggingImage) {
      // Update target position for visual feedback
      setDragOverRow(rowIndex);
      // If columnIndex is null, it means hovering over row gap, target first column
      setDragOverColumn(columnIndex ?? 0);
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetRowIndex: number,
    targetColumnIndex: number | null // Null indicates dropping on row or new row area
  ) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent drop event from bubbling up if needed

    if (!draggingImage) return;

    const sourceData = JSON.parse(e.dataTransfer.getData('text/plain'));
    const sourceRowIndex = sourceData.sourceRowIndex;
    const sourceColumnIndex = sourceData.sourceColumnIndex;
    const imageId = sourceData.id;
    const isSourcePending = sourceData.isPending;

    // Find the image being dragged using its ID and type
    let imageToMove: GridImage | GridPendingImage | undefined;
    let foundAtIndex: number | undefined;

    const sourceCollection = isSourcePending ? pendingImages : uploadedImages;
    foundAtIndex = sourceCollection.findIndex(img => img.id === imageId);

    if (foundAtIndex === -1) {
        console.error("Could not find dragged image in original collection!");
        handleDragEnd(); // Reset state
        return;
    }
    // Get the actual image object from the original props/state before modification
    imageToMove = rows[sourceRowIndex]?.[sourceColumnIndex];

     if (!imageToMove) {
        console.error("Inconsistency: Dragged image not found in current rows state at source index");
         // Fallback: Try finding by ID in flattened rows
        const flatImages = rows.flat();
        imageToMove = flatImages.find(img => img.id === imageId && isPendingImage(img) === isSourcePending);
        if (!imageToMove) {
            console.error("Could not find dragged image anywhere!");
            handleDragEnd();
            return;
        }
        // If found via fallback, we might not know the exact sourceRow/Col index *relative to current state*
        // This indicates a potential logic issue elsewhere, but we can try to proceed
        console.warn("Found image via fallback, drag/drop might be slightly off.");
    }


    // --- Apply the move ---
    let newRows = rows.map(row => [...row]); // Deep copy rows

    // 1. Remove image from its original position
    let actualSourceRowIndex = -1;
    let actualSourceColumnIndex = -1;
     for(let r=0; r < newRows.length; r++) {
         const cIndex = newRows[r].findIndex(img => img.id === imageToMove!.id && isPendingImage(img) === isPendingImage(imageToMove!));
         if (cIndex !== -1) {
             actualSourceRowIndex = r;
             actualSourceColumnIndex = cIndex;
             break;
         }
     }

    if (actualSourceRowIndex === -1) {
        console.error("Cannot find image to remove during drop!");
        handleDragEnd();
        return;
    }

    newRows[actualSourceRowIndex].splice(actualSourceColumnIndex, 1);


    // 2. Determine target position
    let finalTargetRowIndex = targetRowIndex;
    let finalTargetColumnIndex = targetColumnIndex ?? 0; // Default to start if null

     // Check if dropping onto the "new row" area
    if (targetRowIndex === newRows.filter(r => r.length > 0).length && targetColumnIndex === null) {
        finalTargetRowIndex = newRows.length; // Target the next available row index
        finalTargetColumnIndex = 0;
    } else if (targetColumnIndex === null) {
         // Dropping between rows or on row padding? Target start of the row.
        finalTargetColumnIndex = 0;
    }

    // 3. Insert image at the target position
    // Ensure target row exists
    while (newRows.length <= finalTargetRowIndex) {
        newRows.push([]);
    }

    // Insert the image
    newRows[finalTargetRowIndex].splice(finalTargetColumnIndex, 0, imageToMove);

    // --- Recalculate Layout Properties ---
    newRows = newRows.filter(row => row.length > 0); // Remove empty rows

    newRows.forEach((row, rIndex) => {
        const widthPerColumn = 100 / row.length; // Equal width distribution after move
        row.forEach((img, cIndex) => {
            img.row = rIndex;
            img.column = cIndex;
            // Reset width only if it changed row or if the row now has only one image
            if (img.id === imageToMove!.id || row.length === 1 || actualSourceRowIndex !== rIndex) {
               img.columnWidth = widthPerColumn;
            }
             // Ensure existing images in the target row also get widths adjusted if needed
             else if (rIndex === finalTargetRowIndex && row.length > 1) {
                 // This part needs refinement: Adjust widths proportionally based on *previous* widths?
                 // For simplicity now, we redistribute equally in the target row upon drop.
                 // A more complex approach would try to maintain relative proportions.
                 img.columnWidth = widthPerColumn;
             }
             // Adjust widths in the source row if it wasn't emptied
             else if (rIndex === actualSourceRowIndex && newRows[rIndex]?.length > 0) {
                 const sourceRowWidth = 100 / newRows[rIndex].length;
                 img.columnWidth = sourceRowWidth;
             }

             // Fallback safety check for width
             if (img.columnWidth === undefined || img.columnWidth === null || isNaN(img.columnWidth) || img.columnWidth <=0) {
                 img.columnWidth = 100 / row.length;
             }
        });
         // Re-normalize widths for the row to ensure they sum to 100%
         const currentRowTotalWidth = row.reduce((sum, img) => sum + (img.columnWidth || 0), 0);
         if (currentRowTotalWidth > 0 && Math.abs(currentRowTotalWidth - 100) > 0.1) {
             const scale = 100 / currentRowTotalWidth;
             row.forEach(img => img.columnWidth = (img.columnWidth || 0) * scale);
         } else if (currentRowTotalWidth === 0 && row.length > 0) {
              const equalWidth = 100 / row.length;
              row.forEach(img => img.columnWidth = equalWidth);
         }
    });


    // Update state and notify parent
    setRows(newRows);
    if (onImagesReordered) {
      const allImages = newRows.flat();
      onImagesReordered(allImages);
    }

    // Reset drag state
    handleDragEnd();
  };

  // Helper function to clean up drag image
  const cleanupDragImage = () => {
    if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
      document.body.removeChild(dragImageRef.current);
    }
    dragImageRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggingImage(null);
    setDragOverRow(null);
    setDragOverColumn(null);
    // Clean up any lingering drag image
    cleanupDragImage();
  };

  // --- Resizing Handlers ---
  const handleResizeMouseDown = (
      e: React.MouseEvent<HTMLDivElement>,
      rowIndex: number,
      dividerIndex: number // Index of the divider (between col dividerIndex and dividerIndex + 1)
  ) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent drag-start on the image behind

      // Prevent resizing if any image is uploading
      if (isAnyImageUploading()) {
        return;
      }

      const rowElement = (e.target as HTMLElement).closest('.image-row-container');
      if (!rowElement) return;

      const rowElementWidth = rowElement.getBoundingClientRect().width;
      if (rowElementWidth <= 0) return; // Avoid division by zero

      // Store initial state for resizing calculation
      setResizingState({
          rowIndex,
          dividerIndex,
          startX: e.clientX,
          rowElementWidth,
          initialWidths: rows[rowIndex].map(img => img.columnWidth || 0), // Store initial widths of the row
      });
  };

  // Helper function to normalize column widths in a row
  const normalizeRowWidths = useCallback((row: Array<GridImage | GridPendingImage>, minWidth = MIN_COL_WIDTH_PERCENT) => {
    if (!row || row.length === 0) return row;

    // Calculate total width
    const totalWidth = row.reduce((sum, img) => sum + (img.columnWidth || 0), 0);

    // If total is already close to 100%, no need to normalize
    if (Math.abs(totalWidth - 100) < 0.1) return row;

    // If total is 0, distribute equally
    if (totalWidth === 0) {
      const equalWidth = 100 / row.length;
      row.forEach(img => img.columnWidth = equalWidth);
      return row;
    }

    // Scale all widths proportionally
    const scaleFactor = 100 / totalWidth;
    row.forEach(img => {
      img.columnWidth = (img.columnWidth || 0) * scaleFactor;
      // Ensure minimum width
      img.columnWidth = Math.max(minWidth, img.columnWidth);
    });

    // Final check - if we're still not at 100% due to min width constraints,
    // adjust the largest column to compensate
    const newTotal = row.reduce((sum, img) => sum + (img.columnWidth || 0), 0);
    if (Math.abs(newTotal - 100) > 0.1) {
      // Find the largest column
      const largestColIndex = row.reduce(
        (maxIndex, img, index, arr) =>
          (img.columnWidth || 0) > (arr[maxIndex].columnWidth || 0) ? index : maxIndex,
        0
      );
      // Adjust it to make the total 100%
      row[largestColIndex].columnWidth = (row[largestColIndex].columnWidth || 0) - (newTotal - 100);
    }

    return row;
  }, []);

  // Use useCallback for handlers used in effects to prevent unnecessary re-renders/listener attachments
  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingState) return;

    const { rowIndex, dividerIndex, startX, rowElementWidth, initialWidths } = resizingState;

    const currentX = e.clientX;
    const deltaX = currentX - startX;
    const deltaPercent = (deltaX / rowElementWidth) * 100;

    // Create a deep copy of the rows for modification
    const newRows = [...rows.map(row => [...row.map(img => ({ ...img }))])];
    const targetRow = newRows[rowIndex];

    // Calculate total initial width left and right of the divider
    let totalInitialLeftWidth = 0;
    for (let i = 0; i <= dividerIndex; i++) {
      totalInitialLeftWidth += initialWidths[i];
    }
    let totalInitialRightWidth = 0;
    for (let i = dividerIndex + 1; i < initialWidths.length; i++) {
      totalInitialRightWidth += initialWidths[i];
    }

    // Calculate the new target total widths for left/right sections
    let newTotalLeftWidth = totalInitialLeftWidth + deltaPercent;
    let newTotalRightWidth = totalInitialRightWidth - deltaPercent;

    // Apply minimum width constraints
    const numLeftImages = dividerIndex + 1;
    const numRightImages = initialWidths.length - numLeftImages;
    const minTotalLeftWidth = numLeftImages * MIN_COL_WIDTH_PERCENT;
    const minTotalRightWidth = numRightImages * MIN_COL_WIDTH_PERCENT;

    // Clamp totals
    newTotalLeftWidth = Math.max(minTotalLeftWidth, newTotalLeftWidth);
    newTotalRightWidth = Math.max(minTotalRightWidth, newTotalRightWidth);

    // Ensure the sum is still 100% after clamping
    const currentTotal = newTotalLeftWidth + newTotalRightWidth;
    if (Math.abs(currentTotal - 100) > 0.1) {
      const scaleFactor = 100 / currentTotal;
      newTotalLeftWidth *= scaleFactor;
      newTotalRightWidth *= scaleFactor;

      // Re-check min width constraints after scaling
      newTotalLeftWidth = Math.max(minTotalLeftWidth, newTotalLeftWidth);
      newTotalRightWidth = Math.max(minTotalRightWidth, newTotalRightWidth);

      // If one side hit min, give remainder to the other
      if (newTotalLeftWidth === minTotalLeftWidth) {
        newTotalRightWidth = 100 - newTotalLeftWidth;
      } else if (newTotalRightWidth === minTotalRightWidth) {
        newTotalLeftWidth = 100 - newTotalRightWidth;
      }
    }

    // Distribute new total widths proportionally
    // Left side
    for (let i = 0; i <= dividerIndex; i++) {
      let newWidth = 0;
      if (totalInitialLeftWidth > 0) {
        const proportion = initialWidths[i] / totalInitialLeftWidth;
        newWidth = newTotalLeftWidth * proportion;
      } else {
        newWidth = newTotalLeftWidth / numLeftImages;
      }
      targetRow[i].columnWidth = Math.max(MIN_COL_WIDTH_PERCENT, newWidth);
    }

    // Right side
    for (let i = dividerIndex + 1; i < targetRow.length; i++) {
      let newWidth = 0;
      if (totalInitialRightWidth > 0) {
        const proportion = initialWidths[i] / totalInitialRightWidth;
        newWidth = newTotalRightWidth * proportion;
      } else {
        newWidth = newTotalRightWidth / numRightImages;
      }
      targetRow[i].columnWidth = Math.max(MIN_COL_WIDTH_PERCENT, newWidth);
    }

    // Final normalization to ensure total is exactly 100%
    normalizeRowWidths(targetRow);

    // Update the state visually during drag
    setRows(newRows);
  }, [resizingState, rows, normalizeRowWidths]); // Added normalizeRowWidths to dependencies

  const handleResizeMouseUp = useCallback(() => {
      if (!resizingState) return;

      // Persist the final state
      if (onImagesReordered) {
           // Find the updated row state (rows state should be current from mouseMove)
           const finalRowIndex = resizingState.rowIndex;
           if (rows[finalRowIndex]) {
                const allImages = rows.flat(); // Flatten the current state
                onImagesReordered(allImages); // Send the updated layout
           }
      }
      setResizingState(null); // End resizing
  }, [resizingState, rows, onImagesReordered]); // Include rows and callback


  // Effect to add/remove global listeners for resizing
  useEffect(() => {
      if (resizingState) {
          window.addEventListener('mousemove', handleResizeMouseMove);
          window.addEventListener('mouseup', handleResizeMouseUp);
          // Optional: Add cursor style to body
          document.body.style.cursor = 'col-resize';
      } else {
          window.removeEventListener('mousemove', handleResizeMouseMove);
          window.removeEventListener('mouseup', handleResizeMouseUp);
          // Optional: Reset cursor style
          document.body.style.cursor = '';
      }

      // Cleanup function
      return () => {
          window.removeEventListener('mousemove', handleResizeMouseMove);
          window.removeEventListener('mouseup', handleResizeMouseUp);
          // Optional: Ensure cursor is reset if component unmounts during resize
          document.body.style.cursor = '';
      };
  }, [resizingState, handleResizeMouseMove, handleResizeMouseUp]); // Add handlers to dependency array


  return (
    <Box sx={{ width: '100%' }} ref={gridContainerRef}>
      {rows.map((row, rowIndex) => (
        <Box
          key={`row-${rowIndex}`}
          className="image-row-container" // Add class for easy selection
          sx={{
            display: 'flex',
            width: '100%',
            marginBottom: 3, // Use full property name to avoid conflicts
            position: 'relative',
            gap: 1, // Add small gap between columns (8px)
            // All directional drop indicators removed
          }}
          // Add DragOver handler for dropping between rows (targets column 0)
          onDragOver={(e) => handleDragOver(e, rowIndex, 0)}
           // Add drop handler here too if needed for row-level drops (currently handled by image drop)
           // onDrop={(e) => handleDrop(e, rowIndex, 0)} // Example if needed
        >
          {row.map((image, columnIndex) => {
            const isPending = isPendingImage(image);
            const pendingImg = isPending ? image as GridPendingImage : null;
            const uploadedImg = !isPending ? image as GridImage : null;
            const imageId = isPending ? pendingImg!.id : uploadedImg!.id;
            const isLastColumn = columnIndex === row.length - 1;

            return (
              <React.Fragment key={`image-frag-${imageId}-${rowIndex}-${columnIndex}`}>
                {/* Image Container */}
                <Box
                    key={`image-${imageId}-${rowIndex}-${columnIndex}`}
                    sx={{
                        position: 'relative',
                        // Simplified width calculation - use percentage width directly
                        width: `${image.columnWidth || DEFAULT_COL_WIDTH}%`,
                        // No margin needed since we're using flex gap
                        height: 'auto',
                        borderRadius: 1,
                        overflow: 'visible', // Allow potential overflow for captions if needed, adjust styling

                        display: 'flex',
                        flexDirection: 'column',
                        opacity: draggingImage === image ? 0.5 : 1,
                        backgroundColor: 'transparent',
                        transition: 'border-color 0.2s, background-color 0.2s, opacity 0.2s, box-shadow 0.2s',
                        // All directional drop indicators removed
                        ...(draggingImage && dragOverRow === rowIndex && dragOverColumn === columnIndex && {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        }),
                        '&:hover .resize-handle': { // Show resize handle on hover of image container
                            opacity: isAnyImageUploading() ? 0.2 : 1, // Dim resize handle during uploads
                        },
                        // Visual indication that dragging is disabled during uploads
                        cursor: isAnyImageUploading() ? 'not-allowed' : 'grab',
                        filter: isAnyImageUploading() ? 'grayscale(0.2)' : 'none',
                    }}
                    draggable={!isAnyImageUploading()} // Disable draggable attribute during uploads
                    onDragStart={(e) => handleDragStart(e, image, rowIndex, columnIndex)}
                    onDragOver={(e) => handleDragOver(e, rowIndex, columnIndex)}
                    onDrop={(e) => handleDrop(e, rowIndex, columnIndex)}
                    onDragEnd={handleDragEnd}
                >
                  {/* Image and Caption Content (mostly unchanged) */}
                  <Box sx={{ overflow: 'hidden', borderRadius: '4px 4px 0 0' }}> {/* Inner box for image clipping */}
                        {isPending ? (
                            // Pending image structure (unchanged)
                             <>
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: 'auto',
                                        // Only apply maxHeight when there are multiple images in a row
                                        maxHeight: row.length > 1 ? 300 : 'none',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        backgroundColor: alpha(theme.palette.divider, 0.1), // Placeholder bg
                                        aspectRatio: pendingImg?.width && pendingImg?.height ? `${pendingImg.width}/${pendingImg.height}` : '16/9', // Default aspect ratio
                                    }}
                                >
                                {/* Progress Indicator.uploadProgress == 0 means preparing, > 0 means uploading, -1 or undefined means default  */}
                                {pendingImg?.uploadProgress !== undefined && pendingImg.uploadProgress >= 0 && pendingImg.uploadProgress < 100 && (
                                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2 }}>
                                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                            <CircularProgress variant={pendingImg.uploadProgress === 0 ? 'indeterminate' : 'determinate'} value={pendingImg.uploadProgress} size={80} sx={{ color: 'white' }} />
                                            <Box
                                                sx={{
                                                    top: 0,
                                                    left: 0,
                                                    bottom: 0,
                                                    right: 0,
                                                    position: 'absolute',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Typography variant="caption" component="div" sx={{ color: 'white', fontSize: `${pendingImg.uploadProgress === 0 ? '0.55rem' : undefined}`, fontWeight: 'bold' }}>
                                                    {pendingImg.uploadProgress === 0 ? 'Preparing...' : `${Math.round(pendingImg.uploadProgress)}%`}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                )}
                                {/* Image Preview */}
                                <img
                                    src={pendingImg?.preview}
                                    alt="Pending Upload"
                                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                                {/* Delete Button */}
                                {(!pendingImg?.uploadProgress || pendingImg.uploadProgress === 100 || pendingImg.uploadProgress === -1) && (
                                     <IconButton size="small" onClick={() => onImageRemove(pendingImages.findIndex(img => img.id === image.id), true)}
                                         sx={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white', zIndex: 10, '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' } }}>
                                         <DeleteIcon fontSize="small" />
                                     </IconButton>
                                 )}
                                </Box>
                                {/* Caption Field - Multiline with smaller font */}
                                <TextField
                                    placeholder="Add a caption..."
                                    value={pendingImg?.caption || ''}
                                    onChange={(e) => onImageCaptionChange(pendingImages.findIndex(img => img.id === image.id), e.target.value, true)}
                                    variant="standard"
                                    multiline
                                    minRows={1}
                                    maxRows={20} // Large number to effectively disable scrolling
                                    fullWidth
                                    // Disable the field when image is uploading
                                    disabled={pendingImg?.uploadProgress !== undefined && pendingImg.uploadProgress >= 0 && pendingImg.uploadProgress < 100}
                                    sx={{
                                        px: 1,
                                        py: 0.5,
                                        backgroundColor: theme.palette.background.paper,
                                        fontSize: '0.75rem', // Smaller font size
                                        '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                                        '& .MuiInput-underline:after': { borderBottomColor: 'transparent' },
                                        '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'transparent' },
                                        '& .MuiInputBase-input': { fontSize: '0.75rem' }, // Ensure input text is also smaller
                                        '& .MuiInputBase-root': { overflow: 'visible' }, // Prevent scrollbars
                                        // Style for disabled state
                                        '&.Mui-disabled': {
                                            opacity: 0.7,
                                            '& .MuiInputBase-input': { color: 'text.disabled' }
                                        }
                                    }}
                                />
                            </>
                        ) : (
                            // Uploaded image structure (unchanged)
                            <>
                                <Box
                                    sx={{
                                        width: '100%',
                                        height: 'auto',
                                        // Only apply maxHeight when there are multiple images in a row
                                        maxHeight: row.length > 1 ? 300 : 'none',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        backgroundColor: alpha(theme.palette.divider, 0.1), // Placeholder bg
                                        aspectRatio: uploadedImg?.width && uploadedImg?.height ? `${uploadedImg.width}/${uploadedImg.height}` : '16/9', // Default aspect ratio
                                    }}
                                >
                                {/* Loading Placeholder (optional, could use skeleton) */}
                                {/* <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.5, zIndex: 0 }} /> */}
                                {/* Show shimmer for pending images when editing a trade */}
                                {editingTrade && uploadedImg?.pending ? (
                                    <ShimmerImageBox image={uploadedImg} theme={theme} />
                                ) : (
                                    /* Actual Image */
                                    <img
                                        src={uploadedImg?.url}
                                        alt={uploadedImg?.caption || "Uploaded image"}
                                        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
                                        // onLoad/onError handlers could be added here
                                    />
                                )}
                                 {/* Delete Button */}
                                <IconButton size="small" onClick={() => onImageRemove(uploadedImages.findIndex(img => img.id === image.id), false)}
                                    sx={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white', zIndex: 10, '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)'} }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                                </Box>
                                {/* Caption Field - Multiline with smaller font */}
                                <TextField
                                    placeholder="Add a caption..."
                                    value={uploadedImg?.caption || ''}
                                    onChange={(e) => onImageCaptionChange(uploadedImages.findIndex(img => img.id === image.id), e.target.value, false)}
                                    variant="standard"
                                    multiline
                                    minRows={1}
                                    maxRows={20} // Large number to effectively disable scrolling
                                    fullWidth
                                    // Disable the field when any image is uploading
                                    disabled={isAnyImageUploading() || (uploadedImg?.pending === true)}
                                    sx={{
                                        px: 1,
                                        py: 0.5,
                                        backgroundColor: theme.palette.background.paper,
                                        fontSize: '0.75rem', // Smaller font size
                                        '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                                        '& .MuiInput-underline:after': { borderBottomColor: 'transparent' },
                                        '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'transparent' },
                                        '& .MuiInputBase-input': { fontSize: '0.75rem' }, // Ensure input text is also smaller
                                        '& .MuiInputBase-root': { overflow: 'visible' }, // Prevent scrollbars
                                        // Style for disabled state
                                        '&.Mui-disabled': {
                                            opacity: 0.7,
                                            '& .MuiInputBase-input': { color: 'text.disabled' }
                                        }
                                    }}
                                />
                            </>
                        )}
                  </Box> {/* End inner box for image clipping */}

                </Box>

                {/* Resize Handle (Divider) - Render between images */}
                {!isLastColumn && row.length > 1 && (
                  <Box
                    className="resize-handle"
                    sx={{
                      width: '8px', // Wider clickable area
                      position: 'relative', // Position relative to the flex flow
                      cursor: isAnyImageUploading() ? 'not-allowed' : 'col-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0, // Don't allow the handle itself to shrink
                      zIndex: 10, // Higher z-index to ensure it's above images
                      // Visual divider line
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: '5%', // Extend more of the height
                        bottom: '5%',
                        left: '3px', // Center the visual line within the 8px handle
                        width: '2px',
                        backgroundColor: resizingState && resizingState.rowIndex === rowIndex && resizingState.dividerIndex === columnIndex
                          ? theme.palette.primary.main // Highlight when dragging this handle
                          : isAnyImageUploading()
                            ? alpha(theme.palette.divider, 0.4) // Dimmed when uploads in progress
                            : alpha(theme.palette.divider, 0.8), // Normal color
                        // Initially invisible, only visible on hover or when resizing
                        opacity: resizingState && resizingState.rowIndex === rowIndex && resizingState.dividerIndex === columnIndex ? 1 : 0,
                        transition: 'opacity 0.2s, background-color 0.2s, width 0.2s',
                      },
                      // Hover effect - make visible when hovered
                      '&:hover::before': {
                        opacity: isAnyImageUploading() ? 0.3 : 1,
                        width: isAnyImageUploading() ? '2px' : '3px',
                        backgroundColor: isAnyImageUploading()
                          ? alpha(theme.palette.divider, 0.4)
                          : theme.palette.primary.light,
                      },
                      // Active state during resize
                      ...(resizingState && resizingState.rowIndex === rowIndex && resizingState.dividerIndex === columnIndex && {
                        '&::before': {
                          opacity: 1,
                          width: '3px',
                          backgroundColor: theme.palette.primary.main,
                        }
                      }),
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, rowIndex, columnIndex)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Box>
      ))}

      {/* Drop area for creating a new row at the end */}
      {draggingImage && !isAnyImageUploading() && (
        <Box
          sx={{
            width: '100%',
            height: 80,
            border: `2px dashed ${dragOverRow === rows.length && dragOverColumn === 0 ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dragOverRow === rows.length && dragOverColumn === 0 ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
            color: theme.palette.text.secondary,
            transition: 'all 0.2s ease-in-out',
            marginBottom: 2,
            position: 'relative',
            // Visual feedback when dragging over with New Row label
            ...(dragOverRow === rows.length && dragOverColumn === 0 && {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              border: `2px solid ${theme.palette.primary.main}`,
              '&::after': {
                content: '"New Row"',
                position: 'absolute',
                top: '-10px',
                right: '10px',
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                zIndex: 10,
                boxShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.2)}`
              }
            })
          }}
          onDragOver={(e) => handleDragOver(e, rows.length, 0)} // Target next row index, column 0
          onDragLeave={() => { /* Reset specific visual state if needed */ }}
          onDrop={(e) => handleDrop(e, rows.length, null)} // Use null for columnIndex to indicate new row area
        >
          Drop here to create a new row
        </Box>
      )}
    </Box>
  );
};

// ShimmerImageBox component for displaying a shimmer effect during image upload
const ShimmerImageBox: React.FC<{
  image: GridImage;
  theme: any; // Theme is used inside the background function
}> = ({ image, theme }) => {
  // Define shimmer animation
  const shimmer = keyframes`
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  `;

  return (
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
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: () => {
            // Use slightly more pronounced colors for better visibility
            const baseColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
            const shimmerColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
            return `linear-gradient(90deg, ${baseColor} 25%, ${shimmerColor} 50%, ${baseColor} 75%)`;
          },
          backgroundSize: '200% 100%',
          animation: `${shimmer} 1.5s infinite linear`,
          willChange: 'background-position', // Optimize animation performance
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={24} color="primary" />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Uploading...
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ImageGrid;
