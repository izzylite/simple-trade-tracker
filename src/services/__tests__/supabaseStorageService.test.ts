/**
 * Tests for Supabase Storage Service
 * These tests verify the storage functionality works correctly
 */

import { uploadTradeImage, optimizeImage, getTradeImageUrl, deleteTradeImage } from '../supabaseStorageService';
import { supabase } from '../../config/supabase';

// Mock the supabase client
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
        remove: jest.fn()
      }))
    }
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    log: jest.fn()
  }
}));

describe('Supabase Storage Service', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  };

  const mockFile = new File(['test content'], 'test-image.jpg', {
    type: 'image/jpeg'
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadTradeImage', () => {
    it('should upload an image successfully', async () => {
      // Mock successful authentication
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      // Mock successful upload
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'users/test-user-id/trade-images/test-image.jpg' },
        error: null
      });

      // Mock successful signed URL creation
      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl
      });

      const result = await uploadTradeImage(
        'calendar-123',
        'test-image.jpg',
        mockFile,
        800,
        600,
        'Test caption'
      );

      expect(result).toEqual({
        url: 'https://example.com/signed-url',
        id: 'test-image.jpg',
        calendarId: 'calendar-123',
        width: 800,
        height: 600,
        caption: 'Test caption'
      });

      expect(mockUpload).toHaveBeenCalledWith(
        'users/test-user-id/trade-images/test-image.jpg',
        expect.any(File),
        expect.objectContaining({
          contentType: 'image/jpeg',
          upsert: false
        })
      );

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'users/test-user-id/trade-images/test-image.jpg',
        86400
      );
    });

    it('should throw error when user is not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      await expect(
        uploadTradeImage('calendar-123', 'test-image.jpg', mockFile)
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw error when upload fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload
      });

      await expect(
        uploadTradeImage('calendar-123', 'test-image.jpg', mockFile)
      ).rejects.toThrow('Upload failed: Upload failed');
    });
  });

  describe('getTradeImageUrl', () => {
    it('should create signed URL successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl
      });

      const result = await getTradeImageUrl('test-image.jpg', 3600);

      expect(result).toBe('https://example.com/signed-url');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'users/test-user-id/trade-images/test-image.jpg',
        3600
      );
    });

    it('should return null when user is not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const result = await getTradeImageUrl('test-image.jpg');

      expect(result).toBeNull();
    });
  });

  describe('deleteTradeImage', () => {
    it('should delete image successfully', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockRemove = jest.fn().mockResolvedValue({
        data: {},
        error: null
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove
      });

      const result = await deleteTradeImage('test-image.jpg');

      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith([
        'users/test-user-id/trade-images/test-image.jpg'
      ]);
    });

    it('should return false when delete fails', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Delete failed')
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove
      });

      const result = await deleteTradeImage('test-image.jpg');

      expect(result).toBe(false);
    });
  });

  describe('optimizeImage', () => {
    // Note: This test would require more complex mocking of Canvas API
    // For now, we'll skip it as it's primarily a browser API test
    it.skip('should optimize image correctly', async () => {
      // This would require mocking Canvas, Image, and Blob APIs
      // which is complex in a Jest environment
    });
  });
});
