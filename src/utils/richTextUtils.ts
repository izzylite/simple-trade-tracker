import { convertFromRaw } from 'draft-js';
import { stateToHTML } from 'draft-js-export-html';

/**
 * Converts Draft.js raw content to HTML
 * @param rawContent The Draft.js raw content as a string
 * @returns HTML string or empty string if conversion fails
 */
export const convertRichTextToHtml = (rawContent: string): string => {
  if (!rawContent) return '';

  try {
    // Parse the raw content
    const contentState = convertFromRaw(JSON.parse(rawContent));

    // Convert to HTML with custom options
    const options = {
      inlineStyles: {
        // Handle custom text colors
        ...Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => {
            const colorHex = i.toString(16).padStart(2, '0');
            return [`TEXT_COLOR_${colorHex}${colorHex}${colorHex}`, { style: { color: `#${colorHex}${colorHex}${colorHex}` } }];
          })
        ),
        // Handle all possible text colors (basic set)
        TEXT_COLOR_FF0000: { style: { color: '#FF0000' } }, // Red
        TEXT_COLOR_00FF00: { style: { color: '#00FF00' } }, // Green
        TEXT_COLOR_0000FF: { style: { color: '#0000FF' } }, // Blue
        TEXT_COLOR_FFFF00: { style: { color: '#FFFF00' } }, // Yellow
        TEXT_COLOR_FF00FF: { style: { color: '#FF00FF' } }, // Magenta
        TEXT_COLOR_00FFFF: { style: { color: '#00FFFF' } }, // Cyan
        TEXT_COLOR_000000: { style: { color: '#000000' } }, // Black
        TEXT_COLOR_FFFFFF: { style: { color: '#FFFFFF' } }, // White
        TEXT_COLOR_808080: { style: { color: '#808080' } }, // Gray
        TEXT_COLOR_FFA500: { style: { color: '#FFA500' } }, // Orange
        TEXT_COLOR_800080: { style: { color: '#800080' } }, // Purple
        TEXT_COLOR_008000: { style: { color: '#008000' } }, // Dark Green
        TEXT_COLOR_800000: { style: { color: '#800000' } }, // Maroon
        TEXT_COLOR_000080: { style: { color: '#000080' } }, // Navy
        TEXT_COLOR_808000: { style: { color: '#808000' } }, // Olive
        TEXT_COLOR_008080: { style: { color: '#008080' } }, // Teal
      },
      blockStyleFn: (block: any) => {
        const type = block.getType();
        switch (type) {
          case 'header-one':
            return { element: 'h1', style: { margin: '0.4em 0', fontSize: '1.2rem' } };
          case 'header-two':
            return { element: 'h2', style: { margin: '0.3em 0', fontSize: '1.1rem' } };
          case 'header-three':
            return { element: 'h3', style: { margin: '0.2em 0', fontSize: '1rem' } };
          default:
            return {};
        }
      }
    };

    // Convert to HTML with the options
    let html = stateToHTML(contentState, options);

    // Wrap the content in a div with full-width styling and smaller text
    html = `<div style="width: 100%; box-sizing: border-box; font-size: 0.8rem; line-height: 1.3;">${html}</div>`;

    // Add additional styling for paragraphs to reduce spacing
    html = html.replace(/<p/g, '<p style="margin: 0.3em 0"');

    return html;
  } catch (error) {
    console.error('Error converting rich text to HTML:', error);
    // If conversion fails, return the raw content as plain text
    try {
      // Try to extract text from the JSON
      const parsed = JSON.parse(rawContent);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        return parsed.blocks.map((block: any) => block.text).join('\n');
      }
    } catch (e) {
      // If that fails too, just return the raw content
      return rawContent;
    }
    return '';
  }
};
