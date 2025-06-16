/**
 * Safe localStorage operations with error handling
 */

export interface ColorItem {
  label: string;
  color: string;
}

/**
 * Safely get an item from localStorage with error handling
 * @param key - The localStorage key
 * @param defaultValue - Default value to return if key doesn't exist or parsing fails
 * @returns Parsed value or default value
 */
export function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (error) {
    console.warn(`Failed to get localStorage item "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safely set an item in localStorage with error handling
 * @param key - The localStorage key
 * @param value - The value to store
 * @returns Success boolean
 */
export function safeSetLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item "${key}":`, error);
    return false;
  }
}

/**
 * Update recently used colors list with proper deduplication and limits
 * @param newColor - The color to add to recent list
 * @param currentList - Current list of recent colors
 * @param maxItems - Maximum number of items to keep (default: 5)
 * @returns Updated list
 */
export function updateRecentColors(
  newColor: ColorItem,
  currentList: ColorItem[],
  maxItems = 5
): ColorItem[] {
  // Remove the color if it already exists
  const filtered = currentList.filter(c => c.color !== newColor.color);
  // Add to front and limit to maxItems
  return [newColor, ...filtered].slice(0, maxItems);
}

/**
 * Load recently used colors from localStorage
 * @param key - The localStorage key
 * @returns Array of color items
 */
export function loadRecentColors(key: string): ColorItem[] {
  return safeGetLocalStorage<ColorItem[]>(key, []);
}

/**
 * Save recently used colors to localStorage
 * @param key - The localStorage key
 * @param colors - Array of color items to save
 * @returns Success boolean
 */
export function saveRecentColors(key: string, colors: ColorItem[]): boolean {
  return safeSetLocalStorage(key, colors);
}
