import {
  EditorState, Modifier, ContentState, SelectionState,
} from 'draft-js';

/**
 * Find TAG entities in a content block for the decorator
 */
export const findTagEntities = (
  contentBlock: any,
  callback: any,
  contentState: ContentState
) => {
  contentBlock.findEntityRanges(
    (character: any) => {
      const entityKey = character.getEntity();
      return (
        entityKey !== null &&
        contentState.getEntity(entityKey).getType() === 'TRADE_TAG'
      );
    },
    callback
  );
};

/**
 * Insert a trade tag entity at the current cursor position
 */
export const insertTagEntity = (
  editorState: EditorState,
  tagName: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();

  // Create entity with tag data
  const contentStateWithEntity = contentState.createEntity(
    'TRADE_TAG',
    'IMMUTABLE',
    { tagName }
  );
  const entityKey =
    contentStateWithEntity.getLastCreatedEntityKey();

  // Insert the tag text with the entity applied
  const displayText = ` ${tagName} `;
  let newContentState = Modifier.insertText(
    contentStateWithEntity,
    selection,
    displayText,
    undefined,
    entityKey
  );

  // Append a plain space so the cursor lands outside the entity
  const afterTag = newContentState.getSelectionAfter();
  newContentState = Modifier.insertText(
    newContentState,
    afterTag,
    ' ',
    undefined,
    undefined
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );

  const afterSpace = newContentState.getSelectionAfter();
  return EditorState.forceSelection(newEditorState, afterSpace);
};

/**
 * Detect /tag trigger from cursor position.
 * Returns search text after "/tag " and the offset,
 * or null if no active trigger.
 *
 * Rules:
 * - "/tag" must follow whitespace or be at start of block
 * - Activates after "/tag " (with trailing space)
 */
export const getTagTrigger = (
  editorState: EditorState
): {
  searchText: string;
  triggerOffset: number;
  blockKey: string;
} | null => {
  const selection = editorState.getSelection();
  if (!selection.isCollapsed()) return null;

  const contentState = editorState.getCurrentContent();
  const blockKey = selection.getStartKey();
  const block = contentState.getBlockForKey(blockKey);
  const text = block.getText();
  const cursorOffset = selection.getStartOffset();

  // Look for "/tag " pattern before cursor
  const textBeforeCursor = text.slice(0, cursorOffset);
  const triggerPattern = /(?:^|\s)(\/tag )/;
  const match = textBeforeCursor.match(triggerPattern);

  if (!match) return null;

  const matchStart =
    match.index! + (match[0].startsWith('/') ? 0 : 1);
  const searchStart = matchStart + '/tag '.length;
  const searchText = text.slice(searchStart, cursorOffset);

  return {
    searchText,
    triggerOffset: matchStart,
    blockKey,
  };
};

/**
 * Replace the "/tag searchText" with a tag entity
 */
export const replaceTagTriggerWithTag = (
  editorState: EditorState,
  tagName: string,
  triggerOffset: number,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const cursorOffset = selection.getStartOffset();

  // Create selection covering "/tag searchText"
  const replaceSelection =
    SelectionState.createEmpty(blockKey).merge({
      anchorOffset: triggerOffset,
      focusOffset: cursorOffset,
    }) as SelectionState;

  // Create entity
  const contentStateWithEntity = contentState.createEntity(
    'TRADE_TAG',
    'IMMUTABLE',
    { tagName }
  );
  const entityKey =
    contentStateWithEntity.getLastCreatedEntityKey();

  // Replace the /tag text with the tag chip text
  const displayText = ` ${tagName} `;
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    replaceSelection,
    displayText,
    undefined,
    entityKey
  );

  // Insert a regular space after the entity
  const afterTag = newContentState.getSelectionAfter();
  newContentState = Modifier.insertText(
    newContentState,
    afterTag,
    ' ',
    undefined,
    undefined
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );

  const afterSpace = newContentState.getSelectionAfter();
  return EditorState.forceSelection(newEditorState, afterSpace);
};

// Keep old names as aliases for backward compatibility
export const getAtMentionTrigger = getTagTrigger;
export const replaceAtMentionWithTag = replaceTagTriggerWithTag;
