# Trade Image Upload Guide

This guide explains how to use the TradeRepository's image upload functionality.

## Overview

The TradeRepository now includes comprehensive image upload methods that handle:
- Creating temporary trades for image uploads before form submission
- Uploading images to Supabase Storage with progress tracking
- Attaching images to trades in the database
- Removing images from trades and storage
- Updating image metadata (captions, layout)

## Architecture

### Flow for Image Upload Before Trade Creation

1. **User pastes/uploads image** → Create temporary trade
2. **Upload image to storage** → Get public URL
3. **Attach image to temporary trade** → Update trade.images array
4. **User submits form** → Convert temporary trade to permanent

### Storage Structure

Images are stored in Supabase Storage:
```
trade-images/
  users/
    {user_id}/
      trade-images/
        {filename}
```

### Database Structure

Images are stored as JSONB array in the `trades.images` column:
```typescript
{
  url: string;           // Public URL from Supabase Storage
  id: string;            // Unique filename
  calendar_id: string;   // Calendar ID
  caption?: string;      // Optional caption
  width?: number;        // Image width
  height?: number;       // Image height
  row?: number;          // Layout row
  column?: number;       // Layout column
  column_width?: number; // Layout column width (0-100%)
}
```

## Methods

### 1. createTemporaryTrade

Create a temporary trade for image uploads before form submission.

```typescript
async createTemporaryTrade(
  calendarId: string,
  userId: string,
  tradeId: string
): Promise<Trade | null>
```

**Example:**
```typescript
import { repositoryService } from '../services/repository';

// Generate a unique ID for the trade
const tradeId = uuidv4();

// Create temporary trade
const tempTrade = await repositoryService.tradeRepo.createTemporaryTrade(
  calendarId,
  userId,
  tradeId
);

if (tempTrade) {
  console.log('Temporary trade created:', tempTrade.id);
}
```

**When to use:**
- User pastes/uploads images before filling out the trade form
- Need a trade ID to associate images with before form submission

### 2. uploadImageToTrade

Upload an image and attach it to a trade.

```typescript
async uploadImageToTrade(
  tradeId: string,
  calendarId: string,
  filename: string,
  file: File,
  width?: number,
  height?: number,
  caption?: string,
  onProgress?: (progress: number) => void
): Promise<{ trade: Trade; image: TradeImage } | null>
```

**Example:**
```typescript
import { repositoryService } from '../services/repository';

// Upload image with progress tracking
const result = await repositoryService.tradeRepo.uploadImageToTrade(
  tradeId,
  calendarId,
  'image-123.jpg',
  imageFile,
  800,  // width
  600,  // height
  'My trade screenshot',  // caption
  (progress) => {
    console.log(`Upload progress: ${progress}%`);
    setUploadProgress(progress);
  }
);

if (result) {
  console.log('Image uploaded:', result.image.url);
  console.log('Trade updated:', result.trade.images);
}
```

**Features:**
- Uploads image to Supabase Storage
- Tracks upload progress
- Automatically attaches image to trade
- Returns updated trade and image details

### 3. removeImageFromTrade

Remove an image from a trade and delete it from storage.

```typescript
async removeImageFromTrade(
  tradeId: string,
  imageId: string
): Promise<Trade | null>
```

**Example:**
```typescript
import { repositoryService } from '../services/repository';

// Remove image from trade
const updatedTrade = await repositoryService.tradeRepo.removeImageFromTrade(
  tradeId,
  'image-123.jpg'
);

if (updatedTrade) {
  console.log('Image removed. Remaining images:', updatedTrade.images);
}
```

**Features:**
- Removes image from trade.images array
- Deletes image from Supabase Storage (async, non-blocking)
- Returns updated trade

### 4. updateTradeImageMetadata

Update image metadata (caption, layout) for a trade.

```typescript
async updateTradeImageMetadata(
  tradeId: string,
  imageId: string,
  updates: Partial<TradeImage>
): Promise<Trade | null>
```

**Example:**
```typescript
import { repositoryService } from '../services/repository';

// Update image caption
const updatedTrade = await repositoryService.tradeRepo.updateTradeImageMetadata(
  tradeId,
  'image-123.jpg',
  {
    caption: 'Updated caption',
    row: 0,
    column: 1,
    column_width: 50
  }
);

if (updatedTrade) {
  console.log('Image metadata updated:', updatedTrade.images);
}
```

**Features:**
- Updates specific image properties
- Preserves other image properties
- Returns updated trade

## Complete Example: Trade Form with Image Upload

```typescript
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { repositoryService } from '../services/repository';

function TradeForm({ calendarId, userId, onSubmit }) {
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle image paste/upload
  const handleImageUpload = async (file: File) => {
    try {
      // Create temporary trade if it doesn't exist
      if (!tradeId) {
        const newTradeId = uuidv4();
        const tempTrade = await repositoryService.tradeRepo.createTemporaryTrade(
          calendarId,
          userId,
          newTradeId
        );
        
        if (!tempTrade) {
          throw new Error('Failed to create temporary trade');
        }
        
        setTradeId(newTradeId);
      }

      // Upload image
      const filename = `${Date.now()}-${file.name}`;
      const result = await repositoryService.tradeRepo.uploadImageToTrade(
        tradeId!,
        calendarId,
        filename,
        file,
        undefined, // width (will be calculated)
        undefined, // height (will be calculated)
        '',        // caption (empty initially)
        (progress) => setUploadProgress(progress)
      );

      if (result) {
        console.log('Image uploaded successfully:', result.image.url);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (formData: any) => {
    try {
      if (tradeId) {
        // Update temporary trade with final data
        await repositoryService.updateTrade(tradeId, {
          ...formData,
          is_temporary: false
        });
      } else {
        // Create new trade
        await repositoryService.createTrade({
          ...formData,
          calendar_id: calendarId,
          user_id: userId
        });
      }
      
      onSubmit();
    } catch (error) {
      console.error('Error submitting trade:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      
      {/* Image upload */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleImageUpload(e.target.files[0]);
          }
        }}
      />
      
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div>Uploading: {uploadProgress}%</div>
      )}
      
      <button type="submit">Submit Trade</button>
    </form>
  );
}
```

## Error Handling

All methods return `null` on error and log the error using the logger utility. Always check for `null` returns:

```typescript
const result = await repositoryService.tradeRepo.uploadImageToTrade(...);

if (!result) {
  // Handle error
  showErrorMessage('Failed to upload image');
  return;
}

// Success - use result.trade and result.image
```

## Best Practices

1. **Always create temporary trade before uploading images**
   - Ensures images have a trade to attach to
   - Prevents orphaned images in storage

2. **Use progress callbacks for better UX**
   - Show upload progress to users
   - Disable form during upload

3. **Clean up on cancel**
   - Delete temporary trades if user cancels
   - Remove uploaded images if form is abandoned

4. **Validate file size before upload**
   - Use `validateFiles` utility from `src/utils/fileValidation.ts`
   - Current limit: 1MB per image

5. **Handle errors gracefully**
   - Show user-friendly error messages
   - Log errors for debugging
   - Provide retry options

## Migration from calendarService

If you're currently using `calendarService.uploadImage`, you can migrate to the repository pattern:

**Before:**
```typescript
const uploadedImage = await calendarService.uploadImage(
  calendarId,
  filename,
  file,
  width,
  height,
  caption,
  onProgress
);
```

**After:**
```typescript
const result = await repositoryService.tradeRepo.uploadImageToTrade(
  tradeId,
  calendarId,
  filename,
  file,
  width,
  height,
  caption,
  onProgress
);

if (result) {
  const uploadedImage = result.image;
  const updatedTrade = result.trade;
}
```

The new approach provides:
- ✅ Automatic trade updates
- ✅ Type-safe returns
- ✅ Better error handling
- ✅ Consistent with repository pattern

