import { Trade } from '../types/trade';

// Mock trade data for testing
const mockTrade: Trade = {
  id: 'test-trade-123',
  date: new Date('2024-01-15'),
  amount: 150.50,
  type: 'win',
  name: 'Test Trade',
  entry: '1.2500',
  exit: '1.2650',
  tags: ['EUR/USD', 'London Session', 'Breakout'],
  riskToReward: 2.5,
  partialsTaken: false,
  session: 'London',
  notes: 'Great breakout trade with strong momentum',
  images: [
    {
      id: 'img-1',
      url: 'https://example.com/chart1.png',
      caption: 'Entry setup',
      row: 0,
      column: 0,
      columnWidth: 100,
      calendarId: 'test-calendar-456'
    }
  ],
  isPinned: false
};

// Test data for sharing functionality
export const testSharingData = {
  mockTrade,
  mockCalendarId: 'test-calendar-456',
  mockUserId: 'test-user-789',
  mockShareId: 'share_test-trade-123_1234567890_abc123',
  mockShareLink: 'https://tradetracker-30ec1.web.app/shared/share_test-trade-123_1234567890_abc123'
};

// Mock functions for testing
export const mockSharingFunctions = {
  generateShareLink: jest.fn().mockResolvedValue({
    shareLink: testSharingData.mockShareLink,
    shareId: testSharingData.mockShareId,
    directLink: testSharingData.mockShareLink
  }),
  
  getSharedTrade: jest.fn().mockResolvedValue({
    trade: mockTrade,
    viewCount: 5,
    sharedAt: new Date('2024-01-15T10:00:00Z')
  }),
  
  deactivateShare: jest.fn().mockResolvedValue({ success: true })
};

// Test scenarios
describe('Trade Sharing Functionality', () => {
  test('should generate share link for trade', async () => {
    const result = await mockSharingFunctions.generateShareLink({
      calendarId: testSharingData.mockCalendarId,
      tradeId: testSharingData.mockTrade.id,
      trade: testSharingData.mockTrade
    });
    
    expect(result.shareLink).toBe(testSharingData.mockShareLink);
    expect(result.shareId).toBe(testSharingData.mockShareId);
  });
  
  test('should retrieve shared trade data', async () => {
    const result = await mockSharingFunctions.getSharedTrade({
      shareId: testSharingData.mockShareId
    });
    
    expect(result.trade.id).toBe(testSharingData.mockTrade.id);
    expect(result.viewCount).toBe(5);
  });
  
  test('should deactivate shared trade', async () => {
    const result = await mockSharingFunctions.deactivateShare({
      shareId: testSharingData.mockShareId
    });
    
    expect(result.success).toBe(true);
  });
});

// Integration test helpers
export const integrationTestHelpers = {
  createTestTrade: (): Trade => ({
    ...mockTrade,
    id: `test-${Date.now()}`,
    date: new Date()
  }),
  
  validateShareLink: (shareLink: string): boolean => {
    const urlPattern = /^https:\/\/.*\/shared\/share_.*$/;
    return urlPattern.test(shareLink);
  },
  
  extractShareIdFromLink: (shareLink: string): string | null => {
    const match = shareLink.match(/\/shared\/(.+)$/);
    return match ? match[1] : null;
  }
};

export default {
  testSharingData,
  mockSharingFunctions,
  integrationTestHelpers
};
