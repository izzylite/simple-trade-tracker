# Hero Image Feature for Calendar Notes

## Overview
Added a Notion-style hero image feature to the calendar note component, allowing users to set beautiful cover images for their trading calendars.

## Features

### 🖼️ Hero Image Management
- **Unsplash Integration**: Search and select from thousands of high-quality images
- **Image Picker**: Beautiful modal with search functionality and popular trading-related searches
- **Responsive Design**: Images adapt to expanded/collapsed states
- **Easy Management**: Add, change, or remove cover images with simple controls

### 🎨 Visual Enhancements
- **Gradient Overlay**: Subtle gradient ensures text readability over images
- **Smooth Transitions**: Animated height changes when expanding/collapsing
- **Professional Look**: Clean, modern design similar to Notion's cover images
- **Theme Integration**: Adapts to light/dark themes

### 🔧 Technical Implementation
- **Type Safety**: Full TypeScript support with proper interfaces
- **Database Integration**: Hero image URLs stored in Firebase Firestore
- **Fallback Support**: Graceful degradation when Unsplash API is unavailable
- **Performance**: Optimized image loading and caching

## Setup Instructions

### 1. Unsplash API Configuration (Optional)
1. Visit [Unsplash Developers](https://unsplash.com/developers)
2. Create a new application
3. Copy your Access Key
4. Add to your `.env` file:
   ```
   REACT_APP_UNSPLASH_ACCESS_KEY=your_access_key_here
   ```

### 2. Fallback Mode
If no Unsplash API key is provided, the component will use placeholder images for demonstration purposes.

## Usage

### For Users
1. **Adding a Hero Image**:
   - Click the image icon in the top-right corner of the calendar note
   - Select "Change cover" from the menu
   - Search for images or choose from popular categories
   - Click on any image to set it as your cover

2. **Removing a Hero Image**:
   - Click the image icon when a cover is set
   - Select "Remove cover" from the menu

3. **Popular Search Categories**:
   - Trading charts
   - Financial markets
   - Business success
   - Growth analytics
   - Stock market
   - Cryptocurrency
   - Investment
   - Profit growth

### For Developers
The hero image functionality is implemented across several components:

- **HeroImageManager**: Main component for image selection and management
- **CalendarNote**: Updated to display hero images and integrate the manager
- **Calendar Type**: Extended with `heroImageUrl` field
- **Calendar Service**: Updated to handle hero image persistence

## File Structure
```
src/
├── components/
│   ├── CalendarNote.tsx (updated)
│   └── common/
│       └── HeroImageManager.tsx (new)
├── types/
│   └── calendar.ts (updated)
└── services/
    └── calendarService.ts (updated)
```

## Database Schema
The `heroImageUrl` field has been added to the Calendar interface:
```typescript
interface Calendar {
  // ... existing fields
  heroImageUrl?: string;
  // ... other fields
}
```

## Benefits
- **Enhanced Visual Appeal**: Makes calendars more engaging and personalized
- **Professional Appearance**: Gives the app a modern, polished look
- **User Engagement**: Encourages users to customize their trading spaces
- **Brand Consistency**: Maintains the app's design language while adding visual interest

## Future Enhancements
- Custom image upload support
- Image positioning controls
- More image sources (Pexels, Pixabay)
- Image filters and effects
- Bulk image management
