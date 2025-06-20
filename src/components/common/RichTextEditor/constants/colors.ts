/**
 * Color constants for the RichTextEditor
 */

export interface ColorOption {
  label: string;
  color: string;
}

// Define text color options
export const TEXT_COLORS: ColorOption[] = [
  { label: 'Default', color: 'default' }, // Handled specially in rendering
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#FFFFFF' },
  { label: 'Brown', color: '#BA856F' },
  { label: 'Orange', color: '#C07A47' },
  { label: 'Yellow', color: '#B58A48' },
  { label: 'Green', color: '#427256' },
  { label: 'Blue', color: '#379AD3' },
  { label: 'Purple', color: '#9664C9' },
  { label: 'Pink', color: '#9B4342' },
  { label: 'Red', color: '#BC4B4A' },
];

// Define background color options
export const BACKGROUND_COLORS: ColorOption[] = [
  { label: 'Default', color: 'default' }, // Handled specially
  { label: 'Black', color: '#000000' },
  { label: 'Dark Gray', color: '#2F2F2F' },
  { label: 'Brown', color: '#4A3228' },
  { label: 'Orange', color: '#5C3B23' },
  { label: 'Yellow', color: '#564328' },
  { label: 'Green', color: '#243D30' },
  { label: 'Blue', color: '#143A4E' },
  { label: 'Purple', color: '#3C2D49' },
  { label: 'Pink', color: '#4E2C3C' },
  { label: 'Red', color: '#522E2A' },
];

// LocalStorage keys for recently used colors
export const STORAGE_KEYS = {
  RECENT_TEXT_COLORS: 'richTextEditor_recentTextColors',
  RECENT_BG_COLORS: 'richTextEditor_recentBgColors',
} as const;
