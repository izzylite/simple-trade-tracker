/**
 * Animated Text Component
 * Provides ChatGPT-like typing animation for AI responses
 */

import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';

interface AnimatedTextProps {
  text: string;
  speed?: number; // Characters per second
  onComplete?: () => void;
  isAnimating?: boolean;
  component?: React.ElementType;
  sx?: any;
}

const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  speed = 150, // Default 150 characters per second (much faster)
  onComplete,
  isAnimating = true,
  component = 'span',
  sx
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isAnimating) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 1000 / speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, isAnimating, onComplete]);

  // Reset when text changes
  useEffect(() => {
    if (isAnimating) {
      setDisplayedText('');
      setCurrentIndex(0);
    } else {
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }
  }, [text, isAnimating]);

  // Format content with basic markdown-like formatting
  const formatContent = (content: string) => {
    // For simple text without complex formatting, just return as is
    if (!content.includes('```') && !content.includes('`') && !content.includes('**')) {
      return content;
    }

    // Split content by code blocks and other formatting
    const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/);

    return parts.map((part, index) => {
      // Code blocks
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        const lines = code.split('\n');
        const language = lines[0]?.match(/^[a-zA-Z]+$/) ? lines.shift() : '';
        const codeContent = lines.join('\n');

        return (
          <Box
            key={index}
            component="pre"
            sx={{
              backgroundColor: 'grey.100',
              p: 1.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto',
              my: 1,
              whiteSpace: 'pre-wrap',
              border: '1px solid',
              borderColor: 'grey.300'
            }}
          >
            {language && (
              <Box component="span" sx={{ color: 'primary.main', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {language}
                {'\n'}
              </Box>
            )}
            {codeContent}
          </Box>
        );
      }

      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box
            key={index}
            component="code"
            sx={{
              backgroundColor: 'grey.100',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.875em',
              border: '1px solid',
              borderColor: 'grey.300'
            }}
          >
            {part.slice(1, -1)}
          </Box>
        );
      }

      // Bold text
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Box
            key={index}
            component="strong"
            sx={{ fontWeight: 'bold' }}
          >
            {part.slice(2, -2)}
          </Box>
        );
      }

      // Regular text
      return part;
    });
  };

  return (
    <Typography
      component={component}
      sx={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...sx
      }}
    >
      {formatContent(displayedText)}
    </Typography>
  );
};

export default AnimatedText;
