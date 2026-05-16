import { EditorState, RichUtils, Modifier } from 'draft-js';

export const CALLOUT_VARIANTS = [
  'callout-warning',
  'callout-info',
  'callout-success',
  'callout-danger',
] as const;

export type CalloutVariant = typeof CALLOUT_VARIANTS[number];

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  'callout-warning': 'Warning callout',
  'callout-info':    'Info callout',
  'callout-success': 'Success callout',
  'callout-danger':  'Danger callout',
};

export const isCalloutBlockType = (type: string): type is CalloutVariant =>
  (CALLOUT_VARIANTS as readonly string[]).includes(type);

/**
 * Toggle a callout block type on the current selection. If the current
 * block is already the requested variant, revert to unstyled (acts as
 * "switch off"). If it's a different variant, swap to the new one.
 */
export const toggleCalloutBlock = (
  editorState: EditorState,
  variant: CalloutVariant
): EditorState => {
  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();
  const currentType = contentState
    .getBlockForKey(selection.getStartKey())
    .getType();

  if (currentType === variant) {
    return RichUtils.toggleBlockType(editorState, variant);
  }

  if (isCalloutBlockType(currentType)) {
    // Mid-swap: first clear the existing callout, then apply the new one.
    const cleared = RichUtils.toggleBlockType(editorState, currentType);
    return RichUtils.toggleBlockType(cleared, variant);
  }

  return RichUtils.toggleBlockType(editorState, variant);
};

/**
 * Handle Enter inside a callout. Mirrors the markdown editor convention:
 * - Enter on a non-empty callout line → new callout line (default Draft
 *   behavior; we return 'not-handled' to let it through).
 * - Enter on an empty callout line → exit the callout (downgrade the
 *   block to 'unstyled'), so the user can escape without a toolbar trip.
 *
 * Returns the next EditorState if we handled the key, or null otherwise.
 */
export const handleCalloutReturn = (
  editorState: EditorState
): EditorState | null => {
  const selection = editorState.getSelection();
  if (!selection.isCollapsed()) return null;

  const contentState = editorState.getCurrentContent();
  const blockKey = selection.getStartKey();
  const block = contentState.getBlockForKey(blockKey);
  const type = block.getType();

  if (!isCalloutBlockType(type)) return null;
  if (block.getText().length !== 0) return null;

  // Empty callout line → revert to plain paragraph.
  const newContentState = Modifier.setBlockType(
    contentState,
    selection,
    'unstyled'
  );
  return EditorState.push(
    editorState,
    newContentState,
    'change-block-type'
  );
};
