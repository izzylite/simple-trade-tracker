import { useState, useEffect, useCallback } from 'react';
import { 
  loadRecentColors, 
  saveRecentColors, 
  updateRecentColors,
  type ColorItem 
} from '../utils/localStorage';
import { STORAGE_KEYS } from '../constants/colors';

/**
 * Custom hook to manage recently used colors
 */
export function useRecentColors() {
  const [recentTextColors, setRecentTextColors] = useState<ColorItem[]>([]);
  const [recentBgColors, setRecentBgColors] = useState<ColorItem[]>([]);

  // Load recent colors on mount
  useEffect(() => {
    setRecentTextColors(loadRecentColors(STORAGE_KEYS.RECENT_TEXT_COLORS));
    setRecentBgColors(loadRecentColors(STORAGE_KEYS.RECENT_BG_COLORS));
  }, []);

  // Add a text color to recent list
  const addRecentTextColor = useCallback((color: ColorItem) => {
    setRecentTextColors(prev => {
      const newList = updateRecentColors(color, prev);
      saveRecentColors(STORAGE_KEYS.RECENT_TEXT_COLORS, newList);
      return newList;
    });
  }, []);

  // Add a background color to recent list
  const addRecentBgColor = useCallback((color: ColorItem) => {
    setRecentBgColors(prev => {
      const newList = updateRecentColors(color, prev);
      saveRecentColors(STORAGE_KEYS.RECENT_BG_COLORS, newList);
      return newList;
    });
  }, []);

  return {
    recentTextColors,
    recentBgColors,
    addRecentTextColor,
    addRecentBgColor,
  };
}
