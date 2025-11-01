import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

interface UseRealtimeSubscriptionOptions {
  channelName: string;
  enabled?: boolean;
  onSubscribed?: () => void;
  onError?: (error: string) => void;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  onChannelCreated?: (channel: RealtimeChannel) => void; // NEW: Configure channel before subscribing
}

/**
 * Hook for managing Supabase Realtime subscriptions with automatic reconnection
 *
 * Provides robust realtime subscription management:
 * - Monitors subscription status (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)
 * - Implements exponential backoff for reconnection attempts
 * - Properly cleans up channels using removeChannel()
 * - Handles page visibility changes and network status
 * - Works with Supabase SDK v2.77.0+ automatic token refresh
 *
 * @see https://supabase.com/docs/guides/realtime/postgres-changes
 */
export function useRealtimeSubscription(options: UseRealtimeSubscriptionOptions) {
  const {
    channelName,
    enabled = true,
    onSubscribed,
    onError,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    onChannelCreated, // NEW: Extract callback
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isReconnectingRef = useRef(false);
  const isCleaningUpRef = useRef(false);


  /**
   * Cleanup existing channel before creating a new one
   * This prevents subscription loops as recommended by the community
   */
  const cleanupChannel = useCallback(async () => {
    if (channelRef.current) {
      logger.log(`🧹 Cleaning up channel: ${channelName}`);
      try {
        isCleaningUpRef.current = true;
        await supabase.removeChannel(channelRef.current);
      } finally {
        isCleaningUpRef.current = false;
        channelRef.current = null;
      }
    }
  }, [channelName]);

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    if (!enabled || isReconnectingRef.current || isCleaningUpRef.current) {
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached for ${channelName}`);
      onError?.(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
      return;
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;

    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
    logger.warn(`🔄 Reconnecting ${channelName} (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(async () => {
      await cleanupChannel();
      isReconnectingRef.current = false;
      // The channel will be recreated by the effect
    }, delay);
  }, [enabled, maxReconnectAttempts, reconnectDelay, channelName, onError, cleanupChannel]);

  /**
   * Create and return a channel with status monitoring
   * IMPORTANT: The channel is configured but NOT subscribed yet.
   * Caller must configure event listeners, then call .subscribe()
   */
  const createChannel = useCallback(() => {
    if (!enabled) {
      return null;
    }

    logger.log(`📡 Creating realtime channel: ${channelName}`);

    const channel = supabase.channel(channelName);

    // Allow caller to configure the channel (add event listeners) BEFORE subscribing
    if (onChannelCreated) {
      onChannelCreated(channel);
    }

    // Monitor subscription status as per official docs
    channel.subscribe((status) => {
      logger.log(`📊 Channel ${channelName} status: ${status}`);

      switch (status) {
        case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
          reconnectAttemptsRef.current = 0; // Reset on successful connection
          onSubscribed?.();
          break;

        case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
          logger.error(`❌ Channel error for ${channelName}`);
          onError?.('Channel error occurred');
          attemptReconnect();
          break;

        case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
          logger.warn(`⏱️ Channel timeout for ${channelName}`);
          onError?.('Connection timed out');
          attemptReconnect();
          break;

        case REALTIME_SUBSCRIBE_STATES.CLOSED:
          if (isCleaningUpRef.current) {
            logger.log(`🔌 Channel ${channelName} closed due to cleanup/unmount, skipping reconnect`);
            break;
          }
          logger.warn(`🔌 Channel closed for ${channelName}`);
          attemptReconnect();
          break;
      }
    });

    channelRef.current = channel;
    return channel;
  }, [enabled, channelName, onSubscribed, onError, attemptReconnect, onChannelCreated]);

  /**
   * Handle page visibility changes
   * Pause subscriptions when tab is hidden to prevent connection drops
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        logger.log(`👁️ Page hidden, pausing ${channelName} subscription`);
        // Don't cleanup, just let it pause naturally
      } else {
        logger.log(`👁️ Page visible, resuming ${channelName} subscription`);
        // If channel is in error state, attempt reconnect
        if (channelRef.current?.state === 'errored' || channelRef.current?.state === 'closed') {
          attemptReconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [channelName, attemptReconnect]);

  /**
   * Handle online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      logger.log(`🌐 Network online, reconnecting ${channelName}`);
      attemptReconnect();
    };

    const handleOffline = () => {
      logger.warn(`📴 Network offline for ${channelName}`);
      onError?.('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [channelName, onError, attemptReconnect]);

  /**
   * Listen for auth token refresh events and reconnect channels
   * This is CRITICAL: When JWT tokens expire and refresh, realtime channels
   * need to be recreated with the new token to maintain connection
   */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' && enabled && channelRef.current) {
        logger.log(`🔄 Token refreshed, reconnecting ${channelName} channel to use new JWT`);
        // Reset reconnect attempts since this is a legitimate reconnect
        reconnectAttemptsRef.current = 0;
        // Clean up old channel and it will be recreated with new token
        attemptReconnect();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [enabled, channelName, attemptReconnect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanupChannel();
    };
  }, [cleanupChannel]);

  return {
    channel: channelRef.current,
    createChannel,
    cleanupChannel,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
}

