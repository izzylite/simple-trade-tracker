import {
  EditorState,
  Modifier,
  ContentState,
} from 'draft-js';

/**
 * Data stored on a TRADE_LINK entity. Includes share metadata so the chip
 * click can route through the existing shared-trade pipeline without a
 * second lookup, and a small denormalized snapshot (date + pnl) so the
 * chip renders without a network round-trip.
 */
export type TradeChipData = {
  shareId: string;
  tradeId: string;
  date: string;
  pnl: number;
  direction?: 'long' | 'short';
};

/**
 * Find TRADE_LINK entities in a content block for the decorator
 */
export const findTradeLinkEntities = (
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
          'TRADE_LINK'
      );
    },
    callback
  );
};

/**
 * Build the visible label for a trade chip.
 * Format: "MMM D · ±$N" — date short-form + signed P&L.
 */
export const formatTradeChipLabel = (
  date: string,
  pnl: number
): string => {
  let datePart = date;
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      datePart = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // fall through with raw string
  }
  const sign = pnl >= 0 ? '+' : '-';
  const abs = Math.abs(pnl);
  const pnlPart = `${sign}$${abs.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
  return `${datePart} · ${pnlPart}`;
};

/**
 * Insert a TRADE_LINK entity at the current cursor position. The host
 * resolves the trade data (via the share-link dialog flow) and hands a
 * ready-to-render snapshot in.
 */
export const insertTradeLinkEntity = (
  editorState: EditorState,
  data: TradeChipData
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();

  const contentStateWithEntity = contentState.createEntity(
    'TRADE_LINK',
    'IMMUTABLE',
    data
  );
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

  const blockKey = selection.getStartKey();
  const startOffset = selection.getStartOffset();
  const block = contentState.getBlockForKey(blockKey);
  const charBefore = startOffset > 0
    ? block.getText().charAt(startOffset - 1)
    : '';
  const needLeadingSpace = charBefore !== '' && !/\s/.test(charBefore);

  const label = formatTradeChipLabel(data.date, data.pnl);
  const displayText = `${needLeadingSpace ? ' ' : ''}${label}`;

  // replaceText (not insertText) so a non-collapsed selection at call time
  // — e.g. user had text selected when they clicked the toolbar button —
  // collapses to the inserted chip instead of throwing the
  // "insertText should only be called with a collapsed range" invariant.
  let newContentState = Modifier.replaceText(
    contentStateWithEntity,
    selection,
    displayText,
    undefined,
    entityKey
  );

  // Append a plain trailing space so the cursor lands outside the entity
  const afterEntity = newContentState.getSelectionAfter();
  newContentState = Modifier.insertText(
    newContentState,
    afterEntity,
    ' ',
    undefined,
    undefined
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  );

  return EditorState.forceSelection(
    newEditorState,
    newContentState.getSelectionAfter()
  );
};
