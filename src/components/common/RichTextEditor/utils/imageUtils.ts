import {
  EditorState,
  AtomicBlockUtils,
  ContentBlock,
  SelectionState,
  Modifier,
} from 'draft-js';

/**
 * Insert an image into the editor
 * @param editorState - Current editor state
 * @param src - Image source URL
 * @param alt - Image alt text
 * @param width - Optional width constraint
 * @returns New editor state with image inserted
 */
export const insertImage = (
  editorState: EditorState,
  src: string,
  alt: string = '',
  width?: string
): EditorState => {
  const contentState = editorState.getCurrentContent();

  // Create entity for the image
  const contentStateWithEntity = contentState.createEntity('IMAGE', 'IMMUTABLE', {
    src,
    alt,
    width: width || '100%',
  });

  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

  // Insert atomic block with the image entity
  const newEditorState = AtomicBlockUtils.insertAtomicBlock(
    EditorState.set(editorState, { currentContent: contentStateWithEntity }),
    entityKey,
    ' '
  );

  return newEditorState;
};

/**
 * Remove an image block from the editor
 * @param editorState - Current editor state
 * @param blockKey - Key of the block to remove
 * @returns New editor state with block removed
 */
export const removeImageBlock = (
  editorState: EditorState,
  blockKey: string
): EditorState => {
  const contentState = editorState.getCurrentContent();
  const blockMap = contentState.getBlockMap();

  // Get the block to remove
  const block = blockMap.get(blockKey);
  if (!block) return editorState;

  // Create selection for the entire block
  const blockSelection = SelectionState.createEmpty(blockKey).merge({
    anchorOffset: 0,
    focusOffset: block.getLength(),
  }) as SelectionState;

  // Remove the block content
  let newContentState = Modifier.removeRange(contentState, blockSelection, 'backward');

  // Also remove the block itself by selecting it entirely
  const newBlockMap = newContentState.getBlockMap().delete(blockKey);

  // If this would leave the editor empty, keep at least one empty block
  if (newBlockMap.size === 0) {
    return EditorState.createEmpty();
  }

  newContentState = newContentState.merge({
    blockMap: newBlockMap,
  }) as typeof newContentState;

  const newEditorState = EditorState.push(editorState, newContentState, 'remove-range');

  return newEditorState;
};

/**
 * Check if a block is an image block
 * @param block - Content block to check
 * @param contentState - Current content state
 * @returns True if block is an image
 */
export const isImageBlock = (
  block: ContentBlock,
  contentState: any
): boolean => {
  if (block.getType() !== 'atomic') return false;

  const entityKey = block.getEntityAt(0);
  if (!entityKey) return false;

  const entity = contentState.getEntity(entityKey);
  return entity.getType() === 'IMAGE';
};

/**
 * Get image data from a block
 * @param block - Content block
 * @param contentState - Current content state
 * @returns Image data or null
 */
export const getImageData = (
  block: ContentBlock,
  contentState: any
): { src: string; alt: string; width: string } | null => {
  if (!isImageBlock(block, contentState)) return null;

  const entityKey = block.getEntityAt(0);
  if (!entityKey) return null;

  const entity = contentState.getEntity(entityKey);
  return entity.getData();
};
