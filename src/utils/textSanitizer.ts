/**
 * Text sanitization utilities for cleaning user input and HTML content
 */

/**
 * Sanitize HTML content by removing potentially dangerous tags and attributes
 * while preserving basic formatting
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'style'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
    // Also remove self-closing versions
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });

  // Remove dangerous attributes
  const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'javascript:', 'vbscript:', 'data:'];
  dangerousAttrs.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  return sanitized.trim();
}

/**
 * Extract plain text from HTML content
 */
export function extractPlainText(html: string): string {
  if (!html) return '';

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Sanitize text content for AI consumption
 * Removes HTML tags, normalizes whitespace, and limits length
 */
export function sanitizeTextForAI(text: string, maxLength: number = 1000): string {
  if (!text) return '';

  // First extract plain text if it contains HTML
  let sanitized = text.includes('<') ? extractPlainText(text) : text;

  // Remove excessive whitespace and normalize line breaks
  sanitized = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive line breaks
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
    .trim();

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }

  return sanitized;
}

/**
 * Sanitize calendar notes specifically for AI analysis
 * Handles both rich text (JSON) and plain text content
 */
export function sanitizeCalendarNote(note: string): string {
  if (!note) return '';

  try {
    // Check if it's Draft.js JSON content
    const parsed = JSON.parse(note);
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      // Extract text from Draft.js blocks
      const text = parsed.blocks
        .map((block: any) => block.text || '')
        .join('\n')
        .trim();
      return sanitizeTextForAI(text);
    }
  } catch (e) {
    // Not JSON, treat as regular text
  }

  // Handle as regular text (might contain HTML)
  return sanitizeTextForAI(note);
}

/**
 * Sanitize daily notes map for AI analysis
 */
export function sanitizeDaysNotes(daysNotes: Map<string, string> | Record<string, string>): Record<string, string> {
  if (!daysNotes) return {};

  const sanitized: Record<string, string> = {};
  
  // Handle both Map and plain object
  const entries = daysNotes instanceof Map ? Array.from(daysNotes.entries()) : Object.entries(daysNotes);
  
  entries.forEach(([date, note]) => {
    if (note && note.trim()) {
      sanitized[date] = sanitizeCalendarNote(note);
    }
  });

  return sanitized;
}
