import { EditorState, ContentState, convertFromRaw, convertToRaw } from 'draft-js';
import { warn, error } from '../../../../utils/logger';

/**
 * Safely create an EditorState from a value string
 * @param value - The value to parse (JSON string or plain text)
 * @returns EditorState
 */
export function createEditorStateFromValue(value?: string): EditorState {
  if (!value) {
    return EditorState.createEmpty();
  }

  try {
    // Try to parse the value as raw content
    const rawContent = JSON.parse(value);
    
    // Basic validation for Draft.js raw content structure
    if (
      rawContent &&
      typeof rawContent === 'object' &&
      Array.isArray(rawContent.blocks) &&
      typeof rawContent.entityMap === 'object'
    ) {
      const contentState = convertFromRaw(rawContent);
      return EditorState.createWithContent(contentState);
    } else {
      // If not valid raw JSON, treat as plain text
      return EditorState.createWithContent(ContentState.createFromText(value));
    }
  } catch (error) {
    // If parsing fails, create with plain text
    warn('RichTextEditor: Failed to parse initial value as Draft.js raw content. Treating as plain text.', error);
    return EditorState.createWithContent(ContentState.createFromText(value));
  }
}

/**
 * Check if two editor states have the same content
 * @param state1 - First editor state
 * @param state2 - Second editor state
 * @returns True if content is the same
 */
export function hasContentChanged(state1: EditorState, state2: EditorState): boolean {
  const content1 = state1.getCurrentContent();
  const content2 = state2.getCurrentContent();
  
  // Quick reference check first
  if (content1 === content2) {
    return false;
  }
  
  try {
    const raw1 = convertToRaw(content1);
    const raw2 = convertToRaw(content2);
    return JSON.stringify(raw1) !== JSON.stringify(raw2);
  } catch (error) {
    warn('Error comparing editor content:', error);
    // Fallback to reference comparison
    return content1 !== content2;
  }
}

/**
 * Get content as JSON string from EditorState
 * @param editorState - The editor state
 * @returns JSON string representation
 */
export function getContentAsJson(editorState: EditorState): string {
  try {
    const contentState = editorState.getCurrentContent();
    const rawContent = convertToRaw(contentState);
    return JSON.stringify(rawContent);
  } catch (error_) {
    error('Error converting editor content to JSON:', error_);
    return '{"blocks":[],"entityMap":{}}'; // Return empty content as fallback
  }
}

/**
 * Check if editor has any content
 * @param editorState - The editor state
 * @returns True if editor has content
 */
export function hasContent(editorState: EditorState): boolean {
  const contentState = editorState.getCurrentContent();
  return contentState.hasText() || contentState.getBlockMap().size > 1;
}
