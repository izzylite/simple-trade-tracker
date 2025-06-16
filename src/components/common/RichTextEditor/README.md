# RichTextEditor Component

A comprehensive rich text editor built with Draft.js and Material-UI, featuring a floating toolbar, color customization, and persistent user preferences.

## Features

- **Rich Text Formatting**: Bold, italic, underline, headings, and lists
- **Color Customization**: Text and background colors with recently used colors
- **Floating Toolbar**: Context-sensitive toolbar that appears on text selection
- **Persistent Preferences**: Recently used colors saved to localStorage
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance Optimized**: Debounced operations and efficient re-renders

## Recent Improvements

### Bug Fixes
1. **Fixed onChange comparison bug** - Prevented unnecessary onChange calls by properly comparing content states
2. **Improved error handling** - Added robust error handling for localStorage operations and DOM manipulations
3. **Fixed memory leaks** - Proper cleanup of event listeners and debounced functions
4. **Enhanced selection handling** - More reliable text selection detection and toolbar positioning

### Performance Optimizations
1. **Debounced toolbar positioning** - Reduced excessive calculations during text selection
2. **Memoized expensive operations** - Cached toolbar dimensions and position calculations
3. **Optimized re-renders** - Better state management to prevent unnecessary component updates
4. **Efficient event handling** - Streamlined event listeners with proper cleanup

### Code Organization
1. **Modular architecture** - Split into focused utility modules and custom hooks
2. **Better separation of concerns** - Extracted business logic from UI components
3. **Improved maintainability** - Clear file structure and comprehensive documentation
4. **Enhanced testability** - Isolated functions and hooks for easier testing

## Usage

```tsx
import RichTextEditor from './components/common/RichTextEditor';

function MyComponent() {
  const [content, setContent] = useState('');

  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      placeholder="Enter your text here..."
      label="Description"
      helperText="Use the toolbar to format your text"
      minHeight={200}
      maxHeight={400}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `undefined` | The editor content as JSON string |
| `onChange` | `(value: string) => void` | `undefined` | Callback when content changes |
| `placeholder` | `string` | `'Enter text here...'` | Placeholder text |
| `label` | `string` | `undefined` | Label displayed above the editor |
| `helperText` | `string` | `undefined` | Helper text displayed below the editor |
| `minHeight` | `number \| string` | `150` | Minimum height of the editor |
| `maxHeight` | `number \| string` | `'none'` | Maximum height of the editor |
| `disabled` | `boolean` | `false` | Whether the editor is disabled |
| `hideCharacterCount` | `boolean` | `false` | Whether to hide the character count display |
| `maxLength` | `number` | `undefined` | Maximum number of characters allowed |

## File Structure

```
RichTextEditor/
├── RichTextEditor.tsx          # Main component
├── index.ts                    # Exports
├── README.md                   # Documentation
├── RichTextEditor.test.tsx     # Tests
├── constants/
│   ├── colors.ts              # Color definitions
│   └── headings.ts            # Heading options
├── utils/
│   ├── debounce.ts            # Debouncing utilities
│   ├── localStorage.ts        # Safe localStorage operations
│   ├── draftUtils.ts          # Draft.js utilities
│   └── selectionUtils.ts      # Text selection utilities
└── hooks/
    ├── useRecentColors.ts     # Recent colors management
    └── useFloatingToolbar.ts  # Floating toolbar logic
```

## Utilities

### Debouncing
```tsx
import { debounce } from './utils/debounce';

const debouncedFunction = debounce(myFunction, 300);
```

### Safe localStorage
```tsx
import { safeGetLocalStorage, safeSetLocalStorage } from './utils/localStorage';

const value = safeGetLocalStorage('key', defaultValue);
const success = safeSetLocalStorage('key', value);
```

### Draft.js Utilities
```tsx
import { createEditorStateFromValue, hasContentChanged } from './utils/draftUtils';

const editorState = createEditorStateFromValue(jsonString);
const changed = hasContentChanged(oldState, newState);
```

## Custom Hooks

### useRecentColors
Manages recently used colors with localStorage persistence:

```tsx
const { 
  recentTextColors, 
  recentBgColors, 
  addRecentTextColor, 
  addRecentBgColor 
} = useRecentColors();
```

### useFloatingToolbar
Handles floating toolbar positioning and visibility:

```tsx
const { 
  showFloatingToolbar, 
  floatingToolbarPosition, 
  debouncedCheckSelection 
} = useFloatingToolbar({
  disabled,
  editorWrapperRef,
  toolbarRef,
  colorMenuAnchor,
  headingMenuAnchor,
});
```

## Testing

Run tests with:
```bash
npm test RichTextEditor.test.tsx
```

The test suite covers:
- Component rendering and props
- Content handling and onChange events
- Error handling and edge cases
- Utility function behavior
- localStorage operations

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- React 16.8+
- Material-UI 5.0+
- Draft.js 0.11+

## Contributing

When making changes:
1. Update tests for new functionality
2. Follow the existing code organization patterns
3. Add proper TypeScript types
4. Update documentation as needed
5. Ensure accessibility standards are maintained
