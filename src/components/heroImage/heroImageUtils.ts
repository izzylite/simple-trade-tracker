import { Calendar } from '../../types/calendar';
import { logger } from '../../utils/logger';

/**
 * Updates the hero image URL for a calendar
 */
export const updateCalendarHeroImage = async (
  calendarId: string,
  imageUrl: string | null,
  onUpdateCalendarProperty: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>
): Promise<void> => {
  try {
    await onUpdateCalendarProperty(calendarId, (calendar) => {
      return {
        ...calendar,
        heroImageUrl: imageUrl || undefined
      };
    });
  } catch (error) {
    logger.error('Error updating calendar hero image:', error);
    throw error;
  }
};

/**
 * Validates if an image URL is accessible
 */
export const validateImageUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

/**
 * Gets the display style for hero image background
 */
export const getHeroImageStyle = (heroImageUrl?: string, heroImagePosition?: string) => {
  if (!heroImageUrl) {
    return {};
  }

  return {
    backgroundImage: `url(${heroImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: heroImagePosition || 'center',
    backgroundRepeat: 'no-repeat'
  };
};

/**
 * Popular search terms for hero images
 */
export const POPULAR_HERO_IMAGE_SEARCHES = [
  'trading charts',
  'financial markets',
  'business success',
  'growth analytics',
  'stock market',
  'cryptocurrency',
  'investment',
  'profit growth'
] as const;
