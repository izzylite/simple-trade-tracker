/**
 * Chat Session Management Service
 * Handles saving, loading, and managing AI chat sessions
 */

import { ChatSession, ChatMessage, TradingDataContext, DEFAULT_AI_CHAT_CONFIG } from '../types/aiChat';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

class ChatSessionService {
  private readonly STORAGE_KEY = 'ai-chat-sessions';
  private readonly MAX_SESSIONS = DEFAULT_AI_CHAT_CONFIG.maxSessionHistory;
  private readonly RETENTION_DAYS = DEFAULT_AI_CHAT_CONFIG.sessionRetentionDays;

  /**
   * Save a chat session
   */
  saveSession(session: ChatSession): void {
    try {
      const sessions = this.loadSessions();
      
      // Update existing session or add new one
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // Sort by updated date (most recent first)
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // Limit number of sessions
      if (sessions.length > this.MAX_SESSIONS) {
        sessions.splice(this.MAX_SESSIONS);
      }

      this.saveSessions(sessions);
      logger.log(`Chat session saved: ${session.title}`);
    } catch (error) {
      logger.error('Error saving chat session:', error);
    }
  }

  /**
   * Load all chat sessions
   */
  loadSessions(): ChatSession[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const sessions = JSON.parse(stored);
      
      // Convert date strings back to Date objects
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        tradingContext: {
          ...session.tradingContext,
          dateRange: {
            start: new Date(session.tradingContext.dateRange.start),
            end: new Date(session.tradingContext.dateRange.end)
          }
        },
        metadata: {
          ...session.metadata,
          dateRange: {
            start: new Date(session.metadata.dateRange.start),
            end: new Date(session.metadata.dateRange.end)
          }
        }
      }));
    } catch (error) {
      logger.error('Error loading chat sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    const sessions = this.loadSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * Create a new chat session
   */
  createSession(
    title: string,
    calendarId: string,
    tradingContext: TradingDataContext,
    provider: string,
    model?: string
  ): ChatSession {
    const session: ChatSession = {
      id: uuidv4(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: provider as any,
      model,
      tradingContext,
      metadata: {
        totalMessages: 0,
        calendarId,
        dateRange: tradingContext.dateRange
      }
    };

    return session;
  }

  /**
   * Update session with new message
   */
  addMessageToSession(sessionId: string, message: ChatMessage): void {
    const sessions = this.loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex >= 0) {
      sessions[sessionIndex].messages.push(message);
      sessions[sessionIndex].updatedAt = new Date();
      sessions[sessionIndex].metadata.totalMessages = sessions[sessionIndex].messages.length;
      
      this.saveSessions(sessions);
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    try {
      const sessions = this.loadSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      this.saveSessions(filteredSessions);
      logger.log(`Chat session deleted: ${sessionId}`);
    } catch (error) {
      logger.error('Error deleting chat session:', error);
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      logger.log('All chat sessions cleared');
    } catch (error) {
      logger.error('Error clearing chat sessions:', error);
    }
  }

  /**
   * Clean up old sessions based on retention policy
   */
  cleanupOldSessions(): void {
    try {
      const sessions = this.loadSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const activeSessions = sessions.filter(session => 
        new Date(session.updatedAt) > cutoffDate
      );

      if (activeSessions.length !== sessions.length) {
        this.saveSessions(activeSessions);
        logger.log(`Cleaned up ${sessions.length - activeSessions.length} old chat sessions`);
      }
    } catch (error) {
      logger.error('Error cleaning up old sessions:', error);
    }
  }

  /**
   * Get sessions for a specific calendar
   */
  getSessionsForCalendar(calendarId: string): ChatSession[] {
    const sessions = this.loadSessions();
    return sessions.filter(s => s.metadata.calendarId === calendarId);
  }

  /**
   * Export session as JSON
   */
  exportSession(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    try {
      return JSON.stringify(session, null, 2);
    } catch (error) {
      logger.error('Error exporting session:', error);
      return null;
    }
  }

  /**
   * Import session from JSON
   */
  importSession(jsonData: string): boolean {
    try {
      const session = JSON.parse(jsonData) as ChatSession;
      
      // Validate session structure
      if (!session.id || !session.title || !Array.isArray(session.messages)) {
        throw new Error('Invalid session format');
      }

      // Generate new ID to avoid conflicts
      session.id = uuidv4();
      session.title = `${session.title} (Imported)`;
      
      this.saveSession(session);
      logger.log(`Chat session imported: ${session.title}`);
      return true;
    } catch (error) {
      logger.error('Error importing session:', error);
      return false;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    totalMessages: number;
    oldestSession?: Date;
    newestSession?: Date;
  } {
    const sessions = this.loadSessions();
    
    if (sessions.length === 0) {
      return { totalSessions: 0, totalMessages: 0 };
    }

    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
    const dates = sessions.map(s => new Date(s.createdAt));
    
    return {
      totalSessions: sessions.length,
      totalMessages,
      oldestSession: new Date(Math.min(...dates.map(d => d.getTime()))),
      newestSession: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }

  /**
   * Generate session title from first message
   */
  generateSessionTitle(firstMessage: string): string {
    // Take first 50 characters and clean up
    let title = firstMessage.trim().substring(0, 50);
    
    // Remove line breaks and extra spaces
    title = title.replace(/\s+/g, ' ');
    
    // Add ellipsis if truncated
    if (firstMessage.length > 50) {
      title += '...';
    }
    
    // Fallback title
    if (!title) {
      title = `Chat ${new Date().toLocaleDateString()}`;
    }
    
    return title;
  }

  /**
   * Save sessions to localStorage
   */
  private saveSessions(sessions: ChatSession[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      logger.error('Error saving sessions to localStorage:', error);
      throw new Error('Failed to save chat sessions');
    }
  }
}

// Export singleton instance
export const chatSessionService = new ChatSessionService();
