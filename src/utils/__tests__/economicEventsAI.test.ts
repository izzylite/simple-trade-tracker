/**
 * Test file demonstrating the new AI economic events analysis capabilities
 * This shows how the AI can now query and analyze economic events data
 */

import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { tradingAnalysisFunctions } from '../../services/ai/tradingAnalysisFunctions';

// Mock trade data with economic events
const mockTradesWithEvents: Trade[] = [
  {
    id: 'trade-1',
    date: new Date('2024-01-05T14:30:00Z'),
    amount: 150,
    type: 'win',
    session: 'NY AM',
    tags: ['pair:EURUSD', 'strategy:scalp'],
    economicEvents: [
      {
        name: 'Non-Farm Payrolls',
        impact: 'High',
        currency: 'USD',
        timeUtc: '2024-01-05T13:30:00Z'
      }
    ]
  },
  {
    id: 'trade-2',
    date: new Date('2024-01-05T15:00:00Z'),
    amount: -75,
    type: 'loss',
    session: 'NY AM',
    tags: ['pair:GBPUSD', 'strategy:breakout'],
    economicEvents: [
      {
        name: 'Non-Farm Payrolls',
        impact: 'High',
        currency: 'USD',
        timeUtc: '2024-01-05T13:30:00Z'
      }
    ]
  },
  {
    id: 'trade-3',
    date: new Date('2024-01-06T10:00:00Z'),
    amount: 200,
    type: 'win',
    session: 'London',
    tags: ['pair:EURUSD', 'strategy:trend'],
    // No economic events
  },
  {
    id: 'trade-4',
    date: new Date('2024-01-08T09:30:00Z'),
    amount: -50,
    type: 'loss',
    session: 'London',
    tags: ['pair:EURUSD', 'strategy:scalp'],
    economicEvents: [
      {
        name: 'ECB Interest Rate Decision',
        impact: 'High',
        currency: 'EUR',
        timeUtc: '2024-01-08T12:45:00Z'
      }
    ]
  }
];

const mockCalendar: Calendar = {
  id: 'test-calendar',
  name: 'Test Calendar',
  userId: 'test-user',
  createdAt: new Date(),
  isShared: false
};

describe('AI Economic Events Analysis', () => {
  beforeEach(() => {
    // Initialize the trading analysis functions with mock data
    tradingAnalysisFunctions.initialize(mockTradesWithEvents, mockCalendar, 100);
  });

  describe('searchTrades with economic events filtering', () => {
    test('should filter trades by economic events presence', async () => {
      const result = await tradingAnalysisFunctions.searchTrades({
        hasEconomicEvents: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(3); // 3 trades have economic events
      expect(result.data?.trades.every(trade => 
        trade.economicEvents && trade.economicEvents.length > 0
      )).toBe(true);
    });

    test('should filter trades by economic event impact', async () => {
      const result = await tradingAnalysisFunctions.searchTrades({
        economicEventImpact: 'High'
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(3); // All events in mock data are High impact
    });

    test('should filter trades by economic event currency', async () => {
      const result = await tradingAnalysisFunctions.searchTrades({
        economicEventCurrency: 'USD'
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(2); // 2 trades have USD events
    });

    test('should filter trades by economic event name', async () => {
      const result = await tradingAnalysisFunctions.searchTrades({
        economicEventName: 'NFP'
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(2); // 2 trades have Non-Farm Payrolls
    });
  });

  describe('getTradeStatistics with economic events', () => {
    test('should include economic events statistics', async () => {
      const result = await tradingAnalysisFunctions.getTradeStatistics({
        includeEconomicEventStats: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.economicEventStats).toBeDefined();
      expect(result.data?.economicEventStats.totalTradesWithEvents).toBe(3);
      expect(result.data?.economicEventStats.percentageWithEvents).toBe(75); // 3 out of 4 trades
    });
  });

  describe('analyzeEconomicEvents', () => {
    test('should analyze economic events correlation', async () => {
      const result = await tradingAnalysisFunctions.analyzeEconomicEvents({
        impactLevel: 'High'
      });

      expect(result.success).toBe(true);
      expect(result.data?.tradesWithEvents).toBeDefined();
      expect(result.data?.tradesWithoutEvents).toBeDefined();
      expect(result.data?.economicEventStats).toBeDefined();
    });

    test('should filter by currency', async () => {
      const result = await tradingAnalysisFunctions.analyzeEconomicEvents({
        currency: 'USD'
      });

      expect(result.success).toBe(true);
      expect(result.data?.tradesWithEvents.count).toBe(2); // 2 trades with USD events
    });

    test('should filter by event name', async () => {
      const result = await tradingAnalysisFunctions.analyzeEconomicEvents({
        eventName: 'ECB'
      });

      expect(result.success).toBe(true);
      expect(result.data?.tradesWithEvents.count).toBe(1); // 1 trade with ECB event
    });
  });
});

// Example AI queries that are now possible:
/*
1. "Show me all my trades during high-impact USD economic events"
   -> searchTrades({ economicEventCurrency: 'USD', economicEventImpact: 'High' })

2. "How do I perform during NFP releases?"
   -> analyzeEconomicEvents({ eventName: 'NFP' })

3. "Compare my win rate with and without economic events"
   -> getTradeStatistics({ includeEconomicEventStats: true })

4. "Find my worst trades during ECB announcements"
   -> searchTrades({ economicEventName: 'ECB', tradeType: 'loss' })

5. "Analyze my performance during high-impact EUR events in the last 3 months"
   -> analyzeEconomicEvents({ currency: 'EUR', impactLevel: 'High', dateRange: 'last 3 months' })
*/
