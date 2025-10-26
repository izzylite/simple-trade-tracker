/**
 * Repository Service
 * Main orchestration service for Supabase data operations
 */

import { CalendarRepository } from './repositories/CalendarRepository';
import { TradeRepository } from './repositories/TradeRepository';
import { EconomicEventRepository } from './repositories/EconomicEventRepository';
import { Calendar, Trade } from '../../types/dualWrite';
import { RepositoryResult, RepositoryConfig } from './repositories/BaseRepository';
import { logger } from '../../utils/logger';
import { parseSupabaseError } from '../../utils/supabaseErrorHandler';

export class RepositoryService {
  private static instance: RepositoryService;
  private calendarRepo: CalendarRepository;
  public tradeRepo: TradeRepository; // Public for direct access to image upload methods
  public economicEventRepo: EconomicEventRepository; // Public for economic calendar operations

  private constructor() {
    const config: RepositoryConfig = {
      retryAttempts: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000
    };

    this.calendarRepo = new CalendarRepository(config);
    this.tradeRepo = new TradeRepository(config);
    this.economicEventRepo = new EconomicEventRepository();
  }

  public static getInstance(): RepositoryService {
    if (!RepositoryService.instance) {
      RepositoryService.instance = new RepositoryService();
    }
    return RepositoryService.instance;
  }

  // =====================================================
  // CALENDAR OPERATIONS
  // =====================================================

  async createCalendar(calendar: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Calendar>> {
    try {
      logger.info('Creating calendar:', { userId: calendar.user_id, name: calendar.name });
      return await this.calendarRepo.create(calendar);
    } catch (error) {
      logger.error('Error creating calendar:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Creating calendar'),
        timestamp: new Date(),
        operation: 'create'
      };
    }
  }

  async updateCalendar(id: string, updates: Partial<Calendar>): Promise<RepositoryResult<Calendar>> {
    try {
      logger.info('Updating calendar:', { id, updates: Object.keys(updates) });
      return await this.calendarRepo.update(id, updates);
    } catch (error) {
      logger.error('Error updating calendar:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Updating calendar'),
        timestamp: new Date(),
        operation: 'update'
      };
    }
  }

  async deleteCalendar(id: string): Promise<RepositoryResult<boolean>> {
    try {
      logger.info('Deleting calendar:', { id });
      return await this.calendarRepo.delete(id);
    } catch (error) {
      logger.error('Error deleting calendar:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Deleting calendar'),
        timestamp: new Date(),
        operation: 'delete'
      };
    }
  }

  async getCalendar(id: string): Promise<Calendar | null> {
    try {
      return await this.calendarRepo.findById(id);
    } catch (error) {
      logger.error('Error getting calendar:', error);
      return null;
    }
  }

  async getCalendarsByUserId(userId: string): Promise<Calendar[]> {
    try {
      return await this.calendarRepo.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting calendars by user ID:', error);
      return [];
    }
  }

  async getAllCalendars(): Promise<Calendar[]> {
    try {
      return await this.calendarRepo.findAll();
    } catch (error) {
      logger.error('Error getting all calendars:', error);
      return [];
    }
  }

  // =====================================================
  // TRADE OPERATIONS
  // =====================================================

  async createTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Trade>> {
    try {
      logger.info('Creating trade:', { calendarId: trade.calendar_id, userId: trade.user_id });
      return await this.tradeRepo.create(trade);
    } catch (error) {
      logger.error('Error creating trade:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Creating trade'),
        timestamp: new Date(),
        operation: 'create'
      };
    }
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<RepositoryResult<Trade>> {
    try {
      logger.info('Updating trade:', { id, updates: Object.keys(updates) });
      return await this.tradeRepo.update(id, updates);
    } catch (error) {
      logger.error('Error updating trade:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Updating trade'),
        timestamp: new Date(),
        operation: 'update'
      };
    }
  }

  async deleteTrade(id: string): Promise<RepositoryResult<boolean>> {
    try {
      logger.info('Deleting trade:', { id });
      return await this.tradeRepo.delete(id);
    } catch (error) {
      logger.error('Error deleting trade:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Deleting trade'),
        timestamp: new Date(),
        operation: 'delete'
      };
    }
  }

  async getTrade(id: string): Promise<Trade | null> {
    try {
      return await this.tradeRepo.findById(id);
    } catch (error) {
      logger.error('Error getting trade:', error);
      return null;
    }
  }

  async getTradesByUserId(userId: string): Promise<Trade[]> {
    try {
      return await this.tradeRepo.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting trades by user ID:', error);
      return [];
    }
  }

  async getTradesByCalendarId(calendarId: string): Promise<Trade[]> {
    try {
      return await this.tradeRepo.findByCalendarId(calendarId);
    } catch (error) {
      logger.error('Error getting trades by calendar ID:', error);
      return [];
    }
  }

  async getAllTrades(): Promise<Trade[]> {
    try {
      return await this.tradeRepo.findAll();
    } catch (error) {
      logger.error('Error getting all trades:', error);
      return [];
    }
  }

  // =====================================================
  // BATCH OPERATIONS
  // =====================================================

  async createManyCalendars(calendars: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<RepositoryResult<Calendar[]>> {
    try {
      logger.info('Creating multiple calendars:', { count: calendars.length });
      return await this.calendarRepo.createMany(calendars);
    } catch (error) {
      logger.error('Error creating multiple calendars:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Creating multiple calendars'),
        timestamp: new Date(),
        operation: 'createMany'
      };
    }
  }

  async createManyTrades(trades: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<RepositoryResult<Trade[]>> {
    try {
      logger.info('Creating multiple trades:', { count: trades.length });
      return await this.tradeRepo.createMany(trades);
    } catch (error) {
      logger.error('Error creating multiple trades:', error);
      return {
        success: false,
        error: parseSupabaseError(error, 'Creating multiple trades'),
        timestamp: new Date(),
        operation: 'createMany'
      };
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Health check for the repository service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Try a simple query to check Supabase connectivity
      const calendars = await this.calendarRepo.findAll();
      
      return {
        status: 'healthy',
        details: {
          supabaseConnected: true,
          calendarCount: calendars.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Repository health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get repository statistics
   */
  async getStats(): Promise<{
    calendars: { total: number };
    trades: { total: number };
  }> {
    try {
      const [calendars, trades] = await Promise.all([
        this.getAllCalendars(),
        this.getAllTrades()
      ]);

      return {
        calendars: { total: calendars.length },
        trades: { total: trades.length }
      };
    } catch (error) {
      logger.error('Error getting repository stats:', error);
      return {
        calendars: { total: 0 },
        trades: { total: 0 }
      };
    }
  }
}

// Export singleton instance
export const repositoryService = RepositoryService.getInstance();
