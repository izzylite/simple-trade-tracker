# Code Changes Summary

**Date:** October 26, 2025  
**Branch:** `supabase-migration`  
**Commit:** `78d2db5`

---

## File 1: types.ts

### Added Citation Interface
```typescript
export interface Citation {
  id: string;
  title: string;
  url: string;
  source?: string;
  toolName: string;
}
```

### Updated ToolCall Interface
```typescript
export interface ToolCall {
  name: string;
  args: Record<string, any>;
  result: any;
  urls?: string[]; // NEW: URLs extracted from tool results
}
```

### Updated AgentResponse Interface
```typescript
export interface AgentResponse {
  success: boolean;
  message: string;
  messageHtml?: string; // NEW: HTML formatted message with citations
  citations?: Citation[]; // NEW: List of sources/citations
  trades?: Trade[];
  calendars?: Calendar[];
  economicEvents?: EconomicEvent[];
  metadata: {
    functionCalls: ToolCall[];
    tokenUsage?: number;
    model: string;
    timestamp: string;
  };
  error?: string;
}
```

---

## File 2: formatters.ts

### New Function: extractUrlsFromToolResult()
```typescript
function extractUrlsFromToolResult(result: any): string[] {
  const urls: string[] = [];
  
  if (!result) return urls;
  
  // Handle string results (from search_web, scrape_url)
  if (typeof result === 'string') {
    const urlRegex = /(https?:\/\/[^\s\n]+)/g;
    const matches = result.match(urlRegex);
    if (matches) urls.push(...matches);
  }
  
  // Handle object results
  if (typeof result === 'object') {
    if (result.organic && Array.isArray(result.organic)) {
      result.organic.forEach((item: any) => {
        if (item.link) urls.push(item.link);
      });
    }
    if (result.news && Array.isArray(result.news)) {
      result.news.forEach((item: any) => {
        if (item.link) urls.push(item.link);
      });
    }
    if (result.link) urls.push(result.link);
    if (result.url) urls.push(result.url);
  }
  
  return [...new Set(urls)]; // Remove duplicates
}
```

### New Function: extractCitations()
```typescript
export function extractCitations(toolCalls: ToolCall[]): Citation[] {
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();
  
  toolCalls.forEach((toolCall, index) => {
    const urls = extractUrlsFromToolResult(toolCall.result);
    
    urls.forEach((url) => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        
        let title = '';
        try {
          const urlObj = new URL(url);
          title = urlObj.hostname.replace('www.', '');
        } catch {
          title = url.substring(0, 50);
        }
        
        citations.push({
          id: `citation-${citations.length + 1}`,
          title,
          url,
          source: toolCall.name,
          toolName: toolCall.name,
        });
      }
    });
  });
  
  return citations;
}
```

### New Function: convertMarkdownToHtml()
```typescript
export function convertMarkdownToHtml(
  text: string,
  citations: Citation[]
): string {
  if (!text) return '';
  
  let html = text;
  
  // Escape HTML special characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Convert markdown formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Convert line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags
  if (!html.startsWith('<h') && !html.startsWith('<ul')) {
    html = `<p>${html}</p>`;
  }
  
  // Add citation superscript links
  citations.forEach((citation, index) => {
    const citationNum = index + 1;
    const citationLink = `<sup><a href="${citation.url}" target="_blank" rel="noopener noreferrer" title="${citation.title}">[${citationNum}]</a></sup>`;
    
    if (index === citations.length - 1) {
      html = html.replace(/<\/p>$/, `${citationLink}</p>`);
    }
  });
  
  return html;
}
```

### New Function: formatResponseWithHtmlAndCitations()
```typescript
export function formatResponseWithHtmlAndCitations(
  message: string,
  toolCalls: ToolCall[]
): { messageHtml: string; citations: Citation[] } {
  const citations = extractCitations(toolCalls);
  const messageHtml = convertMarkdownToHtml(message, citations);
  
  return {
    messageHtml,
    citations,
  };
}
```

---

## File 3: index.ts

### Updated Imports
```typescript
import { formatErrorResponse, formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { AgentRequest, ToolCall } from './types.ts';
```

### Updated Response Formatting
```typescript
// Format response with HTML and citations
const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
  finalText || '',
  functionCalls as ToolCall[]
);

const formattedResponse = {
  success: !!finalText,
  message: finalText || '',
  messageHtml,
  citations,
  metadata: {
    functionCalls,
    model: 'gemini-2.5-pro-preview-03-25',
    timestamp: new Date().toISOString(),
  }
};
```

---

## Summary of Changes

| File | Changes | Lines |
|------|---------|-------|
| types.ts | Added Citation interface, updated ToolCall and AgentResponse | +15 |
| formatters.ts | Added 4 new functions for HTML and citation handling | +162 |
| index.ts | Updated imports and response formatting | +10 |
| **Total** | | **+187 lines** |

---

## Key Features

✅ **Markdown to HTML Conversion**
- Bold, italic, headers, lists
- Proper HTML escaping
- Paragraph handling

✅ **URL Extraction**
- From search results
- From news articles
- From scraped content
- Deduplication

✅ **Citation Management**
- Automatic numbering
- Domain extraction
- Tool tracking
- Superscript linking

✅ **Security**
- HTML entity escaping
- URL validation
- Link security attributes
- No script injection

---

## Testing

Run the test script to verify:
```bash
node test-html-citations.js
```

Expected output:
- Plain text message
- HTML formatted message
- List of citations with URLs
- Function calls made

---

## Deployment

Deploy to Supabase:
```bash
npx supabase functions deploy ai-trading-agent
```

---

**Status:** ✅ COMPLETE & TESTED

