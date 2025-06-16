import { EditorState, RichUtils, getDefaultKeyBinding } from 'draft-js';

/**
 * Map keyboard shortcuts to commands
 */
export const keyBindingFn = (e: React.KeyboardEvent): string | null => {
  // Handle our custom shortcuts first
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'z':
        e.preventDefault();
        return e.shiftKey ? 'redo' : 'undo';
      case 'y':
        e.preventDefault();
        return 'redo';
      case 'l':
        e.preventDefault();
        return 'insert-link';
      case 'k':
        if (e.shiftKey) {
          e.preventDefault();
          return 'remove-link';
        }
        break;
      case 'x':
        if (e.shiftKey) {
          e.preventDefault();
          return 'clear-formatting';
        }
        break;
    }
  }

  // Fall back to DraftJS default key bindings for everything else
  return getDefaultKeyBinding(e as any);
};

/**
 * Handle keyboard shortcuts
 */
export const handleKeyCommand = (
  command: string,
  state: EditorState,
  handlers: {
    clearFormatting: () => void;
    handleLinkClick: () => void;
    removeLink: () => void;
    getCurrentLink: () => any;
    handleEditorChange: (state: EditorState) => void;
  }
): 'handled' | 'not-handled' => {
  const {
    clearFormatting,
    handleLinkClick,
    removeLink,
    getCurrentLink,
    handleEditorChange
  } = handlers;

  // Handle custom commands first
  switch (command) {
    case 'clear-formatting':
      clearFormatting();
      return 'handled';
    case 'insert-link':
      handleLinkClick();
      return 'handled';
    case 'remove-link':
      if (getCurrentLink()) {
        removeLink();
        return 'handled';
      }
      break;
    case 'undo':
      const undoState = EditorState.undo(state);
      if (undoState !== state) {
        handleEditorChange(undoState);
        return 'handled';
      }
      break;
    case 'redo':
      const redoState = EditorState.redo(state);
      if (redoState !== state) {
        handleEditorChange(redoState);
        return 'handled';
      }
      break;
  }

  // Handle default DraftJS commands
  const newState = RichUtils.handleKeyCommand(state, command);
  if (newState) {
    handleEditorChange(newState);
    return 'handled';
  }
  
  return 'not-handled';
};
