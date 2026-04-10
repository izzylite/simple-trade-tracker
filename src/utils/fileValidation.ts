/**
 * File validation utilities for upload functionality
 */

export interface FileValidationResult {
  validFiles: File[];
  oversizedFiles: string[];
  invalidTypeFiles: string[];
}

/**
 * Validates files for upload based on size and type constraints
 * @param files - FileList or File array to validate
 * @param maxSizeBytes - Maximum file size in bytes (default: 1MB)
 * @param allowedTypes - Array of allowed MIME types (default: image types)
 * @returns Object containing valid files and arrays of rejected files
 */
export const validateFiles = (
  files: FileList | File[],
  maxSizeBytes: number = 1024 * 1024, // 1MB default
  allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
): FileValidationResult => {
  const validFiles: File[] = [];
  const oversizedFiles: string[] = [];
  const invalidTypeFiles: string[] = [];

  const fileArray = Array.from(files);

  fileArray.forEach(file => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      invalidTypeFiles.push(file.name);
      return;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      oversizedFiles.push(file.name);
      return;
    }

    // File is valid
    validFiles.push(file);
  });

  return {
    validFiles,
    oversizedFiles,
    invalidTypeFiles
  };
};

/**
 * Formats file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "512 KB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Constants for common file size limits
 */
export const FILE_SIZE_LIMITS = {
  IMAGE_1MB: 1024 * 1024,
  IMAGE_5MB: 5 * 1024 * 1024,
  DOCUMENT_10MB: 10 * 1024 * 1024,
  VIDEO_100MB: 100 * 1024 * 1024
} as const;

/**
 * Compress an image file to a base64 JPEG data URL.
 * Scales down to maxSide on the long edge (default 1600px) at the given JPEG quality (default 0.85).
 * Images already smaller than maxSide are only re-encoded, not upscaled.
 */
export const compressImageToDataUrl = (
  file: File,
  maxSide: number = 1600,
  quality: number = 0.85
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/**
 * Common MIME type groups
 */
export const MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  VIDEOS: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv']
} as const;
