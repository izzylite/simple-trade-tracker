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

// Define alignment options
export interface AlignmentOption {
  label: string;
  style: string;
  icon: string; // We'll use this to determine which icon to show
}

export const ALIGNMENT_OPTIONS: AlignmentOption[] = [
  { label: 'Align Left', style: 'align-left', icon: 'left' },
  { label: 'Align Center', style: 'align-center', icon: 'center' },
  { label: 'Align Right', style: 'align-right', icon: 'right' },
];

// Keyboard shortcuts for common formatting
export const KEYBOARD_SHORTCUTS = {
  BOLD: 'Ctrl+B',
  ITALIC: 'Ctrl+I',
  UNDERLINE: 'Ctrl+U',
} as const;
