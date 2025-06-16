import React from 'react';
import { Theme } from '@mui/material/styles';

/**
 * Create custom style map for colors
 */
export const createStyleMap = (
  theme: Theme,
  TEXT_COLORS: any[],
  BACKGROUND_COLORS: any[]
): Record<string, React.CSSProperties> => {
  const styleMap: Record<string, React.CSSProperties> = {};
  
  // Add text colors to the style map
  TEXT_COLORS.forEach(color => {
    if (color.color !== 'default') {
      // Use softer white (#CCCCCC) for dark mode, pure white for light mode
      const finalColor = color.color === '#FFFFFF' && theme.palette.mode === 'dark'
        ? '#CCCCCC'
        : color.color;
      styleMap[`TEXT_COLOR_${color.color.replace('#', '')}`] = { color: finalColor };
    }
  });
  
  // Add background colors to the style map
  BACKGROUND_COLORS.forEach(color => {
    if (color.color !== 'default') {
      // For dark background colors, use white text for better contrast
      // In light theme, all background colors are dark, so text should be light
      // In dark theme, we can keep the same approach since the backgrounds are still dark
      const textColor = theme.palette.mode === 'light' ? '#FFFFFF' : '#FFFFFF';

      styleMap[`BG_COLOR_${color.color.replace('#', '')}`] = {
        backgroundColor: color.color,
        color: textColor,
        padding: '2px 4px',
        borderRadius: '3px'
      };
    }
  });

  return styleMap;
};

/**
 * Function to prevent editor blur/selection clear when interacting with toolbar
 */
export const handleToolbarInteraction = (event: React.MouseEvent | React.TouchEvent) => {
  event.preventDefault(); // Prevent editor losing focus
  // event.stopPropagation(); // Usually not needed unless nested click handlers conflict
};
