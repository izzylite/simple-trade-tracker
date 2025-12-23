/**
 * Supabase Storage Service
 * Handles file upload, download, and deletion operations using Supabase Storage
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { TradeImage } from '../components/trades/TradeForm';

// Module-level cache for public URLs to reduce Supabase client calls
const publicUrlCache = new Map<string, string>();

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

/**
 * Upload a file to Supabase Storage
 */
export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File,
  options: UploadOptions = {}
): Promise<{ data: any; error: any }> => {
  try {
    const {
      contentType = file.type,
      cacheControl = '3600',
      upsert = false
    } = options;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType,
        cacheControl,
        upsert
      });

    return { data, error };
  } catch (error) {
    logger.error('Error uploading file to Supabase Storage:', error);
    return { data: null, error };
  }
};

/**
 * Get a public URL for a file in Supabase Storage
 * Uses module-level cache to reduce redundant Supabase client calls
 */
export const getPublicUrl = (bucketName: string, filePath: string): string => {
  const cacheKey = `${bucketName}:${filePath}`;

  if (publicUrlCache.has(cacheKey)) {
    return publicUrlCache.get(cacheKey)!;
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  publicUrlCache.set(cacheKey, data.publicUrl);
  return data.publicUrl;
};

/**
 * Create a signed URL for private files
 */
export const createSignedUrl = async (
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    return { data, error };
  } catch (error) {
    logger.error('Error creating signed URL:', error);
    return { data: null, error };
  }
};

 

/**
 * Upload a trade image to Supabase Storage
 * This is a specialized function for trade images
 */
export const uploadTradeImage = async (
  calendarId: string,
  filename: string,
  file: File,
  width?: number,
  height?: number,
  caption?: string
): Promise<TradeImage> => {
  try {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Create the file path
    const filePath = `users/${user.id}/trade-images/${filename}`;

    // Upload the file
    const { error } = await uploadFile('trade-images', filePath, file, {
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Since this bucket is public, we can use a stable public URL
    const publicUrl = getPublicUrl('trade-images', filePath);

    // Return the image details
    return {
      url: publicUrl,
      id: filename,
      calendar_id: calendarId,
      width,
      height,
      caption
    };
  } catch (error) {
    logger.error('Error uploading trade image:', error);
    throw error;
  }
};
 
 

/**
 * Optimize image before upload (client-side)
 * This function compresses and resizes images to reduce file size
 */
export const optimizeImage = (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress image
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const optimizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(optimizedFile);
          } else {
            reject(new Error('Failed to optimize image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
