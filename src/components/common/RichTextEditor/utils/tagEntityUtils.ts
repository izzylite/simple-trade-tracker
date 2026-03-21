import { EditorState, Modifier, ContentState, SelectionState } from 'draft-js';

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
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

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
 * Get the current @ mention trigger info from cursor position.
 * Returns the search text after @ and the offset of the @ character,
 * or null if no active trigger.
 */
export const getAtMentionTrigger = (
  editorState: EditorState
): { searchText: string; triggerOffset: number; blockKey: string } | null => {
  const selection = editorState.getSelection();
  if (!selection.isCollapsed()) return null;

  const contentState = editorState.getCurrentContent();
  const blockKey = selection.getStartKey();
  const block = contentState.getBlockForKey(blockKey);
  const text = block.getText();
  const cursorOffset = selection.getStartOffset();

  // Walk backwards from cursor to find @
  for (let i = cursorOffset - 1; i >= 0; i--) {
    const char = text[i];
    if (char === '@') {
      const searchText = text.slice(i + 1, cursorOffset);
      return { searchText, triggerOffset: i, blockKey };
    }
    // Stop at whitespace or newline before finding @
    if (char === ' ' || char === '\n') return null;
  }

  return null;
};

/**
 * Replace the @search text with a tag entity
 */
export const replaceAtMentionWithTag = (
  editorState: EditorState,
  tagName: string,
  triggerOffset: number,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const cursorOffset = selection.getStartOffset();

  // Create selection covering "@searchText"
  const replaceSelection = SelectionState.createEmpty(blockKey).merge({
    anchorOffset: triggerOffset,
    focusOffset: cursorOffset,
  }) as SelectionState;

  // Create entity
  const contentStateWithEntity = contentState.createEntity(
    'TRADE_TAG',
    'IMMUTABLE',
    { tagName }
  );
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

  // Replace the @text with the tag chip text (no trailing space in entity)
  const displayText = ` ${tagName} `;
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    replaceSelection,
    displayText,
    undefined,
    entityKey
  );

  // Insert a regular space after the entity so the cursor has
  // somewhere to land and the user can keep typing
  const afterTag = newContentState.getSelectionAfter();
  newContentState = Modifier.insertText(
    newContentState,
    afterTag,
    ' ',
    undefined,
    undefined // no entity — plain text
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );

  const afterSpace = newContentState.getSelectionAfter();
  return EditorState.forceSelection(newEditorState, afterSpace);
};
