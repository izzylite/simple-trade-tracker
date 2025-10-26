# Frontend HTML & Citations Design

## Overview

The frontend has been redesigned to display HTML-formatted messages and citations from the AI Trading Agent. This document outlines the architecture, components, and integration points.

---

## Architecture

### Data Flow

```
User Message
    ↓
AIChatDrawer (sends via supabaseAIChatService)
    ↓
Supabase Edge Function (ai-trading-agent)
    ↓
AgentResponse {
  message: string (plain text)
  messageHtml: string (HTML formatted)
  citations: Citation[] (sources)
  metadata: { functionCalls, model, timestamp }
}
    ↓
ChatMessage Component (renders HTML + citations)
    ↓
HtmlMessageRenderer (safe HTML rendering)
CitationsSection (displays sources)
```

---

## New Components

### 1. **HtmlMessageRenderer.tsx**
Safely renders HTML-formatted messages with proper styling.

**Features:**
- Uses DOMPurify to sanitize HTML (prevents XSS)
- Supports markdown-to-HTML elements: `<p>`, `<strong>`, `<em>`, `<h1-h6>`, `<ul>`, `<ol>`, `<blockquote>`, `<code>`, `<pre>`, `<a>`
- Responsive typography with proper spacing
- Citation superscript links with `<sup>` tags
- Dark/light theme support

**Props:**
```typescript
interface HtmlMessageRendererProps {
  html: string;              // HTML content to render
  textColor?: string;        // MUI color prop (default: 'text.primary')
  isUser?: boolean;          // Whether it's a user message
}
```

**Usage:**
```tsx
<HtmlMessageRenderer
  html={message.messageHtml}
  textColor={getTextColor()}
  isUser={isUser}
/>
```

---

### 2. **CitationsSection.tsx**
Displays sources and citations from AI tool usage.

**Features:**
- Collapsible citations list (compact mode by default)
- Citation numbering with visual indicators
- Tool-specific color coding:
  - `search_web` → Primary (blue)
  - `scrape_url` → Secondary (purple)
  - `execute_sql` → Info (cyan)
  - `price_data` → Success (green)
- URL preview with "Open in new tab" icon
- Responsive layout

**Props:**
```typescript
interface CitationsSectionProps {
  citations: Citation[];     // Array of citations
  compact?: boolean;         // Collapse by default (default: false)
}
```

**Citation Interface:**
```typescript
interface Citation {
  id: string;               // Unique identifier
  title: string;            // Display title (domain name)
  url: string;              // Full URL
  source?: string;          // Optional source description
  toolName: string;         // Tool that generated this citation
}
```

**Usage:**
```tsx
<CitationsSection
  citations={message.citations}
  compact={true}
/>
```

---

## Updated Components

### 1. **ChatMessage.tsx**
Enhanced to support HTML rendering and citations.

**Changes:**
- Added imports for `HtmlMessageRenderer` and `CitationsSection`
- Updated message rendering logic to prioritize HTML:
  1. If `message.messageHtml` exists → render with `HtmlMessageRenderer`
  2. Else if inline references exist → render with references
  3. Else → render with regular formatting
- Added citations section below message content
- Maintains backward compatibility with plain text messages

**New Props on ChatMessage:**
```typescript
// From aiChat.ts ChatMessage interface
messageHtml?: string;      // HTML formatted message
citations?: Citation[];    // Array of citations
```

---

### 2. **AIChatDrawer.tsx**
Switched from Firebase AI Logic to Supabase AI Agent.

**Changes:**
- Replaced `firebaseAIChatService` with `supabaseAIChatService`
- Updated message sending to use edge function
- Simplified response handling (edge function returns formatted response)
- Maintains conversation history for multi-turn interactions

**Before:**
```typescript
const response = await firebaseAIChatService.sendMessageWithFunctionCalling(
  messageText,
  trades,
  calendar,
  messages,
  modelSettings
);
```

**After:**
```typescript
const response = await supabaseAIChatService.sendMessage(
  messageText,
  user.id,
  calendar.id,
  messages
);

const aiMessage = supabaseAIChatService.convertToChatMessage(
  response,
  uuidv4()
);
```

---

## New Service

### **supabaseAIChatService.ts**
Frontend service for communicating with the AI Trading Agent edge function.

**Methods:**

#### `sendMessage(message, userId, calendarId, conversationHistory)`
Sends a message to the AI agent and returns formatted response.

**Returns:**
```typescript
interface AgentResponse {
  success: boolean;
  message: string;           // Plain text response
  messageHtml?: string;      // HTML formatted response
  citations?: Citation[];    // Array of citations
  metadata?: {
    functionCalls: Array<{
      name: string;
      args: Record<string, any>;
      result: any;
    }>;
    model: string;
    timestamp: string;
  };
}
```

#### `convertToChatMessage(response, messageId)`
Converts edge function response to ChatMessage format for display.

---

## Type Updates

### **aiChat.ts**
Added new types to support HTML and citations:

```typescript
export interface Citation {
  id: string;
  title: string;
  url: string;
  source?: string;
  toolName: string;
}

export interface ChatMessage {
  // ... existing fields ...
  messageHtml?: string;      // HTML formatted message
  citations?: Citation[];    // Array of citations
}
```

---

## HTML Formatting Features

### Supported Elements
- **Text Formatting:** `<strong>`, `<em>`, `<u>`
- **Headings:** `<h1>` through `<h6>`
- **Lists:** `<ul>`, `<ol>`, `<li>`
- **Quotes:** `<blockquote>`
- **Code:** `<code>`, `<pre>`
- **Links:** `<a>` with `href`, `target`, `rel`
- **Citations:** `<sup>` for superscript numbers

### Styling
- Responsive typography with proper spacing
- Code blocks with background highlighting
- Blockquotes with left border
- Links with primary color and hover effects
- Dark/light theme support via MUI theme

### Security
- HTML sanitized with DOMPurify
- Only safe tags and attributes allowed
- XSS protection built-in
- Content properly escaped

---

## Citation Display

### Visual Design
- **Header:** "Sources (N)" with expand/collapse icon
- **Citation Cards:** Numbered with tool badge
- **Tool Badges:** Color-coded by tool type
- **URL:** Clickable with "Open in new tab" icon
- **Hover Effects:** Subtle background change and border highlight

### Interaction
- Click header to expand/collapse
- Click URL to open in new tab
- Compact mode collapses by default
- Full mode expands by default

---

## Integration Checklist

- [x] Created `HtmlMessageRenderer.tsx` component
- [x] Created `CitationsSection.tsx` component
- [x] Updated `ChatMessage.tsx` to use new components
- [x] Created `supabaseAIChatService.ts` service
- [x] Updated `AIChatDrawer.tsx` to use new service
- [x] Updated `aiChat.ts` types
- [x] Installed `dompurify` and `@types/dompurify`
- [x] No TypeScript errors

---

## Testing

### Manual Testing Steps

1. **Open AI Chat Drawer**
   - Verify drawer opens correctly
   - Check that input field is focused

2. **Send a Query**
   - Send: "What's the sentiment on Bitcoin?"
   - Verify response displays with HTML formatting
   - Check that citations appear below message

3. **Verify HTML Rendering**
   - Look for bold text, headers, lists
   - Verify code blocks display correctly
   - Check link formatting

4. **Test Citations**
   - Click "Sources (N)" to expand/collapse
   - Verify citation numbers match superscripts in text
   - Click URLs to open in new tab
   - Check tool badges display correct colors

5. **Test Multiple Messages**
   - Send several messages
   - Verify conversation history is maintained
   - Check that each message displays correctly

---

## Performance Considerations

- **HTML Sanitization:** DOMPurify runs on render (memoized)
- **Citation Rendering:** Lazy collapse/expand
- **Message Rendering:** Conditional rendering based on content type
- **No Breaking Changes:** Backward compatible with plain text messages

---

## Future Enhancements

1. **Citation Linking:** Highlight citations in text with superscript numbers
2. **Citation Tooltips:** Show preview on hover
3. **Export:** Copy message with citations as markdown
4. **Citation Analytics:** Track which sources are most used
5. **Custom Styling:** Allow users to customize citation appearance

---

## Troubleshooting

### HTML Not Rendering
- Check browser console for DOMPurify warnings
- Verify `messageHtml` field is populated
- Check that HTML is valid

### Citations Not Showing
- Verify `citations` array is populated
- Check that tool names match expected values
- Ensure URLs are valid

### Styling Issues
- Check MUI theme is applied
- Verify dark/light mode toggle works
- Check responsive breakpoints

---

## References

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [MUI Typography](https://mui.com/material-ui/api/typography/)
- [React dangerouslySetInnerHTML](https://react.dev/reference/react-dom/dangerouslySetInnerHTML)
- [Edge Function Response Format](../supabase/functions/ai-trading-agent/README.md)

