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

// Internal helper: try an MP3 file, fall back to the synth chirp on any error.
// Both notifications use the same fallback path so a missing/blocked asset
// degrades to "audible something" instead of silent.
const playSoundFile = async (src: string, volume = 0.6): Promise<void> => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    const playPromise = audio.play();
    if (playPromise !== undefined) await playPromise;
  } catch (error) {
    try {
      await generateFallbackSound();
    } catch {
      logger.debug(`Could not play sound ${src}:`, error);
    }
  }
};

// Economic event notifications — used by TradeCalendarPage.
export const playNotificationSound = async (): Promise<void> => {
  await playSoundFile('/notification.mp3');
};

// Orion task arrival — distinct sound so traders can distinguish a scheduled
// economic event ping from an Orion catalyst briefing by ear alone.
export const playTaskNotificationSound = async (): Promise<void> => {
  await playSoundFile('/task-notification.mp3');
};
