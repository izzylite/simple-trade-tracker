/**
 * Supabase Storage Service
 * Handles file upload, download, and deletion operations using Supabase Storage
 * Replaces Firebase Storage functionality
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { TradeImage } from '../components/trades/TradeForm';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

// Environment values used for direct REST uploads
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Helper to safely encode path segments for REST endpoint
function buildObjectUrl(bucketName: string, filePath: string): string {
  const encodePath = filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${SUPABASE_URL}/storage/v1/object/${bucketName}/${encodePath}`;
}

// Upload using XMLHttpRequest to emit real progress events (browser only)
async function uploadViaXHR(
  bucketName: string,
  filePath: string,
  file: File,
  {
    contentType,
    cacheControl,
    upsert,
    accessToken,
  }: { contentType?: string; cacheControl?: string; upsert?: boolean; accessToken: string },
  onProgress?: (progress: UploadProgress) => void
): Promise<{ data: any; error: any }> {
  return new Promise((resolve) => {
    try {
      const url = buildObjectUrl(bucketName, filePath);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      // Headers required by Supabase Storage REST API
      xhr.setRequestHeader('authorization', `Bearer ${accessToken}`);
      if (SUPABASE_ANON_KEY) xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      if (cacheControl) xhr.setRequestHeader('cache-control', cacheControl);
      if (contentType) xhr.setRequestHeader('content-type', contentType);
      if (upsert) xhr.setRequestHeader('x-upsert', 'true');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const percentage = Math.round((e.loaded / e.total) * 100);
          onProgress({ loaded: e.loaded, total: e.total, percentage });
        };
      }

      xhr.onerror = () => {
        resolve({ data: null, error: new Error('Network error during upload') });
      };

      xhr.onload = () => {
        // 200/201 are success for uploads
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            resolve({ data: resp ?? { path: filePath }, error: null });
          } catch (_) {
            resolve({ data: { path: filePath }, error: null });
          }
        } else {
          resolve({ data: null, error: new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`) });
        }
      };

      xhr.send(file);
    } catch (err) {
      resolve({ data: null, error: err });
    }
  });
}


/**
 * Upload a file to Supabase Storage with progress tracking
 */
export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File,
  options: UploadOptions = {}
): Promise<{ data: any; error: any }> => {
  try {
    const {
      onProgress,
      contentType = file.type,
      cacheControl = '3600',
      upsert = false
    } = options;

    // Prefer real progress via REST + XHR when available
    if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined' && onProgress) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken && SUPABASE_URL) {
        return await uploadViaXHR(
          bucketName,
          filePath,
          file,
          { contentType, cacheControl, upsert, accessToken },
          onProgress
        );
      }
    }

    // Fallback to supabase-js upload (no native progress)
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
 */
export const getPublicUrl = (bucketName: string, filePath: string): string => {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

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
 * Delete a file from Supabase Storage
 */
export const deleteFile = async (
  bucketName: string,
  filePath: string
): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    return { data, error };
  } catch (error) {
    logger.error('Error deleting file from Supabase Storage:', error);
    return { data: null, error };
  }
};

/**
 * List files in a directory
 */
export const listFiles = async (
  bucketName: string,
  path: string = '',
  options: { limit?: number; offset?: number; search?: string } = {}
): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path, options);

    return { data, error };
  } catch (error) {
    logger.error('Error listing files from Supabase Storage:', error);
    return { data: null, error };
  }
};

/**
 * Upload a trade image with progress tracking
 * This is a specialized function for trade images that matches the Firebase implementation
 */
export const uploadTradeImage = async (
  calendarId: string,
  filename: string,
  file: File,
  width?: number,
  height?: number,
  caption?: string,
  onProgress?: (progress: number) => void
): Promise<TradeImage> => {
  try {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Create the file path following the same structure as Firebase
    const filePath = `users/${user.id}/trade-images/${filename}`;

    // Upload the file with progress tracking
    const { error } = await uploadFile('trade-images', filePath, file, {
      onProgress: onProgress ? (progress) => onProgress(progress.percentage) : undefined,
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Since this is a private bucket, we need to create a signed URL
    // Create a signed URL that expires in 24 hours (86400 seconds)
    const { data: signedUrlData, error: signedUrlError } = await createSignedUrl(
      'trade-images',
      filePath,
      86400
    );

    if (signedUrlError) {
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
    }

    // Return the image details in the same format as Firebase
    return {
      url: signedUrlData.signedUrl,
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
 * Get a signed URL for a trade image
 * This is needed because trade images are stored in a private bucket
 */
export const getTradeImageUrl = async (
  filename: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      logger.error('User not authenticated for image access');
      return null;
    }

    const filePath = `users/${user.id}/trade-images/${filename}`;
    const { data, error } = await createSignedUrl('trade-images', filePath, expiresIn);

    if (error) {
      logger.error('Error creating signed URL for trade image:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    logger.error('Error getting trade image URL:', error);
    return null;
  }
};

/**
 * Delete a trade image
 */
export const deleteTradeImage = async (filename: string): Promise<boolean> => {
  try {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const filePath = `users/${user.id}/trade-images/${filename}`;
    const { error } = await deleteFile('trade-images', filePath);

    if (error) {
      logger.error('Error deleting trade image:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error deleting trade image:', error);
    return false;
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
