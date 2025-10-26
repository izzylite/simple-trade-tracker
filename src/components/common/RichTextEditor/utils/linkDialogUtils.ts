import React from 'react';
import { EditorState } from 'draft-js';
import { getCurrentLink, trimSelection } from './linkUtils';

/**
 * Handle link dialog opening and populate fields
 */
export const handleLinkDialogOpen = (
  editorState: EditorState,
  editorWrapperRef: React.RefObject<HTMLDivElement | null>,
  savedScrollPositionRef: React.MutableRefObject<number>,
  setLinkText: (text: string) => void,
  setLinkUrl: (url: string) => void,
  setLinkDialogOpen: (open: boolean) => void
) => {
  // Store current scroll position before opening dialog
  const editorElement = editorWrapperRef.current;
  if (editorElement) {
    savedScrollPositionRef.current = editorElement.scrollTop;
  }

  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();

  // Check if we're editing an existing link
  const currentLink = getCurrentLink(editorState);
  if (currentLink) {
    // Editing existing link - populate with current values
    const startKey = selection.getStartKey();
    const endKey = selection.getEndKey();

    if (startKey === endKey) {
      const block = contentState.getBlockForKey(startKey);
      const blockText = block.getText();

      // Find the extent of the link entity
      let linkStart = selection.getStartOffset();
      let linkEnd = selection.getEndOffset();

      // Expand selection to cover the entire link
      while (linkStart > 0 && block.getEntityAt(linkStart - 1) === currentLink.entityKey) {
        linkStart--;
      }
      while (linkEnd < blockText.length && block.getEntityAt(linkEnd) === currentLink.entityKey) {
        linkEnd++;
      }

      const linkText = blockText.slice(linkStart, linkEnd);
      setLinkText(linkText);
    } else {
      setLinkText(''); // Multi-block links are complex, let user re-enter
    }
    setLinkUrl(currentLink.url);
  } else if (selection.isCollapsed()) {
    // No text selected, open dialog for new link
    setLinkText('');
    setLinkUrl('');
  } else {
    // Text selected, use it as link text (trim whitespace)
    const { text: trimmedText } = trimSelection(selection, contentState);
    setLinkText(trimmedText);
    setLinkUrl('');
  }

  // Small delay to ensure scroll position is captured before dialog opens
  setTimeout(() => {
    setLinkDialogOpen(true);
  }, 10);
};

/**
 * Handle link dialog close and cleanup
 */
export const handleLinkDialogClose = (
  setLinkDialogOpen: (open: boolean) => void,
  setLinkText: (text: string) => void,
  setLinkUrl: (url: string) => void
) => {
  setLinkDialogOpen(false);
  setLinkText('');
  setLinkUrl('');
};
