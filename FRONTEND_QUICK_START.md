# Frontend HTML & Citations - Quick Start Guide

## 🎯 What Changed?

The AI Chat now displays:
1. **HTML-formatted messages** - Bold, italic, lists, code blocks, etc.
2. **Citations/Sources** - Shows where the AI got its information from

## 📦 New Components

### HtmlMessageRenderer
Renders HTML content safely with proper styling.

```tsx
<HtmlMessageRenderer
  html="<p>This is <strong>bold</strong> text</p>"
  textColor="text.primary"
/>
```

### CitationsSection
Displays sources from tool usage.

```tsx
<CitationsSection
  citations={[
    {
      id: "1",
      title: "fxempire.com",
      url: "https://fxempire.com/...",
      toolName: "search_web"
    }
  ]}
  compact={true}
/>
```

## 🔧 How to Use

### In AIChatDrawer
```typescript
// Send message
const response = await supabaseAIChatService.sendMessage(
  message,
  userId,
  calendarId,
  conversationHistory
);

// Convert to ChatMessage
const chatMessage = supabaseAIChatService.convertToChatMessage(
  response,
  messageId
);

// Add to messages
setMessages(prev => [...prev, chatMessage]);
```

### In ChatMessage Component
The component automatically:
1. Detects if `messageHtml` exists
2. Renders HTML with `HtmlMessageRenderer`
3. Displays citations with `CitationsSection`
4. Falls back to plain text if no HTML

## 🎨 HTML Elements Supported

| Element | Example | Renders As |
|---------|---------|-----------|
| Bold | `<strong>text</strong>` | **text** |
| Italic | `<em>text</em>` | *text* |
| Heading | `<h2>Title</h2>` | # Title |
| List | `<ul><li>item</li></ul>` | • item |
| Code | `<code>var x</code>` | `var x` |
| Link | `<a href="url">text</a>` | [text](url) |
| Quote | `<blockquote>text</blockquote>` | > text |

## 🏷️ Citation Tool Colors

| Tool | Color | Badge |
|------|-------|-------|
| search_web | Blue | Web Search |
| scrape_url | Purple | Article |
| execute_sql | Cyan | Database |
| price_data | Green | Price Data |

## 🔒 Security

- HTML is sanitized with DOMPurify
- Only safe tags allowed
- XSS protection built-in
- No user input rendered as HTML

## 📱 Responsive

- Works on desktop and mobile
- Citations collapse by default on mobile
- Touch-friendly interactive elements
- Proper spacing and sizing

## 🧪 Testing

1. Open AI Chat Drawer
2. Send: "What's the sentiment on Bitcoin?"
3. Look for:
   - ✅ Formatted text (bold, italic, lists)
   - ✅ Citations section below message
   - ✅ Numbered citations with URLs
   - ✅ Tool badges with colors

## 🐛 Troubleshooting

### HTML not rendering?
- Check browser console for errors
- Verify `messageHtml` field exists
- Check DOMPurify warnings

### Citations not showing?
- Verify `citations` array is populated
- Check tool names are correct
- Ensure URLs are valid

### Styling looks wrong?
- Check MUI theme is applied
- Verify dark/light mode works
- Check responsive breakpoints

## 📚 Files

### New Files
- `src/components/aiChat/HtmlMessageRenderer.tsx`
- `src/components/aiChat/CitationsSection.tsx`
- `src/services/ai/supabaseAIChatService.ts`

### Updated Files
- `src/components/aiChat/ChatMessage.tsx`
- `src/components/aiChat/AIChatDrawer.tsx`
- `src/types/aiChat.ts`

## 🚀 Next Steps

1. Test the AI Chat with various queries
2. Verify HTML formatting displays correctly
3. Check citations appear and are clickable
4. Test on mobile devices
5. Gather user feedback

## 💡 Tips

- Citations are collapsible - click "Sources (N)" to expand/collapse
- Click citation URLs to open in new tab
- Tool badges show which tool generated each citation
- Superscript numbers in text link to citations
- Plain text messages still work (backward compatible)

## 📞 Need Help?

Check the detailed documentation:
- [FRONTEND_HTML_CITATIONS_DESIGN.md](./FRONTEND_HTML_CITATIONS_DESIGN.md)
- [FRONTEND_IMPLEMENTATION_SUMMARY.md](./FRONTEND_IMPLEMENTATION_SUMMARY.md)

---

**Ready to test!** 🎉

