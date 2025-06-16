/**
 * Heading constants for the RichTextEditor
 */

export interface HeadingOption {
  label: string;
  style: string;
}

// Define heading options
export const HEADING_OPTIONS: HeadingOption[] = [
  { label: 'Normal', style: 'unstyled' },
  { label: 'Heading 1', style: 'header-one' },
  { label: 'Heading 2', style: 'header-two' },
  { label: 'Heading 3', style: 'header-three' },
];

// Keyboard shortcuts for common formatting
export const KEYBOARD_SHORTCUTS = {
  BOLD: 'Ctrl+B',
  ITALIC: 'Ctrl+I',
  UNDERLINE: 'Ctrl+U',
} as const;
