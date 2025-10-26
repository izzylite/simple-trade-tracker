import { EditorState, Modifier, SelectionState, ContentState } from 'draft-js';

/**
 * Check if this is an internal trade link and extract relevant IDs
 */
export const isInternalTradeLink = (url: string): {
  type: 'calendar' | 'shared' | 'external';
  id?: string;
  tradeId?: string;
  calendarId?: string;
} => {
  try {
    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname;

    // Check for calendar links: /calendar/{calendarId}
    const calendarMatch = pathname.match(/^\/calendar\/([^/]+)$/);
    if (calendarMatch) {
      return { type: 'calendar', id: calendarMatch[1], calendarId: calendarMatch[1] };
    }

    // Check for shared trade links: /shared/{shareId}
    const sharedMatch = pathname.match(/^\/shared\/([^/]+)$/);
    if (sharedMatch) {
      const shareId = sharedMatch[1];
      // Extract tradeId from shareId format: share_{tradeId}_{timestamp}_{random}
      const shareIdParts = shareId.split('_');
      if (shareIdParts.length >= 2 && shareIdParts[0] === 'share') {
        const tradeId = shareIdParts[1];
        return { type: 'shared', id: shareId, tradeId };
      }
      return { type: 'shared', id: shareId };
    }

    return { type: 'external' };
  } catch {
    // If URL parsing fails, treat as external
    return { type: 'external' };
  }
};

/**
 * Check if current selection has a link
 */
export const getCurrentLink = (editorState: EditorState) => {
  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();
  const startKey = selection.getStartKey();
  const startOffset = selection.getStartOffset();
  const blockWithLinkAtBeginning = contentState.getBlockForKey(startKey);
  const linkKey = blockWithLinkAtBeginning.getEntityAt(startOffset);

  if (linkKey) {
    const linkInstance = contentState.getEntity(linkKey);
    if (linkInstance.getType() === 'LINK') {
      return {
        entityKey: linkKey,
        url: linkInstance.getData().url
      };
    }
  }
  return null;
};

/**
 * Trim whitespace from selection and return cleaned text with adjusted indices
 */
export const trimSelection = (selection: SelectionState, contentState: ContentState) => {
  if (selection.isCollapsed()) {
    return { text: '', selection };
  }

  const startKey = selection.getStartKey();
  const endKey = selection.getEndKey();
  const startOffset = selection.getStartOffset();
  const endOffset = selection.getEndOffset();

  if (startKey === endKey) {
    // Single block selection
    const block = contentState.getBlockForKey(startKey);
    const blockText = block.getText();
    const selectedText = blockText.slice(startOffset, endOffset);

    // Find the actual text boundaries (excluding whitespace)
    const trimmedText = selectedText.trim();
    if (trimmedText.length === 0) {
      return { text: '', selection };
    }

    // Calculate how much whitespace was trimmed from start and end
    const leadingWhitespace = selectedText.length - selectedText.trimStart().length;
    const trailingWhitespace = selectedText.length - selectedText.trimEnd().length;

    // Adjust the selection to exclude whitespace
    const adjustedSelection = selection.merge({
      anchorOffset: startOffset + leadingWhitespace,
      focusOffset: endOffset - trailingWhitespace,
    });

    return { text: trimmedText, selection: adjustedSelection };
  } else {
    // Multi-block selection - more complex, but let's handle the common case
    const blocks = contentState.getBlocksAsArray();
    const startIndex = blocks.findIndex(block => block.getKey() === startKey);
    const endIndex = blocks.findIndex(block => block.getKey() === endKey);

    let fullText = '';
    for (let i = startIndex; i <= endIndex; i++) {
      const block = blocks[i];
      const blockText = block.getText();

      if (i === startIndex && i === endIndex) {
        // Single block case (shouldn't happen here, but just in case)
        fullText += blockText.slice(startOffset, endOffset);
      } else if (i === startIndex) {
        // First block
        fullText += blockText.slice(startOffset);
      } else if (i === endIndex) {
        // Last block
        fullText += ' ' + blockText.slice(0, endOffset);
      } else {
        // Middle blocks
        fullText += ' ' + blockText;
      }
    }

    const trimmedText = fullText.trim();
    // For multi-block selections, we'll return the original selection
    // but with trimmed text - adjusting multi-block selections is complex
    return { text: trimmedText, selection };
  }
};

/**
 * Create a link entity and insert/replace text with link
 */
export const createLinkEntity = (
  editorState: EditorState,
  linkUrl: string,
  linkText: string
): EditorState => {
  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();

  // Create a link entity
  const contentStateWithEntity = contentState.createEntity(
    'LINK',
    'MUTABLE',
    { url: linkUrl }
  );
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

  let newContentState;
  let textToInsert = linkText.trim() || linkUrl;

  if (selection.isCollapsed()) {
    // No selection, insert new text with link entity
    newContentState = Modifier.insertText(
      contentStateWithEntity,
      selection,
      textToInsert,
      undefined, // No inline styles
      entityKey   // Apply the link entity
    );
  } else {
    // Replace selected text with link text and apply entity
    // First, get the trimmed selection to avoid whitespace in links
    const { selection: trimmedSelection } = trimSelection(selection, contentState);

    newContentState = Modifier.replaceText(
      contentStateWithEntity,
      trimmedSelection,
      textToInsert,
      undefined, // No inline styles
      entityKey   // Apply the link entity
    );
  }

  return EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );
};

/**
 * Remove link entity from selection
 */
export const removeLinkEntity = (editorState: EditorState): EditorState => {
  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();

  if (!selection.isCollapsed()) {
    // Remove entity from selected text (use trimmed selection)
    const { selection: trimmedSelection } = trimSelection(selection, contentState);
    const newContentState = Modifier.applyEntity(
      contentState,
      trimmedSelection,
      null // Remove entity by setting to null
    );

    return EditorState.push(
      editorState,
      newContentState,
      'apply-entity'
    );
  } else {
    // Find the link entity at cursor position and remove it
    const currentLink = getCurrentLink(editorState);
    if (currentLink) {
      const startKey = selection.getStartKey();
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

      // Create selection for the entire link
      const linkSelection = selection.merge({
        anchorOffset: linkStart,
        focusOffset: linkEnd,
      });

      // Remove the entity
      const newContentState = Modifier.applyEntity(
        contentState,
        linkSelection,
        null
      );

      return EditorState.push(
        editorState,
        newContentState,
        'apply-entity'
      );
    }
  }

  return editorState;
};

/**
 * Function to find link entities for decorator
 */
export const findLinkEntities = (contentBlock: any, callback: any, contentState: ContentState) => {
  contentBlock.findEntityRanges(
    (character: any) => {
      const entityKey = character.getEntity();
      return (
        entityKey !== null &&
        contentState.getEntity(entityKey).getType() === 'LINK'
      );
    },
    callback
  );
};
