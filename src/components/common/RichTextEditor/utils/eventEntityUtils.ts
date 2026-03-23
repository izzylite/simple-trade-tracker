import {
  EditorState,
  Modifier,
  ContentState,
  SelectionState,
} from 'draft-js';
import { ImpactLevel, Currency } from '../../../../types/economicCalendar';

/**
 * Find EVENT_LINK entities in a content block for the decorator
 */
export const findEventLinkEntities = (
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
          'EVENT_LINK'
      );
    },
    callback
  );
};

/**
 * Detect /event trigger from cursor position.
 * Returns search text after "/event " and trigger offset,
 * or null if no active trigger.
 */
export const getEventTrigger = (
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

  const textBeforeCursor = text.slice(0, cursorOffset);
  const triggerPattern = /(?:^|\s)(\/event )/;
  const match = textBeforeCursor.match(triggerPattern);

  if (!match) return null;

  const matchStart =
    match.index! + (match[0].startsWith('/') ? 0 : 1);
  const searchStart = matchStart + '/event '.length;
  const searchText = text.slice(searchStart, cursorOffset);

  return {
    searchText,
    triggerOffset: matchStart,
    blockKey,
  };
};

/**
 * Replace the "/event searchText" with an EVENT_LINK entity
 */
export const replaceEventTriggerWithLink = (
  editorState: EditorState,
  eventId: string,
  eventName: string,
  currency: Currency,
  impact: ImpactLevel,
  triggerOffset: number,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();
  const cursorOffset = selection.getStartOffset();

  const replaceSelection = SelectionState.createEmpty(
    blockKey
  ).merge({
    anchorOffset: triggerOffset,
    focusOffset: cursorOffset,
  }) as SelectionState;

  const contentStateWithEntity = contentState.createEntity(
    'EVENT_LINK',
    'IMMUTABLE',
    { eventId, eventName, currency, impact }
  );
  const entityKey =
    contentStateWithEntity.getLastCreatedEntityKey();

  const displayText = ` ${eventName} `;
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    replaceSelection,
    displayText,
    undefined,
    entityKey
  );

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
