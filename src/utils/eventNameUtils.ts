/**
 * Utility functions for cleaning and processing economic event names
 */

/**
 * Clean event name for pinning by removing parentheses content and normalizing
 * This function is specifically designed for storing event names in pinned events
 * 
 * @param eventName - The original event name
 * @returns Cleaned event name suitable for pinning
 */
export function cleanEventNameForPinning(eventName: string): string {
  if (!eventName) return eventName;

  let cleaned = eventName.trim();

  // Remove parentheses and their content (e.g., "(***)", "(Prelim)", "(Final)")
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove leading/trailing special characters and extra spaces
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Check if two event names match after cleaning
 * This is useful for comparing pinned events with current events
 * 
 * @param eventName1 - First event name
 * @param eventName2 - Second event name
 * @returns True if the cleaned names match
 */
export function eventNamesMatch(eventName1: string, eventName2: string): boolean {
  const cleaned1 = cleanEventNameForPinning(eventName1);
  const cleaned2 = cleanEventNameForPinning(eventName2);
  return cleaned1.toLowerCase() === cleaned2.toLowerCase();
}

/**
 * Check if an event is pinned based on its name
 * 
 * @param eventName - The event name to check
 * @param pinnedEvents - Array of pinned event names
 * @returns True if the event is pinned
 */
export function isEventPinned(eventName: string, pinnedEvents: string[] = []): boolean {
  const cleanedEventName = cleanEventNameForPinning(eventName);
  return pinnedEvents.some(pinnedEvent => 
    pinnedEvent.toLowerCase() === cleanedEventName.toLowerCase()
  );
}
