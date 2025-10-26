---
type: "agent_requested"
description: "Example description"
---
# Code Architecture & Organization
- User prefers performing calculations in service layers, storing numeric values as numbers, and making heavy calculations async to prevent UI blocking.
- User prefers code reuse through functions and components, extracting reusable UI components (especially complex ones like event cards) to separate files.
- User prefers using transactions for database operations and organizing trade data into year-based subcollections in Firestore.
- User prefers using Firebase SDK subscriptions for real-time updates, Firebase Functions 2nd generation for callable functions, and optimizing functions for performance when experiencing high costs.
- User prefers callback pattern for database queries to check cache first, using count queries with conditions instead of fetching all documents, and granular update functions for specific properties.
- User prefers using Unix timestamps instead of Date objects for publishedAt and updatedAt fields to avoid conversion issues between frontend and backend.
- User prefers 20-character unique IDs to match Firebase's standard and migrating manual scripts to cloud functions for production deployment.

# UI Design & Styling
- User wants responsive UI with immediate dialog closures, background processing indicators, and shimmer loaders for loading states.
- User prefers rounded tab styling, curved cards, tooltips explaining calculations, and consistent tooltip styling across the application.
- User prefers dialog components with both cancel button and close icon, with primary action buttons supporting progress indicators.
- User prefers drawers to overlap toolbars with the toolbar positioned beneath the drawer for better visual hierarchy.
- User prefers saving UI toggle states to localStorage, darker background colors, and creating global resources for consistent styling.
- User prefers components to be wide and fit full screen width with reduced border radius for dialogs, and simple information displays with component heights limited to maximum 350px.
- User prefers using the app icon logo for navigation instead of generic home icons in headers, with favicon_io.zip at project root for the app icon.
- User prefers smaller, more compact filter components and hero images that span full screen width with components overlaying the image.

# Rich Text Editor & Content
- User prefers RichTextEditor to use softer white (#CCCCCC) color, hide character counts in read-only mode, and have a 1024 character limit for trade notes.
- User prefers text selection for link insertion to trim whitespace, consolidated toolbar options with popup menus, and keyboard shortcuts for undo/redo functionality.
- User prefers fixing incomplete parentheses by detecting opening parentheses and adding closing ones before the next whitespace or at text end.

# Trade & Data Management
- User wants tag filtering with unique colors and hierarchical tags in 'Category:Tag' format, with required tag groups validation.
- User wants to add risk per trade field with dynamic risk adjustment, display risk information in account balance section, and calculate maxDailyDrawdown based on account balance + totalPnL.
- User wants CSV support for import/export, converting unmatched headers to tag categories, and search functionality supporting multiple tags inclusion.
- User wants to implement trade sharing feature with on-demand share link generation and a pinning feature with a dedicated section for pinned trades.
- When 'partials taken' is selected, trades become manual (not calculated) rather than using calculated values.

# Visual Features & Charts
- User wants images displayed in adjustable layouts (grid/vertical) with resizable images maintaining aspect ratio and saved position information.
- User wants interactive pie charts allowing clicks on segments to display corresponding trades with matching tag colors.
- User wants performance charts showing which selected tags are more profitable on specific days of the week and yearly score functionality with tooltips.
- User prefers minimum 2x2 grid layout for SessionPerformanceAnalysis chart component and placeholder images for content without images.

# Navigation & User Experience
- User wants gallery mode for trade details navigation with next/previous buttons and keyboard arrow key support.
- User prefers that signed-in users should be redirected to dashboard page instead of homepage.
- User wants hyperlinks in rich text editor to open trades in gallery mode when the link points to a trade.

# Economic Calendar & News Feed
- User prefers economic calendar scrapers to extract forecast, previous, and actual values with complete data including country names and flag URLs.
- User prefers economic calendar events styled similar to FXBook with impact colors as background, date range picker with country images, and real-time countdown updates for imminent events.
- User prefers economic calendar event layouts with two rows: first showing date, check icon, flag, symbol, and impact badge; second showing event name with previous, forecast, and actual values.

- User prefers frontend to read news sources directly from Firebase newsMetadata collection with backend handling metadata updates, adding fields like date and source at the data fetching stage.