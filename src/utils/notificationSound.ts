/**
 * Simple notification sound utility
 * Plays a notification sound when called
 */

import { logger } from './logger';

// Fallback sound generation using Web Audio API
const generateFallbackSound = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a pleasant notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

      setTimeout(() => {
        audioContext.close();
        resolve();
      }, 250);

    } catch (error) {
      resolve(); // Always resolve to avoid blocking
    }
  });
};

// Simple function to play notification sound
export const playNotificationSound = async (): Promise<void> => {
  try {
    // Try to play the downloaded MP3 file first
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.6; // Set volume to 60%

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      await playPromise;
    }
  } catch (error) {
    try {
      // Fallback to generated sound if MP3 fails to load or play
      await generateFallbackSound();
    } catch (fallbackError) {
      // Silently fail if sound can't be played
      logger.debug('Could not play notification sound:', error);
    }
  }
};
