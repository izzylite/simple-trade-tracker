/**
 * Utility functions for cleaning and processing economic event names
 */

import { PinnedEvent, TradeEconomicEvent } from "../types/dualWrite";
import { EconomicEvent } from "../types/economicCalendar";

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

  return getBaseEventName(cleaned);
}

  // Helper function to extract base event name (remove date suffix)
  // E.g., "Initial Jobless Claims Oct25" -> "Initial Jobless Claims"
  // E.g., "Consumer Confidence (May)" -> "Consumer Confidence"
  // E.g., "Durable Goods Orders MoM Sep" -> "Durable Goods Orders MoM"
  export const getBaseEventName = (eventName: string): string => {
    // Remove common date patterns:
    // - Dates in parentheses: (May), (Jan), (2024), etc.
    // - Month abbreviations at the end: Sep, Oct, Jan, etc. (with or without year)
    // - Dates at the end: Oct25, Feb25, 2024, etc.
    return eventName
      .replace(/\s*\((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)/gi, '')
      .replace(/\s*\(\d{4}\)/g, '')
      .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}$/i, '')
      .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, '')
      .replace(/\s+\d{4}$/, '')
      .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}$/, '')
      .trim();
  };

/**
 * Check if two event names match after cleaning
 * This is useful for comparing pinned events with current events
 * 
 * @param eventName1 - First event name
 * @param eventName2 - Second event name
 * @returns True if the cleaned names match
 */ 
export function eventMatchV1(event1: EconomicEvent, event2: PinnedEvent): boolean {
  return cleanEventNameForPinning(event1.event_name).toLowerCase() === cleanEventNameForPinning(event2.event).toLowerCase()
   && event1.impact === event2.impact && event1.currency === event2.currency;
}

export function eventMatchV2(event1: TradeEconomicEvent, event2: PinnedEvent): boolean { 
  return cleanEventNameForPinning(event1.name).toLowerCase() === cleanEventNameForPinning(event2.event).toLowerCase()
   && event1.impact === event2.impact && event1.currency === event2.currency;
}

export function eventMatchV3(event1: TradeEconomicEvent, event2: EconomicEvent): boolean { 
  return cleanEventNameForPinning(event1.name).toLowerCase() === cleanEventNameForPinning(event2.event_name).toLowerCase()
   && event1.impact === event2.impact && event1.currency === event2.currency;
}
/**
 * Check if an event is pinned based on its name
 * 
 * @param eventName - The event name to check
 * @param pinnedEvents - Array of pinned event names
 * @returns True if the event is pinned
 */
export function isEventPinned(event: EconomicEvent, pinnedEvents: PinnedEvent[] = []): boolean {
  const cleanedEventName = cleanEventNameForPinning(event.event_name);
  return pinnedEvents.some(pinnedEvent => 
    pinnedEvent.event.toLowerCase() === cleanedEventName.toLowerCase()
     && pinnedEvent.impact === event.impact && pinnedEvent.currency === event.currency
  );
}
