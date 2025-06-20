/**
 * Utility functions for handling text selection and positioning
 */

export interface Position {
  top: number;
  left: number;
}

export interface ToolbarDimensions {
  width: number;
  height: number;
}

/**
 * Safely get the selection rectangle
 * @returns DOMRect or null if no valid selection
 */
export function getSelectionRect(): DOMRect | null {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Validate the rectangle has meaningful dimensions
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }
    
    return rect;
  } catch (error) {
    console.error('Error getting selection rect:', error);
    return null;
  }
}

/**
 * Check if there is a valid text selection
 * @returns True if there is a non-collapsed selection
 */
export function hasValidSelection(): boolean {
  try {
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed && selection.rangeCount > 0);
  } catch (error) {
    console.error('Error checking selection:', error);
    return false;
  }
}

/**
 * Calculate optimal toolbar position relative to selection
 * @param selectionRect - The selection rectangle
 * @param editorRect - The editor container rectangle
 * @param toolbarDimensions - Toolbar width and height
 * @param scrollTop - Editor scroll top position
 * @param scrollLeft - Editor scroll left position
 * @returns Calculated position
 */
export function calculateToolbarPosition(
  selectionRect: DOMRect,
  editorRect: DOMRect,
  toolbarDimensions: ToolbarDimensions,
  scrollTop: number,
  scrollLeft: number
): Position {
  const spacing = 8; // Space between selection and toolbar

  // Calculate base position relative to the editor's viewport
  let top = selectionRect.top - editorRect.top - toolbarDimensions.height - spacing;

  // Calculate left position with more stable centering
  const selectionCenter = selectionRect.left - editorRect.left + (selectionRect.width / 2);
  let left = selectionCenter - (toolbarDimensions.width / 2);

  // Add scroll position to get position relative to the scrollable content
  top += scrollTop;
  left += scrollLeft;

  // Boundary checks accounting for scroll
  const safeTopBoundary = scrollTop + spacing;
  const safeBottomBoundaryForTopPositioning = selectionRect.bottom - editorRect.top + spacing + scrollTop;

  // If not enough space above, position below
  if (top < safeTopBoundary) {
    top = safeBottomBoundaryForTopPositioning;
  }

  // More robust horizontal boundary checks
  const minLeftBoundary = scrollLeft + spacing;
  const maxRightBoundary = editorRect.width - toolbarDimensions.width - spacing + scrollLeft - 20; // Account for scrollbar

  // Ensure toolbar stays within bounds
  left = Math.max(minLeftBoundary, Math.min(maxRightBoundary, left));

  // Round to prevent sub-pixel positioning that can cause shifting
  return {
    top: Math.round(top),
    left: Math.round(left)
  };
}

/**
 * Get safe toolbar dimensions with fallbacks
 * @param toolbarElement - The toolbar DOM element
 * @returns Toolbar dimensions with fallbacks
 */
export function getToolbarDimensions(toolbarElement: HTMLElement | null): ToolbarDimensions {
  if (!toolbarElement) {
    return { width: 400, height: 48 }; // Updated fallback to match typical toolbar width
  }

  try {
    // Use getBoundingClientRect for more accurate dimensions
    const rect = toolbarElement.getBoundingClientRect();

    // Only use actual dimensions if they're reasonable (not 0 or very small)
    const width = (rect.width > 50) ? rect.width :
                  (toolbarElement.offsetWidth > 50) ? toolbarElement.offsetWidth : 400;
    const height = (rect.height > 20) ? rect.height :
                   (toolbarElement.offsetHeight > 20) ? toolbarElement.offsetHeight : 48;

    return { width, height };
  } catch (error) {
    console.error('Error getting toolbar dimensions:', error);
    return { width: 400, height: 48 };
  }
}

/**
 * Check if a click target is outside the specified elements
 * @param target - The click target
 * @param elements - Array of elements to check against
 * @returns True if target is outside all elements
 */
export function isClickOutside(target: Node, elements: (HTMLElement | null)[]): boolean {
  return elements.every(element => {
    if (!element) return true;
    try {
      return !element.contains(target);
    } catch (error) {
      console.error('Error checking if click is outside element:', error);
      return true;
    }
  });
}
