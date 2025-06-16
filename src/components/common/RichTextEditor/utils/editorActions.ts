import { EditorState, RichUtils, Modifier } from 'draft-js';

/**
 * Toggle inline styles (bold, italic, underline) with focus preservation
 */
export const toggleInlineStyle = (
  editorState: EditorState,
  style: string,
  editorRef: React.RefObject<any>
): EditorState => {
  const newState = RichUtils.toggleInlineStyle(editorState, style);
  
  // Keep focus on editor after applying style
  setTimeout(() => editorRef.current?.focus(), 0);
  
  return newState;
};

/**
 * Toggle block types (headings, lists) while preserving text color styles
 */
export const toggleBlockType = (
  editorState: EditorState,
  blockType: string,
  editorRef: React.RefObject<any>
): EditorState => {
  // Get current styles to preserve them
  const currentStyles = editorState.getCurrentInlineStyle();

  // Apply the block type change
  let nextEditorState = RichUtils.toggleBlockType(editorState, blockType);

  // Preserve text color styles by re-applying them
  const textColorStyles = currentStyles.filter((style): style is string =>
    style !== undefined && style.startsWith('TEXT_COLOR_')
  ).toArray();

  // Re-apply each text color style
  textColorStyles.forEach(style => {
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
  });

  setTimeout(() => editorRef.current?.focus(), 0);
  
  return nextEditorState;
};

/**
 * Apply text color with scroll position preservation
 */
export const applyTextColor = (
  editorState: EditorState,
  color: string,
  editorRef: React.RefObject<any>,
  addRecentTextColor: (color: any) => void,
  TEXT_COLORS: any[]
): { newState: EditorState; scrollTop: number } => {
  // Store current scroll position before applying color
  const editorElement = editorRef.current?.editor;
  const scrollTop = editorElement?.scrollTop || 0;

  const currentStyle = editorState.getCurrentInlineStyle();
  let nextEditorState = editorState;

  // Remove any existing text color styles in the selection
  const textColorStyles = currentStyle.filter((style): style is string =>
    style !== undefined && style.startsWith('TEXT_COLOR_')
  ).toArray();
  
  textColorStyles.forEach(style => {
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
  });

  // Apply the new text color if it's not default
  if (color !== 'default') {
    const newStyle = `TEXT_COLOR_${color.replace('#', '')}`;
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, newStyle);

    // Update recently used text colors
    const colorObj = TEXT_COLORS.find(c => c.color === color);
    if (colorObj) {
      addRecentTextColor(colorObj);
    }
  }

  return { newState: nextEditorState, scrollTop };
};

/**
 * Apply background color with scroll position preservation
 */
export const applyBackgroundColor = (
  editorState: EditorState,
  color: string,
  editorRef: React.RefObject<any>,
  addRecentBgColor: (color: any) => void,
  BACKGROUND_COLORS: any[]
): { newState: EditorState; scrollTop: number } => {
  // Store current scroll position before applying color
  const editorElement = editorRef.current?.editor;
  const scrollTop = editorElement?.scrollTop || 0;

  const currentStyle = editorState.getCurrentInlineStyle();
  let nextEditorState = editorState;

  // Remove any existing background color styles in the selection
  const bgColorStyles = currentStyle.filter((style): style is string =>
    style !== undefined && style.startsWith('BG_COLOR_')
  ).toArray();
  
  bgColorStyles.forEach(style => {
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
  });

  // Apply the new background color if it's not default
  if (color !== 'default') {
    const newStyle = `BG_COLOR_${color.replace('#', '')}`;
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, newStyle);

    // Update recently used background colors
    const colorObj = BACKGROUND_COLORS.find(c => c.color === color);
    if (colorObj) {
      addRecentBgColor(colorObj);
    }
  }

  return { newState: nextEditorState, scrollTop };
};

/**
 * Apply heading style with scroll position preservation
 */
export const applyHeading = (
  editorState: EditorState,
  headingStyle: string,
  editorRef: React.RefObject<any>
): { newState: EditorState; scrollTop: number } => {
  // Store current scroll position before applying heading
  const editorElement = editorRef.current?.editor;
  const scrollTop = editorElement?.scrollTop || 0;

  const currentStyles = editorState.getCurrentInlineStyle();

  // Apply the block type change
  let nextEditorState = RichUtils.toggleBlockType(editorState, headingStyle);

  // Preserve text color styles by re-applying them
  const textColorStyles = currentStyles.filter((style): style is string =>
    style !== undefined && style.startsWith('TEXT_COLOR_')
  ).toArray();

  // Re-apply each text color style
  textColorStyles.forEach(style => {
    nextEditorState = RichUtils.toggleInlineStyle(nextEditorState, style);
  });

  return { newState: nextEditorState, scrollTop };
};

/**
 * Clear all formatting from selected text
 */
export const clearFormatting = (
  editorState: EditorState,
  editorRef: React.RefObject<any>
): EditorState | null => {
  const selection = editorState.getSelection();
  if (selection.isCollapsed()) return null;

  const contentState = editorState.getCurrentContent();

  // Remove all inline styles
  let newContentState = contentState;
  const inlineStyles = editorState.getCurrentInlineStyle();

  inlineStyles.forEach(style => {
    if (style) {
      newContentState = Modifier.removeInlineStyle(newContentState, selection, style);
    }
  });

  // Create new editor state with cleared formatting
  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    'change-inline-style'
  );

  setTimeout(() => editorRef.current?.focus(), 0);
  
  return newEditorState;
};

/**
 * Get the current block type
 */
export const getCurrentBlockType = (editorState: EditorState): string => {
  const selection = editorState.getSelection();
  if (!selection.getHasFocus()) return 'unstyled'; // Return default if no focus
  
  try {
    const contentState = editorState.getCurrentContent();
    const startKey = selection.getStartKey();
    const currentBlock = contentState.getBlockForKey(startKey);
    return currentBlock.getType();
  } catch (e) {
    console.error("Error getting block type:", e);
    return 'unstyled';
  }
};

/**
 * Custom block renderer CSS classes
 */
export const blockStyleFn = (contentBlock: any): string => {
  const type = contentBlock.getType();
  switch (type) {
    case 'header-one':
      return 'RichEditor-h1';
    case 'header-two':
      return 'RichEditor-h2';
    case 'header-three':
      return 'RichEditor-h3';
    case 'unordered-list-item':
      return 'RichEditor-ul';
    case 'ordered-list-item':
      return 'RichEditor-ol';
    default:
      return ''; // Let Draft handle default block styling
  }
};

/**
 * Restore scroll position and focus
 */
export const restoreScrollAndFocus = (
  editorRef: React.RefObject<any>,
  scrollTop: number,
  delay: number = 0
) => {
  setTimeout(() => {
    const editorElement = editorRef.current?.editor;
    if (editorElement) {
      editorElement.scrollTop = scrollTop;
    }
    editorRef.current?.focus();
  }, delay);
};
