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
  let left = selectionRect.left - editorRect.left + (selectionRect.width / 2) - (toolbarDimensions.width / 2);
  
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
  
  // Prevent going off left edge
  const safeLeftBoundary = scrollLeft + spacing;
  left = Math.max(safeLeftBoundary, left);
  
  // Prevent going off right edge
  const scrollbarWidthAllowance = 15;
  const safeRightBoundary = editorRect.width - toolbarDimensions.width - spacing + scrollLeft - scrollbarWidthAllowance;
  left = Math.min(safeRightBoundary, left);
  
  return { top, left };
}

/**
 * Get safe toolbar dimensions with fallbacks
 * @param toolbarElement - The toolbar DOM element
 * @returns Toolbar dimensions with fallbacks
 */
export function getToolbarDimensions(toolbarElement: HTMLElement | null): ToolbarDimensions {
  if (!toolbarElement) {
    return { width: 320, height: 48 }; // Default fallback dimensions
  }
  
  try {
    // Use getBoundingClientRect for more accurate dimensions
    const rect = toolbarElement.getBoundingClientRect();
    return {
      width: rect.width || toolbarElement.offsetWidth || 320,
      height: rect.height || toolbarElement.offsetHeight || 48
    };
  } catch (error) {
    console.error('Error getting toolbar dimensions:', error);
    return { width: 320, height: 48 };
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
