import { useState, useCallback, useMemo, useEffect } from 'react';
import { debounce } from '../utils/debounce';
import { 
  getSelectionRect, 
  hasValidSelection, 
  calculateToolbarPosition, 
  getToolbarDimensions, 
  isClickOutside,
  type Position 
} from '../utils/selectionUtils';

interface UseFloatingToolbarProps {
  disabled: boolean;
  editorWrapperRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  colorMenuAnchor: HTMLElement | null;
  headingMenuAnchor: HTMLElement | null;
  linkDialogOpen?: boolean;
}

/**
 * Custom hook to manage floating toolbar positioning and visibility
 */
export function useFloatingToolbar({
  disabled,
  editorWrapperRef,
  toolbarRef,
  colorMenuAnchor,
  headingMenuAnchor,
  linkDialogOpen = false,
}: UseFloatingToolbarProps) {
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = useState<Position | null>(null);

  // Function to update and show/hide floating toolbar
  const checkSelectionAndPositionToolbar = useCallback(() => {
    if (disabled || !editorWrapperRef.current) return;

    if (hasValidSelection()) {
      try {
        const selectionRect = getSelectionRect();

        if (selectionRect && selectionRect.width > 0 && editorWrapperRef.current) {
          const editorRect = editorWrapperRef.current.getBoundingClientRect();
          const editorScrollTop = editorWrapperRef.current.scrollTop;
          const editorScrollLeft = editorWrapperRef.current.scrollLeft;

          // Get toolbar dimensions with a small delay if toolbar is not yet rendered
          const getPositionWithDimensions = () => {
            const toolbarDimensions = getToolbarDimensions(toolbarRef.current);
            const position = calculateToolbarPosition(
              selectionRect,
              editorRect,
              toolbarDimensions,
              editorScrollTop,
              editorScrollLeft
            );
            setFloatingToolbarPosition(position);
          };

          // If toolbar is not visible yet, show it first then position
          if (!showFloatingToolbar) {
            setShowFloatingToolbar(true);
            // Use requestAnimationFrame to ensure toolbar is rendered before positioning
            requestAnimationFrame(() => {
              getPositionWithDimensions();
            });
          } else {
            getPositionWithDimensions();
          }
          return;
        }
      } catch (error) {
        console.error('Error positioning toolbar:', error);
        // Fall through to hide toolbar on error
      }
    }

    // Hide toolbar if no valid selection OR an error occurred positioning it
    // Only hide if no menus or dialogs are open
    if (!colorMenuAnchor && !headingMenuAnchor && !linkDialogOpen && showFloatingToolbar) {
      setShowFloatingToolbar(false);
    }
  }, [disabled, colorMenuAnchor, headingMenuAnchor, linkDialogOpen, showFloatingToolbar, editorWrapperRef, toolbarRef]);

  // Debounced version for performance
  const debouncedCheckSelection = useMemo(
    () => debounce(checkSelectionAndPositionToolbar, 100),
    [checkSelectionAndPositionToolbar]
  );

  // Effect to add/remove event listeners for selection
  useEffect(() => {
    const editorElement = editorWrapperRef.current;
    if (!editorElement || disabled) return;

    // Use debounced function for better performance
    const handleMouseUp = () => setTimeout(debouncedCheckSelection, 0);
    const handleTouchEnd = () => setTimeout(debouncedCheckSelection, 0);
    
    // Check on key up for keyboard selections & cursor movement
    const handleKeyUp = (event: KeyboardEvent) => {
        // Check for arrow keys, selection keys (Shift+Arrows), Home, End etc.
        if (
            event.key.includes('Arrow') ||
            ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key) ||
            (event.shiftKey && ['Delete', 'Backspace'].includes(event.key))
        ) {
             setTimeout(debouncedCheckSelection, 0);
        }
    };

    editorElement.addEventListener('mouseup', handleMouseUp);
    editorElement.addEventListener('touchend', handleTouchEnd);
    editorElement.addEventListener('keyup', handleKeyUp);
    editorElement.addEventListener('focus', debouncedCheckSelection);

    return () => {
      editorElement.removeEventListener('mouseup', handleMouseUp);
      editorElement.removeEventListener('touchend', handleTouchEnd);
      editorElement.removeEventListener('keyup', handleKeyUp);
      editorElement.removeEventListener('focus', debouncedCheckSelection);
    };
  }, [debouncedCheckSelection, disabled, editorWrapperRef]);

  // Effect to hide toolbar on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const elementsToCheck = [editorWrapperRef.current, toolbarRef.current];
        const isOutsideElements = isClickOutside(target, elementsToCheck);
        const isOutsideMenus = !colorMenuAnchor && !headingMenuAnchor && !linkDialogOpen;

        if (showFloatingToolbar && isOutsideElements && isOutsideMenus) {
            setShowFloatingToolbar(false);
            return;
        }

        // Check if click is inside editor but possibly clears selection
        if (
            editorWrapperRef.current &&
            editorWrapperRef.current.contains(target) &&
            isClickOutside(target, [toolbarRef.current])
        ) {
            // Use RAF to check selection state after the click's effects
            requestAnimationFrame(() => {
                if (!hasValidSelection() && !colorMenuAnchor && !headingMenuAnchor && !linkDialogOpen) {
                    setShowFloatingToolbar(false);
                }
            });
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFloatingToolbar, colorMenuAnchor, headingMenuAnchor, linkDialogOpen, editorWrapperRef, toolbarRef]);

  return {
    showFloatingToolbar,
    floatingToolbarPosition,
    debouncedCheckSelection,
  };
}
