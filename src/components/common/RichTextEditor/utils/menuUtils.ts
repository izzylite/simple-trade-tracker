import React from 'react';

/**
 * Handle heading menu button clicks (toggle open/close)
 */
export const createHeadingButtonClickHandler = (
  headingMenuAnchor: HTMLElement | null,
  setHeadingMenuAnchor: (anchor: HTMLElement | null) => void,
  editorRef: React.RefObject<any>
) => {
  return (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Store current scroll position before opening menu
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    if (headingMenuAnchor) {
      setHeadingMenuAnchor(null); // Close if already open
      setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setHeadingMenuAnchor(event.currentTarget); // Open if closed

      // Restore scroll position after menu opens
      setTimeout(() => {
        if (editorElement) {
          editorElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  };
};

/**
 * Handle color menu button clicks (toggle open/close)
 */
export const createColorButtonClickHandler = (
  colorMenuAnchor: HTMLElement | null,
  setColorMenuAnchor: (anchor: HTMLElement | null) => void,
  editorRef: React.RefObject<any>
) => {
  return (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Store current scroll position before opening menu
    const editorElement = editorRef.current?.editor;
    const scrollTop = editorElement?.scrollTop || 0;

    if (colorMenuAnchor) {
      setColorMenuAnchor(null); // Close if already open
      setTimeout(() => editorRef.current?.focus(), 0); // Refocus
    } else {
      setColorMenuAnchor(event.currentTarget); // Open if closed

      // Restore scroll position after menu opens
      setTimeout(() => {
        if (editorElement) {
          editorElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  };
};

/**
 * Create menu close handler with focus restoration
 */
export const createMenuCloseHandler = (
  setMenuAnchor: (anchor: HTMLElement | null) => void,
  editorState: any,
  editorRef: React.RefObject<any>
) => {
  return () => {
    setMenuAnchor(null);
    // Don't check selection when menu closes to prevent unwanted scrolling
    // The toolbar will be repositioned naturally when user interacts with editor again
    // Refocus editor after closing menu only if editor still has focus logically
    if (editorState.getSelection().getHasFocus()) {
      setTimeout(() => editorRef.current?.focus(), 0);
    }
  };
};
