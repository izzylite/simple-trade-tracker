import {
  EditorState,
  Modifier,
  ContentState,
  SelectionState,
} from 'draft-js';

/**
 * Find NOTE_LINK entities in a content block for the decorator
 */
export const findNoteLinkEntities = (
  contentBlock: any,
  callback: any,
  contentState: ContentState
) => {
  contentBlock.findEntityRanges(
    (character: any) => {
      const entityKey = character.getEntity();
      return (
        entityKey !== null &&
        contentState.getEntity(entityKey).getType() ===
          'NOTE_LINK'
      );
    },
    callback
  );
};

/**
 * Detect /note trigger from cursor position.
 * Returns search text after "/note " and trigger offset,
 * or null if no active trigger.
 *
 * Rules:
 * - "/note" must follow whitespace or be at start of block
 * - Activates after "/note " (with trailing space)
 */
export const getNoteTrigger = (
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

  // Look for "/note " pattern before cursor
  const textBeforeCursor = text.slice(0, cursorOffset);
  const triggerPattern = /(?:^|\s)(\/note )/;
  const match = textBeforeCursor.match(triggerPattern);

  if (!match) return null;

  // Calculate the offset where "/note " starts
  const matchStart =
    match.index! + (match[0].startsWith('/') ? 0 : 1);
  const searchStart = matchStart + '/note '.length;
  const searchText = text.slice(searchStart, cursorOffset);

  return {
    searchText,
    triggerOffset: matchStart,
    blockKey,
  };
};

/**
 * Replace the "/note searchText" with a NOTE_LINK entity
 */
export const replaceNoteTriggerWithLink = (
  editorState: EditorState,
  noteId: string,
  noteTitle: string,
  triggerOffset: number,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const cursorOffset = selection.getStartOffset();

  // Select from trigger start to cursor
  const replaceSelection = SelectionState.createEmpty(
    blockKey
  ).merge({
    anchorOffset: triggerOffset,
    focusOffset: cursorOffset,
  }) as SelectionState;

  // Create NOTE_LINK entity
  const contentStateWithEntity = contentState.createEntity(
    'NOTE_LINK',
    'IMMUTABLE',
    { noteId, noteTitle }
  );
  const entityKey =
    contentStateWithEntity.getLastCreatedEntityKey();

  // Decide whether to inject a leading space. If the char immediately
  // before triggerOffset is BOL or whitespace, the inserted entity-space
  // would visibly double up. Mirror logic for tag/event utils.
  const block = contentState.getBlockForKey(blockKey);
  const charBefore = triggerOffset > 0
    ? block.getText().charAt(triggerOffset - 1)
    : '';
  const needLeadingSpace = charBefore !== '' && !/\s/.test(charBefore);

  // Entity wraps only the title. Trailing space is plain so the cursor
  // lands outside the IMMUTABLE entity instead of inside it.
  const displayText = `${needLeadingSpace ? ' ' : ''}${noteTitle}`;
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    replaceSelection,
    displayText,
    undefined,
    entityKey
  );

  // Add trailing space outside entity
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
  return EditorState.forceSelection(
    newEditorState,
    afterSpace
  );
};
